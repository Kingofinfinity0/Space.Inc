// invitations-api/index.ts — SaaS Hardening V2
// action: send → generates email-bound invitation record
// action: accept → calls consume_invitation() SQL RPC for atomic join
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { corsHeaders, getAuthContext, hydrateError, errorResponse } from 'shared/auth.ts'

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    let supabaseClient: any;

    try {
        const { userId, supabase } = await getAuthContext(req);
        supabaseClient = supabase;

        // Resolve Profile for organization context
        const { data: profile, error: profError } = await supabase
            .from('profiles')
            .select('organization_id, role')
            .eq('id', userId)
            .single()

        if (profError || !profile) {
            return errorResponse(await hydrateError(supabase, 'PERMISSION_DENIED', { detail: 'Profile resolution failed' }))
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const body = await req.json()
        const { action, spaceId, email, token, role = 'client' } = body

        // ── action: send ──────────────────────────────────────────────────
        if (action === 'send') {
            if (!email) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'email' }))

            // 1. Generate secure token
            const newToken = crypto.randomUUID()

            // 2. Insert into Hardened invitations table
            const { data: invite, error: inviteError } = await supabaseAdmin
                .from('invitations')
                .insert({
                    organization_id: profile.organization_id,
                    space_id: spaceId,
                    email,
                    role,
                    token: newToken,
                    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
                })
                .select()
                .single()

            if (inviteError) throw inviteError

            // 3. Log (Admin)
            await supabaseAdmin.from('activity_logs').insert({
                organization_id: profile.organization_id,
                space_id: spaceId,
                user_id: userId,
                action_type: 'INVITATION_GENERATED',
                payload_after: { email, role, invite_id: invite.id }
            })

            const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://nexus-portal.inc'
            const inviteLink = `${frontendUrl}/join?token=${newToken}`

            return new Response(JSON.stringify({
                success: true,
                data: {
                    link: inviteLink,
                    token: newToken,
                    email: email
                }
            }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // ── action: accept ────────────────────────────────────────────────
        if (action === 'accept') {
            if (!token) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'token' }))

            // Call the Atomic consume_invitation RPC
            const { data: result, error: rpcError } = await supabaseAdmin.rpc('consume_invitation', {
                p_token: token
            })

            if (rpcError) throw rpcError

            if (!result?.success) {
                return errorResponse(await hydrateError(supabase, result?.error_code || 'INTERNAL_ERROR'))
            }

            // Log entry
            await supabaseAdmin.from('activity_logs').insert({
                organization_id: result.data.organization_id,
                space_id: result.data.space_id,
                user_id: userId,
                action_type: 'INVITATION_CONSUMED',
                payload_after: { method: 'hardened_link' }
            })

            return new Response(JSON.stringify({
                success: true,
                data: result.data
            }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        return errorResponse(await hydrateError(supabase, 'METHOD_NOT_ALLOWED'))

    } catch (error: any) {
        console.error('[invitations-api] Error:', error)
        let code = 'INTERNAL_ERROR'
        if (error.isStandard) code = error.message
        const richError = await hydrateError(supabaseClient, code, { detail: error.message || String(error) })
        return errorResponse(richError)
    }
})
