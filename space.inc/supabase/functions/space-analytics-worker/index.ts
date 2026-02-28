// space-analytics-worker/index.ts
// Aggregates space metrics for dashboards asynchronously.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Get spaces with pending events
        const { data: spaces, error: fetchError } = await supabase
            .from('space_events')
            .select('space_id')
            .is('processed_at', null)

        if (fetchError) throw fetchError

        const uniqueSpaceIds = [...new Set(spaces?.map(s => s.space_id).filter(Boolean))]

        console.log(`[space-analytics-worker] Processing stats for ${uniqueSpaceIds.length} spaces.`)

        // 2. Rollup stats for each space
        const results = []
        for (const spaceId of uniqueSpaceIds) {
            const { error: rpcError } = await supabase.rpc('rollup_space_stats', { p_space_id: spaceId })
            if (rpcError) {
                console.error(`Error rolling up stats for space ${spaceId}:`, rpcError)
                results.push({ spaceId, success: false, error: rpcError })
            } else {
                results.push({ spaceId, success: true })
            }
        }

        return new Response(JSON.stringify({
            processed_count: uniqueSpaceIds.length,
            results
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error('[space-analytics-worker] Critical Error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
