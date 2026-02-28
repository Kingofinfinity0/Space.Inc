// messaging-api/index.ts — THIN GATEWAY (SaaS Hardening V2)
// GET: fetch messages (scoped by org + space, RLS enforced at DB)
// POST: send message via send_message() SQL RPC (rate limiting, org isolation inside SQL)
// Alan's Rule: "If it must be atomic with DB write → SQL. If external network → Edge."
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, getAuthContext, hydrateError, errorResponse } from './auth.ts'

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    let supabaseClient: any;

    try {
        const { supabase } = await getAuthContext(req)
        supabaseClient = supabase;
        const url = new URL(req.url)
        const spaceId = url.searchParams.get('spaceId')

        // ── GET /messaging-api?spaceId=X → Fetch messages ─────────────────
        if (req.method === 'GET') {
            if (!spaceId) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'spaceId' }))

            const { data: messages, error } = await supabase
                .from('messages')
                .select('*, sender:profiles!sender_id(full_name, avatar_url)')
                .eq('space_id', spaceId)
                .order('created_at', { ascending: true })

            if (error) throw error
            return new Response(JSON.stringify({ data: messages }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // ── POST /messaging-api → Send message via send_message() RPC ──────
        if (req.method === 'POST') {
            const body = await req.json().catch(() => ({}))
            const { space_id, org_id, content, extension = 'chat', payload = {}, channel = 'general' } = body

            if (!space_id) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'space_id' }))
            if (!org_id) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'org_id' }))
            if (!content || typeof content !== 'string' || content.trim().length === 0) {
                return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'content' }))
            }

            const { data: result, error: rpcError } = await supabase.rpc('send_message', {
                p_org_id: org_id,
                p_space_id: space_id,
                p_content: content.trim(),
                p_channel: channel,
                p_extension: extension,
                p_payload: payload
            })

            if (rpcError) throw rpcError

            if (!result?.success) {
                return errorResponse(await hydrateError(supabase, result?.error_code || 'INTERNAL_ERROR'))
            }

            return new Response(JSON.stringify({ data: result.data }), {
                status: 201,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        return errorResponse(await hydrateError(supabase, 'METHOD_NOT_ALLOWED', { method: req.method }))

    } catch (error: any) {
        console.error('[messaging-api] Error:', error)
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

function json(body: unknown, status: number): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
}
