// activity-logs-api/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { corsHeaders, getAuthContext } from 'shared/auth.ts'

/**
 * activity-logs-api - GROUND ZERO RESET
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
        let query = supabase
            .from('activity_logs')
            .select(`
                *,
                profiles:user_id (full_name, avatar_url),
                client_spaces:space_id (name)
            `)
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(100)

        if (spaceId) {
            query = query.eq('space_id', spaceId)
        }

        const { data: logs, error: logsError } = await query

        if (logsError) throw logsError

        return new Response(JSON.stringify({ data: logs }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error('[activity-logs-api] Error:', error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            status: error.status || 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
