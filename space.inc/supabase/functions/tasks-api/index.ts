// tasks-api/index.ts — THIN GATEWAY (Phase 4 Rewrite)
// Pattern: CORS → getAuthContext → validate → RPC → respond
// No direct DB access. All business logic lives in SQL functions.
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

        // ── GET /tasks-api?space_id=X → List tasks via RPC ─────────────────────
        if (req.method === 'GET') {
            const spaceId = url.searchParams.get('space_id')

            const { data: tasks, error } = await supabase.rpc('list_tasks', {
                p_space_id: spaceId ?? null
            })

            if (error) throw error

            return new Response(JSON.stringify({ data: tasks }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // ── POST /tasks-api → Create task via RPC ──────────────────────────────
        if (req.method === 'POST') {
            const body = await req.json().catch(() => ({}))
            const { space_id, title, description, due_date, priority, assignee_id, status } = body

            // 3. Input validation
            if (!space_id) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'space_id' }))
            if (!title) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'title' }))

            // 4. SQL RPC: handles client policy gate, org isolation, activity log
            const { data: task, error } = await supabase.rpc('create_task', {
                p_space_id: space_id,
                p_title: title,
                p_description: description ?? null,
                p_due_date: due_date ?? null,
                p_priority: priority ?? 'medium',
                p_assignee_id: assignee_id ?? null,
                p_status: status ?? 'Pending'
            })

            if (error) throw error

            return new Response(JSON.stringify({ data: task }), {
                status: 201,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // ── PATCH /tasks-api → Update task via RPC ─────────────────────────────
        if (req.method === 'PATCH') {
            const body = await req.json().catch(() => ({}))
            const { task_id, ...updates } = body

            if (!task_id) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'task_id' }))

            const { data: task, error } = await supabase.rpc('update_task', {
                p_task_id: task_id,
                p_updates: updates
            })

            if (error) throw error

            return new Response(JSON.stringify({ data: task }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // ── DELETE /tasks-api?task_id=<uuid> → Delete task via RPC ─────────────────
        if (req.method === 'DELETE') {
            const taskId = url.searchParams.get('task_id')

            if (!taskId) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'task_id' }))

            const { error } = await supabase.rpc('delete_task', {
                p_task_id: taskId
            })

            if (error) throw error

            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        return errorResponse(await hydrateError(supabase, 'METHOD_NOT_ALLOWED', { method: req.method }))

    } catch (error: any) {
        console.error('[tasks-api] Error:', error)
        const code = error.isStandard ? error.message
            : (error.code && typeof error.code === 'string') ? error.code
                : 'INTERNAL_ERROR'
        const richError = await hydrateError(supabaseClient, code, { original_error: error.message || String(error) })
        return errorResponse(richError)
    }
})
