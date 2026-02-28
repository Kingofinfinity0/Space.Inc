// files-api/index.ts — THIN GATEWAY with Storage (SaaS Hardening V2)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, getAuthContext, hydrateError, errorResponse } from './auth.ts'

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    let supabaseClient: any;

    try {
        const { userId, supabase } = await getAuthContext(req)
        supabaseClient = supabase;

        // Service role client for storage operations only (signed URLs require admin)
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // ── GET /files-api?spaceId=X → Fetch files ────────────────────────
        if (req.method === 'GET') {
            const url = new URL(req.url)
            const spaceId = url.searchParams.get('spaceId')

            let query = supabase
                .from('files')
                .select('*')
                .is('deleted_at', null)
                .order('created_at', { ascending: false })

            if (spaceId) {
                query = query.eq('space_id', spaceId)
            }

            const { data, error } = await query
            if (error) throw error
            return new Response(JSON.stringify({ data }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // ── POST /files-api → Action-based file operations ─────────────────
        if (req.method === 'POST') {
            const payload = await req.json().catch(() => ({}))
            const { action, spaceId, fileId, filename, contentType, checksum, fileSize, orgId } = payload

            if (!orgId) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'orgId' }))

            switch (action) {
                case 'REQUEST_UPLOAD_VOUCHER': {
                    if (!spaceId || !filename) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { fields: ['spaceId', 'filename'] }))

                    const { data: space, error: spaceErr } = await supabase
                        .from('client_spaces')
                        .select('id')
                        .eq('id', spaceId)
                        .eq('organization_id', orgId)
                        .is('deleted_at', null)
                        .single()

                    if (spaceErr || !space) return errorResponse(await hydrateError(supabase, 'PERMISSION_DENIED', { reason: 'Space not found or access denied' }))

                    const fileUuid = crypto.randomUUID()
                    const storagePath = `${orgId}/${spaceId}/${fileUuid}/${filename}`

                    const { data: uploadData, error: uploadError } = await supabaseAdmin
                        .storage
                        .from('space-files')
                        .createSignedUploadUrl(storagePath)

                    if (uploadError) throw uploadError

                    const { data: fileData, error: dbError } = await supabase
                        .from('files')
                        .insert([{
                            display_name: filename,
                            name: filename,
                            storage_path: storagePath,
                            space_id: spaceId,
                            organization_id: orgId,
                            mime_type: contentType || 'application/octet-stream',
                            status: 'pending',
                            uploaded_by: userId,
                            checksum: checksum ?? null,
                            file_size: fileSize ?? null
                        }])
                        .select()
                        .single()

                    if (dbError) throw dbError

                    return new Response(JSON.stringify({
                        upload_url: uploadData.signedUrl,
                        file_id: fileData.id,
                        storage_path: storagePath
                    }), {
                        status: 200,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                case 'CONFIRM_UPLOAD': {
                    if (!fileId) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'fileId' }))

                    const { data: file, error: fetchErr } = await supabase
                        .from('files')
                        .select('id, storage_path, organization_id')
                        .eq('id', fileId)
                        .eq('organization_id', orgId)
                        .single()

                    if (fetchErr || !file) return errorResponse(await hydrateError(supabase, 'RESOURCE_NOT_FOUND', { reason: 'File not found or access denied' }))

                    const { data, error } = await supabase
                        .from('files')
                        .update({ status: 'available', updated_at: new Date().toISOString() })
                        .eq('id', fileId)
                        .eq('organization_id', orgId)
                        .select()
                        .single()

                    if (error) throw error

                    await supabase.from('background_jobs').insert({
                        organization_id: orgId,
                        job_type: 'virus_scan',
                        status: 'pending',
                        payload: { file_id: fileId, storage_path: file.storage_path },
                        idempotency_key: `virus_scan_${fileId}`
                    })

                    return new Response(JSON.stringify({ data }), {
                        status: 200,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                case 'SIGN_URL': {
                    if (!fileId) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'fileId' }))

                    const { data: file, error: fetchError } = await supabase
                        .from('files')
                        .select('storage_path')
                        .eq('id', fileId)
                        .eq('organization_id', orgId)
                        .single()

                    if (fetchError || !file) return errorResponse(await hydrateError(supabase, 'RESOURCE_NOT_FOUND', { reason: 'File not found' }))

                    const { data, error: signError } = await supabaseAdmin
                        .storage
                        .from('space-files')
                        .createSignedUrl(file.storage_path, 3600)

                    if (signError) throw signError
                    return new Response(JSON.stringify({ data }), {
                        status: 200,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                case 'SOFT_DELETE': {
                    if (!fileId) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'fileId' }))

                    const { data, error } = await supabase
                        .from('files')
                        .update({ status: 'deleted', deleted_at: new Date().toISOString() })
                        .eq('id', fileId)
                        .eq('organization_id', orgId)
                        .select()
                        .single()

                    if (error) throw error

                    await supabase.rpc('write_audit_log' as any, {
                        p_organization_id: orgId,
                        p_actor_id: userId,
                        p_action: 'file.soft_delete',
                        p_resource_type: 'files',
                        p_resource_id: fileId
                    }).catch(() => { })

                    return new Response(JSON.stringify({ data }), {
                        status: 200,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                case 'RESTORE': {
                    if (!fileId) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'fileId' }))

                    const { data, error } = await supabase
                        .from('files')
                        .update({ status: 'available', deleted_at: null, updated_at: new Date().toISOString() })
                        .eq('id', fileId)
                        .eq('organization_id', orgId)
                        .select()
                        .single()

                    if (error) throw error
                    return new Response(JSON.stringify({ data }), {
                        status: 200,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                case 'HARD_DELETE': {
                    if (!fileId) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'fileId' }))

                    const { data: file, error: fetchErr } = await supabase
                        .from('files')
                        .select('storage_path')
                        .eq('id', fileId)
                        .eq('organization_id', orgId)
                        .single()

                    if (fetchErr || !file) return errorResponse(await hydrateError(supabase, 'RESOURCE_NOT_FOUND', { reason: 'File not found' }))

                    const { error: storageErr } = await supabaseAdmin
                        .storage
                        .from('space-files')
                        .remove([file.storage_path])

                    if (storageErr) throw storageErr

                    const { error: dbErr } = await supabase
                        .from('files')
                        .delete()
                        .eq('id', fileId)
                        .eq('organization_id', orgId)

                    if (dbErr) throw dbErr

                    return new Response(JSON.stringify({ success: true }), {
                        status: 200,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                default:
                    return errorResponse(await hydrateError(supabase, 'VAL_INVALID_ACTION', { action }))
            }
        }

        return errorResponse(await hydrateError(supabase, 'METHOD_NOT_ALLOWED', { method: req.method }))

    } catch (error: any) {
        console.error('[files-api] Error:', error)
        let code = 'INTERNAL_ERROR'
        if (error.isStandard) {
            code = error.message
        } else if (error.code && typeof error.code === 'string') {
            code = error.code
        }
        const richError = await hydrateError(supabaseClient, code, { original_error: error.message || String(error) })
        return errorResponse(richError)
    }
})
