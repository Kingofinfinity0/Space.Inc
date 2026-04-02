import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

// ── Config ────────────────────────────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const DAILY_API_KEY = Deno.env.get("DAILY_API_KEY") ?? "";
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") ?? "https://space-inc.vercel.app";
const BATCH_SIZE = 10;
const FROM_ADDRESS = "Space.inc <onboarding@resend.dev>";

// ── Helpers ───────────────────────────────────────────────────────────────────
function renderTemplate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

async function sendViaResend(to: string, subject: string, html: string): Promise<{ success: boolean; status: number; error?: string }> {
    if (!RESEND_API_KEY) return { success: false, status: 500, error: "RESEND_API_KEY not set" };
    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html }),
    });
    if (res.ok) return { success: true, status: res.status };
    return { success: false, status: res.status, error: await res.text().catch(() => "") };
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const workerId = crypto.randomUUID().slice(0, 8);
    const results: any[] = [];

    try {
        const { data: jobs, error: fetchErr } = await supabase
            .from("background_jobs")
            .select("*")
            .eq("status", "pending")
            .in("job_type", ["send_email", "process_daily_recording"])
            .lte("scheduled_at", new Date().toISOString())
            .order("created_at", { ascending: true })
            .limit(BATCH_SIZE);

        if (fetchErr) throw fetchErr;
        if (!jobs || jobs.length === 0) return new Response(JSON.stringify({ worker: workerId, message: "No jobs." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

        for (const job of jobs) {
            await supabase.from("background_jobs").update({ status: "processing", started_at: new Date().toISOString() }).eq("id", job.id);

            try {
                if (job.job_type === "send_email") {
                    const p = job.payload as any;
                    const [{ data: inviter }, { data: org }] = await Promise.all([
                        supabase.from("profiles").select("full_name, email").eq("id", p.invited_by_id).single(),
                        supabase.from("organizations").select("name").eq("id", p.org_id).single(),
                    ]);

                    const { data: template } = await supabase.from("email_templates").select("subject, html_body")
                        .eq("organization_id", p.org_id).eq("template_key", p.type).maybeSingle()
                        || await supabase.from("email_templates").select("subject, html_body")
                        .is("organization_id", null).eq("template_key", p.type).eq("is_default", true).maybeSingle();

                    if (!template) throw new Error(`No template for ${p.type}`);

                    const vars = {
                        invite_link: `${FRONTEND_URL}/join?token=${p.token}`,
                        inviter_name: inviter?.full_name ?? "Your team",
                        org_name: org?.name ?? "Space.inc",
                        role: p.role ?? "member",
                    };

                    const sendResult = await sendViaResend(p.to, renderTemplate(template.subject, vars), renderTemplate(template.html_body, vars));
                    if (!sendResult.success) throw new Error(`Resend error ${sendResult.status}: ${sendResult.error}`);

                    await supabase.from("background_jobs").update({ status: "completed", completed_at: new Date().toISOString(), attempts: (job.attempts ?? 0) + 1 }).eq("id", job.id);
                    results.push({ id: job.id, status: "completed" });
                }
                else if (job.job_type === "process_daily_recording") {
                    const p = job.payload as { recording_id: string; room_name: string };
                    const dailyRes = await fetch(`https://api.daily.co/v1/recordings/${p.recording_id}`, { headers: { Authorization: `Bearer ${DAILY_API_KEY}` } });
                    if (!dailyRes.ok) throw new Error(`Daily API error: ${await dailyRes.text()}`);
                    const recordingData = await dailyRes.json();

                    const { data: meeting } = await supabase.from("meetings").select("id, space_id").eq("daily_room_name", p.room_name).order("created_at", { ascending: false }).limit(1).single();
                    if (!meeting) throw new Error(`Meeting not found for room ${p.room_name}`);

                    const storagePath = `${meeting.space_id}/${p.recording_id}.mp4`;
                    const fileRes = await fetch(recordingData.download_url);
                    if (!fileRes.ok) throw new Error(`Failed to download recording`);

                    const { error: uploadErr } = await supabase.storage.from("meeting-recordings").upload(storagePath, await fileRes.blob(), { contentType: "video/mp4", upsert: true });
                    if (uploadErr) throw uploadErr;

                    const { data: publicUrlData } = supabase.storage.from("meeting-recordings").getPublicUrl(storagePath);
                    await supabase.rpc("update_meeting_recording", { p_meeting_id: meeting.id, p_recording_url: publicUrlData.publicUrl });
                    await fetch(`https://api.daily.co/v1/recordings/${p.recording_id}`, { method: "DELETE", headers: { Authorization: `Bearer ${DAILY_API_KEY}` } });

                    await supabase.from("background_jobs").update({ status: "completed", completed_at: new Date().toISOString(), attempts: (job.attempts ?? 0) + 1 }).eq("id", job.id);
                    results.push({ id: job.id, status: "completed" });
                }
            } catch (err: any) {
                await supabase.from("background_jobs").update({ status: "failed", last_error: err.message, attempts: (job.attempts ?? 0) + 1 }).eq("id", job.id);
                results.push({ id: job.id, status: "failed", error: err.message });
            }
        }
        return new Response(JSON.stringify({ worker: workerId, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
});
