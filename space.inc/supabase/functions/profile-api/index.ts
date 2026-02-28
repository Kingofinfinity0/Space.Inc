// profile-api/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { corsHeaders, getAuthContext } from 'shared/auth.ts'

/**
 * profile-api - GROUND ZERO RESET
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
        // Note: For profile-api, the context IS the resource being managed.
        const { data: profile, error: profError } = await supabase
            .from('profiles')
            .select('*, organizations(*)')
            .eq('id', userId)
            .single()

        if (profError || !profile) {
            throw new Error('Profile not found or access denied')
        }

        // 4. Route Logic
        if (req.method === 'GET') {
            return new Response(JSON.stringify({ data: profile }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        if (req.method === 'PATCH') {
            const updates = await req.json()

            // Filter allowed fields
            const allowedFields = ['full_name', 'avatar_url', 'phone', 'is_active']
            const filteredUpdates = Object.keys(updates)
                .filter(key => allowedFields.includes(key))
                .reduce((obj, key) => {
                    obj[key] = updates[key]
                    return obj
                }, {} as any)

            const { data: updatedProfile, error } = await supabase
                .from('profiles')
                .update({ ...filteredUpdates, updated_at: new Date().toISOString() })
                .eq('id', userId)
                .select()
                .single()

            if (error) throw error
            return new Response(JSON.stringify({ data: updatedProfile }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        throw new Error(`Method ${req.method} not allowed`)

    } catch (error: any) {
        console.error('[profile-api] Error:', error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            status: error.status || 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
