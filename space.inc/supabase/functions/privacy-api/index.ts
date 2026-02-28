// privacy-api/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, getAuthContext, errorResponse } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { userId, orgId, supabase: supabaseUser } = await getAuthContext(req)
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const url = new URL(req.url)
        const path = url.pathname.split('/').pop()

        // 1. Request Data Export
        if (req.method === 'POST' && path === 'request') {
            const { data: exportId, error: rpcError } = await supabaseUser.rpc('request_data_export')
            if (rpcError) throw rpcError

            return new Response(JSON.stringify({
                message: 'Export queued. You will be notified when it is ready.',
                export_id: exportId
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 2. Check Status
        if (req.method === 'GET') {
            const { data: exports, error: fetchError } = await supabaseUser
                .from('data_exports')
                .select('*')
                .eq('user_id', userId)
                .order('requested_at', { ascending: false })
                .limit(1)

            if (fetchError) throw fetchError

            const latestExport = exports?.[0]
            if (!latestExport) {
                return new Response(JSON.stringify({ status: 'none' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            // If ready, generate signed URL
            let downloadUrl = null
            if (latestExport.status === 'ready' && latestExport.storage_path) {
                const { data: signedData, error: signError } = await supabaseAdmin
                    .storage
                    .from('private_exports')
                    .createSignedUrl(latestExport.storage_path, 86400) // 24h

                if (signError) console.error('Sign error:', signError)
                else downloadUrl = signedData.signedUrl

                // Log audit download if URL is accessed (Frontend responsibility to log when clicked)
            }

            return new Response(JSON.stringify({
                status: latestExport.status,
                requested_at: latestExport.requested_at,
                download_url: downloadUrl,
                expires_at: latestExport.expires_at
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 3. Process Queue (Internal/Admin only triggered for now)
        // In a real production setup, this would be a separate worker triggered by pg_cron or a webhook
        if (req.method === 'POST' && path === 'process-queue') {
            // Check if requester is Admin
            const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', userId).single()
            if (profile?.role !== 'owner' && profile?.role !== 'admin') {
                throw new Error('Unauthorized process request')
            }

            // Fetch one queued export
            const { data: queuedExport } = await supabaseAdmin
                .from('data_exports')
                .select('*')
                .eq('status', 'queued')
                .limit(1)
                .single()

            if (!queuedExport) {
                return new Response(JSON.stringify({ message: 'No jobs in queue' }), { headers: corsHeaders })
            }

            // Start Processing
            await supabaseAdmin.from('data_exports').update({ status: 'processing', processed_at: new Date().toISOString() }).eq('id', queuedExport.id)

            try {
                // 1. Aggregate Data
                const results: any = {
                    requested_at: new Date().toISOString(),
                    user_id: queuedExport.user_id,
                    data: {}
                }

                // Profile
                const { data: p } = await supabaseAdmin.from('profiles').select('*').eq('id', queuedExport.user_id).single()
                results.data.profile = p

                // Memberships
                const { data: m } = await supabaseAdmin.from('space_memberships').select('*, client_spaces(*)').eq('user_id', queuedExport.user_id)
                results.data.memberships = m

                // Messages
                const { data: msgs } = await supabaseAdmin.from('messages').select('*').eq('user_id', queuedExport.user_id)
                results.data.messages = msgs

                // Files (Metadata)
                const { data: files } = await supabaseAdmin.from('space_files').select('*').eq('uploaded_by', queuedExport.user_id)
                results.data.files = files

                // Audit Logs
                const { data: logs } = await supabaseAdmin.from('audit_logs').select('*').eq('actor_id', queuedExport.user_id)
                results.data.audit_logs = logs

                // 2. Create "ZIP" (JSON for now)
                const jsonContent = JSON.stringify(results, null, 2)
                const storagePath = `${queuedExport.user_id}/${queuedExport.id}.json`

                // 3. Upload to Storage
                const { error: uploadError } = await supabaseAdmin.storage.from('private_exports').upload(storagePath, jsonContent, {
                    contentType: 'application/json',
                    upsert: true
                })

                if (uploadError) throw uploadError

                // 4. Finalize
                await supabaseAdmin.from('data_exports').update({
                    status: 'ready',
                    storage_path: storagePath,
                    expires_at: new Date(Date.now() + 86400000).toISOString() // 24h
                }).eq('id', queuedExport.id)

                return new Response(JSON.stringify({ message: 'Processed export ' + queuedExport.id }), { headers: corsHeaders })

            } catch (procError: any) {
                await supabaseAdmin.from('data_exports').update({
                    status: 'failed',
                    failure_reason: procError.message
                }).eq('id', queuedExport.id)
                throw procError
            }
        }

        throw new Error('Endpoint not found')

    } catch (err: any) {
        return errorResponse({
            code: 'PRIVACY_API_ERROR',
            status: err.message.includes('Unauthorized') ? 403 : 400,
            message: err.message
        })
    }
})
