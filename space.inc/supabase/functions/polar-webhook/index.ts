import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { Buffer } from "node:buffer";

/**
 * THIN GATEWAY (V2) - Polar.sh ASYNC Webhook
 * 
 * 1. Reads raw payload
 * 2. Authenticates HMAC Signature (No spoofed payloads allowed)
 * 3. Dumps into `background_jobs` with Idempotency Key
 * 4. Yields 200 OK fast
 */

async function verifyHMAC(req: Request, secret: string) {
    if (!secret) throw new Error("POLAR_WEBHOOK_SECRET missing in environment");

    const signatureStr = req.headers.get("webhook-signature");
    if (!signatureStr) return false;

    // Parse specific signature components for Polar: t=timestamp, v1=signature
    const parts = signatureStr.split(',').reduce((acc, part) => {
        const [k, v] = part.split('=');
        if (k && v) acc[k.trim()] = v.trim();
        return acc;
    }, {} as Record<string, string>);

    if (!parts.t || !parts.v1) return false;

    // Fast fail for stale webhooks (> 5 mins = replay attack)
    const timestampMs = parseInt(parts.t, 10) * 1000;
    if (Date.now() - timestampMs > 5 * 60 * 1000) return false;

    // Reconstruct the message: timestamp + "." + body string
    const clone = req.clone();
    const rawBody = await clone.text();
    const message = `${parts.t}.${rawBody}`;

    // Calculate our own HMAC SHA256 using Crypto Web API
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        enc.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify", "sign"]
    );
    const buffer = await crypto.subtle.sign("HMAC", key, enc.encode(message));

    // Hex stringification
    const hashHex = Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex === parts.v1;
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
    }

    try {
        console.log(`[polar-webhook] Incoming webhook`);

        // Check the HMAC before doing ANYTHING
        const valid = await verifyHMAC(req, Deno.env.get('POLAR_WEBHOOK_SECRET') || '');
        if (!valid) {
            console.warn('[polar-webhook] Invalid or missing HMAC signature');
            return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
        }

        const payload = await req.json();

        // Supabase Client for writing to DB
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !supabaseKey) {
            throw new Error("Missing Supabase configuration");
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Write to asynchronous jobs table. We specify an idempotency_key to automatically silently drop replays!
        const { error: insertError } = await supabase.from('background_jobs').insert({
            job_type: 'billing_sync',
            status: 'pending',
            payload: payload,
            idempotency_key: payload.id // Polar event ID is universally unique and stable across retries
        });

        if (insertError) {
            // Unique constraint violations (code 23505) mean we've already received this webhook EVENT ID.
            // That's an idempotent success, no need to fail the webhook.
            if (insertError.code === '23505') {
                console.log(`[polar-webhook] Idempotent drop - already processed ${payload.id}`);
                return new Response('OK', { status: 200 });
            }
            throw insertError;
        }

        console.log(`[polar-webhook] Successfully queued job for event ${payload.id}`);
        return new Response('OK', { status: 200 });

    } catch (error: any) {
        console.error('[polar-webhook] Fatal error:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
})
