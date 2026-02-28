// onboarding-api/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
}

/**
 * onboarding-api - GROUND ZERO RESET (V3 - SELF CONTAINED)
 */
serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        console.log(`[onboarding-api] Incoming: ${req.method}`)

        const url = Deno.env.get('SUPABASE_URL')!
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

        const supabase = createClient(url, serviceKey)

        const body = await req.json().catch(() => ({}))
        const { action, payload } = body

        console.log(`[onboarding-api] Action: ${action}`)

        switch (action) {
            case 'signup': {
                const { email, password, full_name, organization_name } = payload || {}
                const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
                    email, password, email_confirm: true, user_metadata: { full_name }
                })
                if (authError) throw authError

                const { data: org, error: orgError } = await supabase
                    .from('organizations').insert({ name: organization_name, plan_tier: 'starter' }).select().single()
                if (orgError) throw orgError

                const { error: profileError } = await supabase
                    .from('profiles').insert({ id: authUser.user.id, organization_id: org.id, email, full_name, role: 'owner' })
                if (profileError) throw profileError

                return new Response(JSON.stringify({ data: { userId: authUser.user.id } }), {
                    status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            case 'login': {
                const { email, password } = payload || {}
                const userClient = createClient(url, anonKey)
                const { data, error: signInError } = await userClient.auth.signInWithPassword({ email, password })

                if (signInError) return new Response(JSON.stringify({ error: signInError.message }), {
                    status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })

                return new Response(JSON.stringify({ data }), {
                    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            default:
                return new Response(JSON.stringify({ message: "V3 STATUS: READY" }), {
                    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
        }
    } catch (error: any) {
        console.error('[onboarding-api] Fatal:', error)
        return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
