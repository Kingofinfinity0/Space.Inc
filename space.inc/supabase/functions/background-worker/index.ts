// background-worker/index.ts
// Processes background_jobs queue — handles send_email jobs via Resend
// Triggered by pg_cron every 60s or manually via HTTP POST

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
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
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") ?? "https://space-inc.vercel.app";
const BATCH_SIZE = 10;

// From-address: once you verify a domain in Resend, change this to
// e.g. "Space.inc <invites@yourdomain.com>"
// Until then, onboarding@resend.dev works for testing.
const FROM_ADDRESS = "Space.inc <onboarding@resend.dev>";

// ── Template engine ───────────────────────────────────────────────────────────
function renderTemplate(
    template: string,
    vars: Record<string, string>
): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

// ── Resend dispatch ───────────────────────────────────────────────────────────
async function sendViaResend(
    to: string,
    subject: string,
    html: string
): Promise<{ success: boolean; status: number; error?: string }> {
    if (!RESEND_API_KEY) {
        return { success: false, status: 500, error: "RESEND_API_KEY not set in Supabase Vault" };
    }

    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html }),
    });

    if (res.ok) {
        return { success: true, status: res.status };
    }

    const body = await res.text().catch(() => "");
    return { success: false, status: res.status, error: body };
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const workerId = crypto.randomUUID().slice(0, 8);
    const results: Record<string, string>[] = [];

    try {
        // 1. Claim pending send_email jobs scheduled for now or earlier
        const { data: jobs, error: fetchErr } = await supabase
            .from("background_jobs")
            .select("*")
            .eq("status", "pending")
            .eq("job_type", "send_email")
            .lte("scheduled_at", new Date().toISOString())
            .order("created_at", { ascending: true })
            .limit(BATCH_SIZE);

        if (fetchErr) throw fetchErr;
        if (!jobs || jobs.length === 0) {
            return new Response(
                JSON.stringify({ worker: workerId, message: "No pending email jobs." }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`[worker:${workerId}] Processing ${jobs.length} email jobs`);

        for (const job of jobs) {
            // Mark as processing immediately to prevent double-send
            await supabase
                .from("background_jobs")
                .update({ status: "processing", started_at: new Date().toISOString() })
                .eq("id", job.id);

            try {
                const p = job.payload as {
                    type: string;
                    to: string;
                    token: string;
                    role: string;
                    invitation_id: string;
                    org_id: string;
                    invited_by_id: string;
                    space_id?: string;
                };

                if (!p.to || !p.token || !p.type) {
                    throw new Error(`Invalid payload: ${JSON.stringify(p)}`);
                }

                // 2. Fetch inviter name + org name
                const [{ data: inviter }, { data: org }] = await Promise.all([
                    supabase
                        .from("profiles")
                        .select("full_name, email")
                        .eq("id", p.invited_by_id)
                        .single(),
                    supabase
                        .from("organizations")
                        .select("name")
                        .eq("id", p.org_id)
                        .single(),
                ]);

                const inviterName =
                    inviter?.full_name ?? inviter?.email?.split("@")[0] ?? "Your team";
                const orgName = org?.name ?? "Space.inc";

                // 3. Fetch template — org-specific first, then global default
                let template = null;

                const { data: orgTemplate } = await supabase
                    .from("email_templates")
                    .select("subject, html_body")
                    .eq("organization_id", p.org_id)
                    .eq("template_key", p.type)
                    .maybeSingle();

                if (orgTemplate) {
                    template = orgTemplate;
                } else {
                    const { data: defaultTemplate } = await supabase
                        .from("email_templates")
                        .select("subject, html_body")
                        .is("organization_id", null)
                        .eq("template_key", p.type)
                        .eq("is_default", true)
                        .maybeSingle();
                    template = defaultTemplate;
                }

                if (!template) {
                    throw new Error(`No template found for type: ${p.type}`);
                }

                // 4. Build invite link + render template
                const inviteLink = `${FRONTEND_URL}/join?token=${p.token}`;
                const vars = {
                    invite_link: inviteLink,
                    inviter_name: inviterName,
                    org_name: orgName,
                    role: p.role ?? "member",
                };

                const subject = renderTemplate(template.subject, vars);
                const html = renderTemplate(template.html_body, vars);

                // 5. Send via Resend
                console.log(`[worker:${workerId}] Sending ${p.type} to ${p.to}`);
                const sendResult = await sendViaResend(p.to, subject, html);

                if (sendResult.success) {
                    // Mark completed
                    await supabase
                        .from("background_jobs")
                        .update({
                            status: "completed",
                            completed_at: new Date().toISOString(),
                            attempts: (job.attempts ?? 0) + 1,
                        })
                        .eq("id", job.id);

                    results.push({ id: job.id, status: "completed", to: p.to });
                    console.log(`[worker:${workerId}] ✅ Sent to ${p.to}`);

                } else if (sendResult.status === 429) {
                    // Rate limited — reschedule for next day, don't count as failure
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    tomorrow.setHours(0, 5, 0, 0); // 00:05 next day

                    await supabase
                        .from("background_jobs")
                        .update({
                            status: "pending",
                            scheduled_at: tomorrow.toISOString(),
                            last_error: "Resend 429: rate limit. Rescheduled for next day.",
                        })
                        .eq("id", job.id);

                    results.push({ id: job.id, status: "rate_limited", to: p.to });
                    console.warn(`[worker:${workerId}] ⚠️ Rate limited — rescheduled: ${p.to}`);

                } else {
                    // Real failure
                    throw new Error(
                        `Resend error ${sendResult.status}: ${sendResult.error}`
                    );
                }
            } catch (jobErr: unknown) {
                const errMsg = jobErr instanceof Error ? jobErr.message : String(jobErr);
                console.error(`[worker:${workerId}] ❌ Job ${job.id} failed:`, errMsg);

                const nextAttempts = (job.attempts ?? 0) + 1;
                const isDead = nextAttempts >= (job.max_attempts ?? 3);

                await supabase
                    .from("background_jobs")
                    .update({
                        status: isDead ? "dead_letter" : "pending",
                        last_error: errMsg,
                        attempts: nextAttempts,
                        // Exponential backoff: 5min, 15min, 45min
                        scheduled_at: isDead
                            ? job.scheduled_at
                            : new Date(
                                Date.now() + Math.pow(3, nextAttempts - 1) * 5 * 60 * 1000
                            ).toISOString(),
                    })
                    .eq("id", job.id);

                results.push({ id: job.id, status: isDead ? "dead_letter" : "retry", error: errMsg });
            }
        }

        return new Response(
            JSON.stringify({
                worker: workerId,
                processed: jobs.length,
                results,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[worker:${workerId}] Critical error:`, msg);
        return new Response(
            JSON.stringify({ error: msg, worker: workerId }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});