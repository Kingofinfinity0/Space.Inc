// invitations-api/index.ts — SaaS Hardening V2
// action: send → generates email-bound invitation record
// action: accept → calls consume_invitation() SQL RPC for atomic join
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
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

        const body = await req.json()
        const { action, space_id, email, token, role = 'client' } = body

        // ── action: send ──────────────────────────────────────────────────
        if (action === 'send') {
            if (!email) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'email' }))
            if (!space_id) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'space_id' }))

            // THIN GATEWAY: Call the security-hardened RPC
            const { data: result, error: rpcError } = await supabase.rpc('invite_user_secure', {
                p_email: email.toLowerCase().trim(),
                p_role: role,
                p_space_id: space_id
            })

            if (rpcError) throw rpcError

            return new Response(JSON.stringify({
                success: true,
                data: result
            }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // ── action: accept ────────────────────────────────────────────────
        if (action === 'accept') {
            if (!token) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'token' }))

            // Call the Atomic consume_invitation RPC
            const { data: result, error: rpcError } = await supabase.rpc('consume_invitation', {
                p_token: token
            })

            if (rpcError) throw rpcError

            if (!result?.success) {
                return errorResponse(await hydrateError(supabase, result?.error_code || 'INTERNAL_ERROR'))
            }

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
