// activity-logs-api/index.ts — THIN GATEWAY (Phase 4 Rewrite)
// All logic lives in list_activity_logs SQL RPC.
// get_my_org_id_secure() inside the RPC handles org scoping — no profile fetch needed here.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, getAuthContext, hydrateError, errorResponse } from '../_shared/auth.ts'

serve(async (req: Request) => {
    // 1. CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    let supabaseClient: any

    try {
        // 2. Auth: validates JWT, creates RLS-scoped client
        const { supabase } = await getAuthContext(req)
        supabaseClient = supabase

        // ── GET /activity-logs-api?space_id=X&limit=N → List logs via RPC ───────
        if (req.method === 'GET') {
            const url = new URL(req.url)
            const spaceId = url.searchParams.get('space_id')
            const limit = parseInt(url.searchParams.get('limit') ?? '100', 10)

            // 4. SQL RPC: org-scoped internally, joins profiles + spaces
            const { data: logs, error } = await supabase.rpc('list_activity_logs', {
                p_space_id: spaceId ?? null,
                p_limit: limit
            })

            if (error) throw error

            return new Response(JSON.stringify({ data: logs }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        return errorResponse(await hydrateError(supabase, 'METHOD_NOT_ALLOWED', { method: req.method }))

    } catch (error: any) {
        console.error('[activity-logs-api] Error:', error)
        const code = error.isStandard ? error.message
            : (error.code && typeof error.code === 'string') ? error.code
                : 'INTERNAL_ERROR'
        const richError = await hydrateError(supabaseClient, code, { original_error: error.message || String(error) })
        return errorResponse(richError)
    }
})
