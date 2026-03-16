// createspace-api/index.ts — THIN GATEWAY (SaaS Hardening V2)
// All business logic lives in DB SQL functions (create_space, update_space, archive_space).
// This function: input validation → RPC call → standardized response.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, getAuthContext, hydrateError, errorResponse } from '../_shared/auth.ts'

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    let supabaseClient: any;

    try {
        const { supabase } = await getAuthContext(req)
        supabaseClient = supabase;

        // ── GET /createspace-api → List active spaces for the user ──────────────
        if (req.method === 'GET') {
            const { data: spaces, error: spacesError } = await supabase.rpc('list_user_spaces')

            if (spacesError) throw spacesError

            return new Response(JSON.stringify({ data: spaces }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // ── POST /createspace-api → Create a new space via SQL RPC ─────────────
        if (req.method === 'POST') {
            const body = await req.json().catch(() => ({}))
            const { name, description, modules, settings, metadata } = body

            if (!name) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'name' }))

            const { data: spaceId, error: rpcError } = await supabase.rpc('create_space', {
                p_name: name.trim(),
                p_description: description ?? null,
                p_modules: modules ?? { messages: true, chat: true, upload: true, meetings: true },
                p_metadata: metadata ?? {}
            })

            if (rpcError) throw rpcError

            return new Response(JSON.stringify({ data: { id: spaceId } }), {
                status: 201,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // ── PATCH /createspace-api → Update or Archive a space ─────────────────
        if (req.method === 'PATCH') {
            const body = await req.json().catch(() => ({}))
            const { action, space_id, data, reason } = body

            if (!space_id) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'space_id' }))

            if (action === 'update') {
                const { data: result, error: rpcError } = await supabase.rpc('update_space', {
                    p_space_id: space_id,
                    p_data: data ?? {}
                })
                if (rpcError) throw rpcError
                return new Response(JSON.stringify({ data: result }), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            if (action === 'archive') {
                const { data: result, error: rpcError } = await supabase.rpc('archive_space', {
                    p_space_id: space_id,
                    p_reason: reason ?? null
                })
                if (rpcError) throw rpcError
                return new Response(JSON.stringify({ data: result }), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            return errorResponse(await hydrateError(supabase, 'VAL_INVALID_ACTION'))
        }

        // ── DELETE /createspace-api → Soft delete a space ──────────────────────
        if (req.method === 'DELETE') {
            const body = await req.json().catch(() => ({}))
            const { space_id } = body

            if (!space_id) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'space_id' }))

            const { data: result, error: rpcError } = await supabase.rpc('delete_space_soft', {
                p_space_id: space_id
            })

            if (rpcError) throw rpcError

            return new Response(JSON.stringify({ data: result }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        return errorResponse(await hydrateError(supabase, 'METHOD_NOT_ALLOWED', { method: req.method }))

    } catch (error: any) {
        console.error('[createspace-api] Error:', error)
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
