// profile-api/index.ts — THIN GATEWAY (Phase 4 Rewrite)
// Profile reads/writes use native Supabase SDK (RLS enforces id = auth.uid() automatically).
// No SQL RPC needed — PostgREST + RLS is the correct pattern for single-user resource access.
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
        const { userId, supabase } = await getAuthContext(req)
        supabaseClient = supabase

        // ── GET /profile-api → Fetch own profile + org ─────────────────────────
        if (req.method === 'GET') {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*, organizations(*)')
                .eq('id', userId)
                .single()

            if (error || !profile) return errorResponse(await hydrateError(supabase, 'RESOURCE_NOT_FOUND', { resource: 'profile' }))

            return new Response(JSON.stringify({ data: profile }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // ── PATCH /profile-api → Update own profile (field-filtered) ───────────
        if (req.method === 'PATCH') {
            const updates = await req.json().catch(() => ({}))

            // Restrict to safe user-editable fields only — org_id, role, email silently dropped
            const ALLOWED = ['full_name', 'avatar_url', 'phone']
            const safe = Object.fromEntries(
                Object.entries(updates).filter(([k]) => ALLOWED.includes(k))
            )

            if (Object.keys(safe).length === 0) {
                return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', {
                    detail: `At least one of: ${ALLOWED.join(', ')} required`
                }))
            }

            const { data: profile, error } = await supabase
                .from('profiles')
                .update({ ...safe, updated_at: new Date().toISOString() })
                .eq('id', userId)
                .select()
                .single()

            if (error) throw error

            return new Response(JSON.stringify({ data: profile }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        return errorResponse(await hydrateError(supabase, 'METHOD_NOT_ALLOWED', { method: req.method }))

    } catch (error: any) {
        console.error('[profile-api] Error:', error)
        const code = error.isStandard ? error.message
            : (error.code && typeof error.code === 'string') ? error.code
                : 'INTERNAL_ERROR'
        const richError = await hydrateError(supabaseClient, code, { original_error: error.message || String(error) })
        return errorResponse(richError)
    }
})
