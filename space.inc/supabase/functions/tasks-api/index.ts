// tasks-api/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { corsHeaders, getAuthContext } from 'shared/auth.ts'

/**
 * tasks-api - GROUND ZERO RESET
 * Strictly follows the Standardized Guide.
 */

serve(async (req: Request) => {
    // 1. Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 2. Extract Auth Context (Identity & RLS Client)
        const { userId, supabase } = await getAuthContext(req);

        // 3. Resolve Profile Context (Explicitly as per Guide)
        const { data: profile, error: profError } = await supabase
            .from('profiles')
            .select('organization_id, role')
            .eq('id', userId)
            .single()

        if (profError || !profile) {
            throw new Error('Profile not found or access denied')
        }

        const { organization_id: orgId } = profile
        const url = new URL(req.url)
        const spaceId = url.searchParams.get('spaceId')

        // 4. Route Logic
        if (req.method === 'GET') {
            let query = supabase.from('tasks').select('*').eq('organization_id', orgId)
            if (spaceId) query = query.eq('space_id', spaceId)

            const { data: tasks, error } = await query.order('due_date', { ascending: true })
            if (error) throw error
            return new Response(JSON.stringify({ data: tasks }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        if (req.method === 'POST') {
            const taskData = await req.json()
            const { data: newTask, error } = await supabase.from('tasks').insert({
                ...taskData,
                organization_id: orgId,
                created_by: userId
            }).select().single()

            if (error) throw error
            return new Response(JSON.stringify({ data: newTask }), {
                status: 201,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        if (req.method === 'PATCH') {
            const { id, ...updates } = await req.json()
            if (!id) throw new Error('Task ID is required for updates')

            const { data: updatedTask, error } = await supabase
                .from('tasks')
                .update(updates)
                .eq('id', id)
                .eq('organization_id', orgId)
                .select()
                .single()

            if (error) throw error
            return new Response(JSON.stringify({ data: updatedTask }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        if (req.method === 'DELETE') {
            const id = url.searchParams.get('id')
            if (!id) throw new Error('Task ID is required for deletion')

            const { error } = await supabase
                .from('tasks')
                .delete()
                .eq('id', id)
                .eq('organization_id', orgId)

            if (error) throw error
            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        throw new Error(`Method ${req.method} not allowed`)

    } catch (error: any) {
        console.error('[tasks-api] Error:', error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            status: error.status || 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
