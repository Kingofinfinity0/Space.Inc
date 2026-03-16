// meetings-api/index.ts — THIN GATEWAY (Phase 4 Rewrite)
// Pattern: CORS → getAuthContext → validate → (Daily API if needed) → RPC → respond
// Webhook route is unauthenticated by design (HMAC verified instead)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, getAuthContext, hydrateError, errorResponse } from '../_shared/auth.ts'

// HMAC verification for Daily.co webhooks
async function verifyDailyWebhook(req: Request, secret: string): Promise<boolean> {
    const signature = req.headers.get('X-Webhook-Signature')
    const timestamp = req.headers.get('X-Webhook-Timestamp')
    if (!signature || !timestamp || !secret) return false
    const rawBody = await req.clone().text()
    const dataToVerify = `${timestamp}.${rawBody}`
    try {
        const encoder = new TextEncoder()
        const cryptoKey = await crypto.subtle.importKey(
            'raw', encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
        )
        const sigBytes = new Uint8Array(signature.match(/.{1,2}/g)!.map(b => parseInt(b, 16)))
        return await crypto.subtle.verify('HMAC', cryptoKey, sigBytes, encoder.encode(dataToVerify))
    } catch {
        return false
    }
}

serve(async (req: Request) => {
    // 1. CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    let supabaseClient: any

    try {
        const dailyApiKey = Deno.env.get('DAILY_API_KEY') ?? ''
        const webhookSecret = Deno.env.get('DAILY_WEBHOOK_SECRET') ?? ''
        const url = new URL(req.url)

        // ── WEBHOOK (UNAUTHENTICATED — HMAC secured) ──────────────────────────
        if (url.pathname.endsWith('/webhook')) {
            const body = await req.json()
            if (!(await verifyDailyWebhook(req, webhookSecret))) {
                return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), {
                    status: 401,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            const supabaseAdmin = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            )

            const { type, payload } = body
            const roomName = payload?.room_name ?? ''
            const meetingId = roomName.includes('meeting-') ? roomName.split('meeting-')[1] : null

            if (type === 'recording.ready_to_download' && meetingId) {
                const { data: recData, error: recError } = await supabaseAdmin
                    .from('recordings')
                    .insert({
                        meeting_id: meetingId,
                        daily_recording_id: payload.recording_id,
                        download_url: payload.download_url,
                        status: 'ready'
                    })
                    .select()
                    .single()

                if (!recError && recData) {
                    await supabaseAdmin.from('meetings').update({ recording_id: recData.id }).eq('id', meetingId)
                }
            }

            return new Response(JSON.stringify({ received: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 2. Auth context — all routes below require a valid user JWT
        const { userId, email, supabase } = await getAuthContext(req)
        supabaseClient = supabase

        // ── GET /meetings-api?space_id=X → List meetings (RLS scoped) ──────────
        if (req.method === 'GET') {
            const spaceId = url.searchParams.get('space_id')

            let query = supabase
                .from('meetings')
                .select('*')
                .is('deleted_at', null)
                .order('starts_at', { ascending: false })

            if (spaceId) query = query.eq('space_id', spaceId)

            const { data: meetings, error } = await query
            if (error) throw error

            return new Response(JSON.stringify({ data: meetings }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // ── POST /meetings-api → Action-based meeting operations ───────────────
        if (req.method === 'POST') {
            const body = await req.json().catch(() => ({}))
            const { action, meeting_id } = body

            if (!action) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'action' }))

            switch (action) {

                // ── CREATE_INSTANT_MEETING ─────────────────────────────────────
                case 'CREATE_INSTANT_MEETING': {
                    const { space_id, title, description, recording_enabled } = body
                    if (!space_id) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'space_id' }))

                    // 5. External API first (Daily.co room must exist before DB record)
                    const dailyRes = await fetch('https://api.daily.co/v1/rooms', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${dailyApiKey}` },
                        body: JSON.stringify({
                            properties: {
                                enable_recording: (recording_enabled ?? true) ? 'cloud' : false,
                                exp: Math.round(Date.now() / 1000) + 7200
                            }
                        })
                    })
                    const dailyData = await dailyRes.json()
                    if (!dailyRes.ok) throw new Error(`Daily API Error: ${dailyData.info || dailyData.error}`)

                    // 4. SQL RPC: creates DB record, writes activity log atomically
                    const { data: meeting, error: rpcError } = await supabase.rpc('create_meeting', {
                        p_space_id: space_id,
                        p_title: title || 'Instant Meeting',
                        p_starts_at: new Date().toISOString(),
                        p_duration_minutes: 60,
                        p_description: description ?? null,
                        p_recording_enabled: recording_enabled ?? true,
                        p_daily_room_name: dailyData.name,
                        p_daily_room_url: dailyData.url,
                        p_is_instant: true,
                        p_meeting_type: 'instant'
                    })

                    if (rpcError) throw rpcError

                    return new Response(JSON.stringify({ data: { meeting, roomUrl: dailyData.url } }), {
                        status: 201,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                // ── CREATE_SCHEDULED_MEETING ───────────────────────────────────
                case 'CREATE_SCHEDULED_MEETING': {
                    const { space_id, title, starts_at, duration_minutes, description, recording_enabled } = body
                    if (!space_id || !starts_at) {
                        return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { fields: ['space_id', 'starts_at'] }))
                    }

                    const startTime = new Date(starts_at).getTime()
                    const dailyRes = await fetch('https://api.daily.co/v1/rooms', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${dailyApiKey}` },
                        body: JSON.stringify({
                            properties: {
                                enable_recording: (recording_enabled ?? true) ? 'cloud' : false,
                                exp: Math.round(startTime / 1000) + ((duration_minutes || 60) * 60) + 7200
                            }
                        })
                    })
                    const dailyData = await dailyRes.json()
                    if (!dailyRes.ok) throw new Error(`Daily API Error: ${dailyData.info || dailyData.error}`)

                    const { data: meeting, error: rpcError } = await supabase.rpc('create_meeting', {
                        p_space_id: space_id,
                        p_title: title || 'Scheduled Meeting',
                        p_starts_at: starts_at,
                        p_duration_minutes: duration_minutes || 60,
                        p_description: description ?? null,
                        p_recording_enabled: recording_enabled ?? true,
                        p_daily_room_name: dailyData.name,
                        p_daily_room_url: dailyData.url,
                        p_is_instant: false,
                        p_meeting_type: 'scheduled'
                    })

                    if (rpcError) throw rpcError

                    return new Response(JSON.stringify({ data: meeting }), {
                        status: 201,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                // ── START_MEETING ──────────────────────────────────────────────
                case 'START_MEETING': {
                    if (!meeting_id) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'meeting_id' }))

                    const { data: meeting, error: rpcError } = await supabase.rpc('start_meeting', {
                        p_meeting_id: meeting_id,
                        p_daily_room_url: body.daily_room_url ?? null,
                        p_daily_room_name: body.daily_room_name ?? null
                    })

                    if (rpcError) throw rpcError

                    return new Response(JSON.stringify({ data: { meeting, roomUrl: meeting.daily_room_url } }), {
                        status: 200,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                // ── JOIN_MEETING ───────────────────────────────────────────────
                case 'JOIN_MEETING': {
                    if (!meeting_id) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'meeting_id' }))

                    // RPC verifies org access and inserts participant record
                    const { data: meeting, error: rpcError } = await supabase.rpc('join_meeting', {
                        p_meeting_id: meeting_id
                    })

                    if (rpcError) throw rpcError

                    return new Response(JSON.stringify({ data: { meeting, roomUrl: meeting.daily_room_url } }), {
                        status: 200,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                // ── GET_TOKEN ──────────────────────────────────────────────────
                case 'GET_TOKEN': {
                    if (!meeting_id) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'meeting_id' }))

                    // RPC verifies access and returns meeting (including daily_room_name)
                    const { data: meeting, error: rpcError } = await supabase.rpc('join_meeting', {
                        p_meeting_id: meeting_id
                    })

                    if (rpcError) throw rpcError

                    // External API: generate Daily.co participant token
                    const tokenRes = await fetch('https://api.daily.co/v1/meeting-tokens', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${dailyApiKey}` },
                        body: JSON.stringify({
                            properties: {
                                room_name: meeting.daily_room_name,
                                user_name: email,
                                is_owner: meeting.created_by === userId
                            }
                        })
                    })
                    const tokenData = await tokenRes.json()
                    if (!tokenRes.ok) throw new Error(`Daily Token Error: ${tokenData.info || tokenData.error}`)

                    return new Response(JSON.stringify({ data: { token: tokenData.token } }), {
                        status: 200,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                // ── END_MEETING ────────────────────────────────────────────────
                case 'END_MEETING': {
                    if (!meeting_id) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'meeting_id' }))

                    const { error: rpcError } = await supabase.rpc('end_meeting', {
                        p_meeting_id: meeting_id
                    })

                    if (rpcError) throw rpcError

                    return new Response(JSON.stringify({ success: true }), {
                        status: 200,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                // ── DELETE_MEETING (soft cancel) ───────────────────────────────
                case 'DELETE_MEETING': {
                    if (!meeting_id) return errorResponse(await hydrateError(supabase, 'VAL_MISSING_FIELD', { field: 'meeting_id' }))

                    const { error: rpcError } = await supabase.rpc('cancel_meeting', {
                        p_meeting_id: meeting_id
                    })

                    if (rpcError) throw rpcError

                    return new Response(JSON.stringify({ success: true }), {
                        status: 200,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                default:
                    return errorResponse(await hydrateError(supabase, 'VAL_INVALID_ACTION', { action }))
            }
        }

        return errorResponse(await hydrateError(supabase, 'METHOD_NOT_ALLOWED', { method: req.method }))

    } catch (error: any) {
        console.error('[meetings-api] Error:', error)
        const code = error.isStandard ? error.message
            : (error.code && typeof error.code === 'string') ? error.code
                : 'INTERNAL_ERROR'
        const richError = await hydrateError(supabaseClient, code, { original_error: error.message || String(error) })
        return errorResponse(richError)
    }
})
