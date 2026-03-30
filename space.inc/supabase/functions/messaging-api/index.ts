// messaging-api/index.ts — THIN GATEWAY (Phase 4 Rewrite)
// GET: list_messages RPC (previously was inline query)
// POST: send_message RPC (unchanged — already correct)
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

        const url = new URL(req.url)

        // ── GET /messaging-api?space_id=X&organization_id=Y → List messages ────
        if (req.method === 'GET') {
            const spaceId = url.searchParams.get('space_id')
            const organizationId = url.searchParams.get('organization_id')
            const channel = url.searchParams.get('channel')
            const before = url.searchParams.get('before')
            const limit = parseInt(url.searchParams.get('limit') ?? '50', 10)

            if (!spaceId) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'space_id' }))
            if (!organizationId) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'organization_id' }))

            // 4. SQL RPC: Explicit multi-tenancy logic
            const { data: messages, error } = await supabase.rpc('list_messages_v2', {
                p_space_id: spaceId,
                p_organization_id: organizationId,
                p_channel: channel ?? null,
                p_before: before ?? null,
                p_limit: limit
            })

            if (error) throw error

            return new Response(JSON.stringify({ data: messages }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // ── POST /messaging-api → Send message via RPC ─────────────────────────
        if (req.method === 'POST') {
            const body = await req.json().catch(() => ({}))
            const { space_id, organization_id, content, extension = 'chat', payload = {}, channel = 'general' } = body

            if (!space_id) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'space_id' }))
            if (!organization_id) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'organization_id' }))
            if (!content || typeof content !== 'string' || content.trim().length === 0) {
                return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'content' }))
            }

            const { data: result, error: rpcError } = await supabase.rpc('send_message', {
                p_space_id: space_id,
                p_organization_id: organization_id,
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
        const code = error.isStandard ? error.message
            : (error.code && typeof error.code === 'string') ? error.code
                : 'INTERNAL_ERROR'
        const richError = await hydrateError(supabaseClient, code, { original_error: error.message || String(error) })
        return errorResponse(richError)
    }
})
