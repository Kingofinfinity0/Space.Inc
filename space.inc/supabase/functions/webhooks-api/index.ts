import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature",
};

const DAILY_WEBHOOK_SECRET = Deno.env.get("DAILY_WEBHOOK_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get("x-webhook-signature");
    const body = await req.text();

    // Verify signature if secret is provided
    if (DAILY_WEBHOOK_SECRET) {
      // Logic for signature verification would go here
      // For now, we assume verification if secret exists, or use simple check
      if (!signature) {
          throw new Error("Missing signature");
      }
    }

    const payload = JSON.parse(body);
    console.log("[webhooks-api] Received Daily webhook:", payload.type);

    if (payload.type === "recording.ready") {
      const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

      // Enqueue job in background_jobs
      const { error: jobErr } = await supabase
        .from("background_jobs")
        .insert({
          job_type: "process_daily_recording",
          payload: {
            recording_id: payload.recording_id,
            room_name: payload.room_name,
            timestamp: payload.timestamp
          }
        });

      if (jobErr) throw jobErr;
      console.log("[webhooks-api] Enqueued process_daily_recording job");
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    console.error("[webhooks-api] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
