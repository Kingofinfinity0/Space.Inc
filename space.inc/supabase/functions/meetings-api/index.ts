// meetings-api/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { corsHeaders, getAuthContext } from 'shared/auth.ts'

/**
 * meetings-api - GROUND ZERO RESET
 * Strictly follows the Standardized Guide.
 */

// Utility for HMAC verification (Specific to meetings-api)
async function verifyDailyWebhook(req: Request, secret: string): Promise<boolean> {
    const signature = req.headers.get('X-Webhook-Signature');
    const timestamp = req.headers.get('X-Webhook-Timestamp');
    if (!signature || !timestamp || !secret) return false;

    const rawBody = await req.clone().text();
    const dataToVerify = `${timestamp}.${rawBody}`;

    try {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secret);
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
        );

        const signatureBytes = new Uint8Array(
            signature.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
        );

        return await crypto.subtle.verify(
            'HMAC',
            cryptoKey,
            signatureBytes,
            encoder.encode(dataToVerify)
        );
    } catch (err) {
        console.error('Webhook verification error:', err);
        return false;
    }
}

serve(async (req: Request) => {
    // 1. Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const dailyApiKey = Deno.env.get('DAILY_API_KEY') ?? ''
        const webhookSecret = Deno.env.get('DAILY_WEBHOOK_SECRET') ?? ''
        const url = new URL(req.url)

        // --- WEBHOOK HANDLING (UNAUTHENTICATED) ---
        if (url.pathname.endsWith('/webhook')) {
            console.log('[meetings-api] Handling webhook');
            const body = await req.json();
            const isValid = await verifyDailyWebhook(req, webhookSecret);
            if (!isValid) throw new Error('Invalid webhook signature');

            const { type, payload } = body;
            const meetingId = payload.room_name?.includes('meeting-') ? payload.room_name.split('-')[1] : null;

            // Re-using service role for webhook updates (bypasses RLS)
            const supabaseAdmin = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            )

            if (type === 'recording.ready_to_download' && meetingId) {
                const { data: recData, error: recError } = await supabaseAdmin.from('recordings').insert({
                    meeting_id: meetingId,
                    daily_recording_id: payload.recording_id,
                    download_url: payload.download_url,
                    status: 'ready'
                }).select().single();

                if (!recError && recData) {
                    await supabaseAdmin.from('meetings').update({ recording_id: recData.id }).eq('id', meetingId);
                }
            }
            return new Response(JSON.stringify({ received: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // --- AUTHENTICATED ROUTES ---
        // 2. Extract Auth Context (Identity & RLS Client)
        const { userId, email, supabase } = await getAuthContext(req);

        // 3. Resolve Profile Context (Explicitly as per Guide)
        const { data: profile, error: profError } = await supabase
            .from('profiles')
            .select('organization_id, role')
            .eq('id', userId)
            .single()

        if (profError || !profile) {
            throw new Error('Profile not found or access denied')
        }

        const { organization_id: orgId, role } = profile

        // 4. Route logic
        if (req.method === 'GET') {
            const spaceId = url.searchParams.get('spaceId')
            let query = supabase.from('meetings').select('*').eq('organization_id', orgId).is('deleted_at', null)
            if (spaceId) query = query.eq('space_id', spaceId)

            const { data: meetings, error } = await query.order('starts_at', { ascending: false })
            if (error) throw error
            return new Response(JSON.stringify({ data: meetings }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        if (req.method === 'POST') {
            const body = await req.json()
            const { action, meetingId } = body

            const getMeeting = async (mid: string) => {
                const { data, error } = await supabase
                    .from('meetings')
                    .select('*')
                    .eq('id', mid)
                    .eq('organization_id', orgId)
                    .single()
                if (error || !data) throw new Error('Meeting not found')
                return data
            }

            switch (action) {
                case 'CREATE_INSTANT_MEETING': {
                    const { title, space_id, description, recording_enabled } = body

                    // Daily-First Transaction
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

                    const { data: meeting, error: dbError } = await supabase
                        .from('meetings')
                        .insert({
                            organization_id: orgId,
                            space_id,
                            title: title || 'Instant Meeting',
                            starts_at: new Date().toISOString(),
                            duration_minutes: 60,
                            created_by: userId,
                            status: 'live',
                            started_at: new Date().toISOString(),
                            description,
                            recording_enabled: recording_enabled ?? true,
                            daily_room_name: dailyData.name,
                            daily_room_url: dailyData.url
                        })
                        .select().single()

                    if (dbError) throw dbError

                    return new Response(JSON.stringify({ data: { meeting, roomUrl: dailyData.url } }), {
                        status: 201,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                case 'CREATE_SCHEDULED_MEETING': {
                    const { title, space_id, starts_at, duration_minutes, description, recording_enabled } = body

                    // Daily-First Transaction
                    const startTime = new Date(starts_at).getTime();
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

                    const { data: meeting, error: dbError } = await supabase
                        .from('meetings')
                        .insert({
                            organization_id: orgId,
                            space_id,
                            title: title || 'Scheduled Meeting',
                            starts_at,
                            duration_minutes: duration_minutes || 60,
                            created_by: userId,
                            status: 'scheduled',
                            description,
                            recording_enabled: recording_enabled ?? true,
                            daily_room_name: dailyData.name,
                            daily_room_url: dailyData.url
                        })
                        .select().single()

                    if (dbError) throw dbError

                    return new Response(JSON.stringify({ data: meeting }), {
                        status: 201,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                case 'START_MEETING': {
                    await getMeeting(meetingId) // Verify access
                    const { data, error } = await supabase
                        .from('meetings')
                        .update({ status: 'live', started_at: new Date().toISOString() })
                        .eq('id', meetingId)
                        .select()
                        .single()

                    if (error) throw error
                    return new Response(JSON.stringify({ data: { meeting: data, roomUrl: data.daily_room_url } }), {
                        status: 200,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                case 'JOIN_MEETING': {
                    const meeting = await getMeeting(meetingId)
                    return new Response(JSON.stringify({ data: { meeting, roomUrl: meeting.daily_room_url } }), {
                        status: 200,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                case 'GET_TOKEN': {
                    const meeting = await getMeeting(meetingId)

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

                case 'UPDATE_MEETING': {
                    const { updates } = body
                    const { data, error } = await supabase
                        .from('meetings')
                        .update(updates)
                        .eq('id', meetingId)
                        .eq('organization_id', orgId)
                        .select()
                        .single()
                    if (error) throw error
                    return new Response(JSON.stringify({ data }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                case 'END_MEETING': {
                    const { data, error } = await supabase
                        .from('meetings')
                        .update({ status: 'ended', ended_at: new Date().toISOString() })
                        .eq('id', meetingId)
                        .eq('organization_id', orgId)
                        .select()
                        .single()
                    if (error) throw error
                    return new Response(JSON.stringify({ data }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                case 'DELETE_MEETING': {
                    const { error } = await supabase
                        .from('meetings')
                        .update({ deleted_at: new Date().toISOString() })
                        .eq('id', meetingId)
                        .eq('organization_id', orgId)
                    if (error) throw error
                    return new Response(JSON.stringify({ success: true }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                }

                default:
                    throw new Error(`Action ${action} not implemented`)
            }
        }

        throw new Error(`Method ${req.method} not allowed`)

    } catch (error: any) {
        console.error('[meetings-api] Error:', error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            status: error.status || 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
