// invitations-api/index.ts — Thin Gateway V3
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, getAuthContext, hydrateError, errorResponse } from 'shared/auth.ts'

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    let supabaseClient: any

    try {
        const body = await req.json().catch(() => ({}))
        const { action } = body

        if (!action) return new Response(JSON.stringify({ error: 'Action required' }), { status: 400, headers: corsHeaders })

        // 1. PUBLIC actions (no auth required)
        if (action === 'validate') {
            const { token } = body
            if (!token) return errorResponse(await hydrateError(null, 'VAL_MISSING_FIELD', { field: 'token' }))
            
            const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
            const { data, error } = await anon.rpc('validate_invitation_context', { p_token: token })
            if (error) throw error
            return new Response(JSON.stringify({ data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // 2. PROTECTED actions (Admin/Owner)
        const { userId, supabase } = await getAuthContext(req)
        supabaseClient = supabase

        if (action === 'send_staff') {
            const { email, role, space_assignments } = body
            if (!email || !role) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD'))

            const { data, error } = await supabase.rpc('send_staff_invitation', {
                p_email: email.toLowerCase().trim(),
                p_role: role,
                p_space_assignments: space_assignments || []
            })
            if (error) throw error
            return new Response(JSON.stringify({ data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        if (action === 'send_client') {
            const { email, space_id } = body
            if (!email || !space_id) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD'))

            const { data, error } = await supabase.rpc('send_client_invitation', {
                p_email: email.toLowerCase().trim(),
                p_space_id: space_id
            })
            if (error) throw error
            return new Response(JSON.stringify({ data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // 3. ATOMIC action (handled by DB logic)
        if (action === 'accept') {
            const { token } = body
            if (!token) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'token' }))

            const { data: result, error: rpcError } = await supabase.rpc('accept_invitation', { p_token: token })
            if (rpcError) throw rpcError

            return new Response(JSON.stringify({ data: result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        return errorResponse(await hydrateError(supabase, 'METHOD_NOT_ALLOWED'))

    } catch (err: any) {
        console.error('[invitations-api] Error:', err)
        const code = err.isStandard ? err.message : (err.code || 'INTERNAL_ERROR')
        const richError = await hydrateError(supabaseClient, code, { original_error: err.message || String(err) })
        return errorResponse(richError)
    }
})
