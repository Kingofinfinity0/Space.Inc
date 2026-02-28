// process-notifications/index.ts — AGENT 1: SaaS-Grade Worker Upgrade
// Changes:
//   - FOR UPDATE SKIP LOCKED via raw SQL (prevents double-processing across multiple workers)
//   - Exponential backoff: 2^retry_count minutes between retries
//   - locked_at + locked_by tracking per job
//   - last_error stored on failure
//   - Handles 'invitation_created' event specifically (Resend email dispatch)
//   - Worker ID generated per-invocation for traceability

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") ?? "https://nexus-portal.inc";
const BATCH_LIMIT = 20;
const RATE_LIMIT_HOURS = 1;
const MAX_RETRY_COUNT = 5;

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    // Unique worker ID per invocation — for locked_by tracing
    const workerId = crypto.randomUUID();

    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // ── Step 1: Claim pending jobs atomically using FOR UPDATE SKIP LOCKED ──
        // This is the critical SaaS pattern that prevents double-processing across
        // horizontally scaled workers. If another worker has a row locked, we skip it.
        const claimResult = await supabase.rpc("claim_notification_jobs", {
            p_worker_id: workerId,
            p_batch: BATCH_LIMIT
        });

        // Fallback: if the RPC doesn't exist yet, use a simpler query
        // In production, the RPC is preferred for atomicity
        let jobs: any[] = [];

        if (claimResult.error || !claimResult.data) {
            // Graceful fallback: fetch pending jobs not currently locked
            const { data: fallbackJobs, error: fetchError } = await supabase
                .from("notification_queue")
                .select("*")
                .eq("status", "pending")
                .lte("next_attempt_at", new Date().toISOString())
                .is("locked_at", null)
                .limit(BATCH_LIMIT);

            if (fetchError) throw fetchError;
            jobs = fallbackJobs ?? [];

            // Mark them as processing + lock
            if (jobs.length > 0) {
                await supabase
                    .from("notification_queue")
                    .update({
                        status: "processing",
                        locked_at: new Date().toISOString(),
                        locked_by: workerId
                    })
                    .in("id", jobs.map((j: any) => j.id));
            }
        } else {
            jobs = claimResult.data ?? [];
        }

        if (!jobs || jobs.length === 0) {
            return new Response(JSON.stringify({ message: "No pending notifications.", worker: workerId }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        console.log(`[worker:${workerId}] Processing ${jobs.length} jobs.`);

        const results: { id: string; status: string; event: string }[] = [];

        for (const job of jobs) {
            let succeeded = false;
            let lastError = "";

            try {
                // ── Route by event_type ──────────────────────────────────────
                if (job.event_type === "invitation_created") {
                    await handleInvitationCreated(job, supabase);
                    succeeded = true;
                } else {
                    // Generic: deliver in-app notifications to space members
                    await handleGenericSpaceEvent(job, supabase);
                    succeeded = true;
                }

            } catch (jobErr: any) {
                lastError = jobErr?.message ?? String(jobErr);
                console.error(`[worker:${workerId}] Job ${job.id} failed:`, lastError);
            }

            // ── Update job status ────────────────────────────────────────
            if (succeeded) {
                await supabase
                    .from("notification_queue")
                    .update({
                        status: "done",
                        processed_at: new Date().toISOString(),
                        locked_at: null,
                        locked_by: null,
                        last_error: null
                    })
                    .eq("id", job.id);

                results.push({ id: job.id, status: "done", event: job.event_type });
            } else {
                const newRetryCount = (job.retry_count ?? 0) + 1;

                if (newRetryCount >= MAX_RETRY_COUNT) {
                    // Dead-letter: give up after MAX_RETRY_COUNT attempts
                    await supabase
                        .from("notification_queue")
                        .update({
                            status: "failed",
                            retry_count: newRetryCount,
                            last_error: lastError,
                            locked_at: null,
                            locked_by: null
                        })
                        .eq("id", job.id);

                    results.push({ id: job.id, status: "failed", event: job.event_type });
                } else {
                    // Exponential backoff: 2^retry_count minutes
                    const backoffMs = Math.pow(2, newRetryCount) * 60 * 1000;
                    const nextAttempt = new Date(Date.now() + backoffMs);

                    await supabase
                        .from("notification_queue")
                        .update({
                            status: "pending",
                            retry_count: newRetryCount,
                            next_attempt_at: nextAttempt.toISOString(),
                            last_error: lastError,
                            locked_at: null,
                            locked_by: null
                        })
                        .eq("id", job.id);

                    results.push({ id: job.id, status: "retry", event: job.event_type });
                }
            }
        }

        return new Response(JSON.stringify({
            success: true,
            worker: workerId,
            processed: jobs.length,
            results
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error: any) {
        console.error(`[worker:${workerId}] Critical Error:`, error);
        return new Response(JSON.stringify({ error: error.message, worker: workerId }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER: invitation_created
// Reads raw_token from payload (it lives ONLY in the queue — never in invitations table)
// Sends invitation email via Resend
// ─────────────────────────────────────────────────────────────────────────────
async function handleInvitationCreated(job: any, _supabase: any) {
    const { email, role, raw_token, invite_id } = job.payload ?? {};

    if (!email || !raw_token) {
        throw new Error("Missing email or raw_token in invitation_created payload");
    }

    const inviteLink = `${FRONTEND_URL}/join?token=${raw_token}`;

    const emailBody = {
        from: "SpaceInc <noreply@nexus-portal.inc>",
        to: [email],
        subject: `You've been invited to join as ${role}`,
        html: `
          <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #1a1a2e;">You're invited!</h2>
            <p>You've been invited to join a client space as <strong>${role}</strong>.</p>
            <p>Click the button below to accept your invitation. This link expires in <strong>7 days</strong>.</p>
            <a href="${inviteLink}"
               style="display:inline-block; margin-top:16px; padding:12px 24px;
                      background:#6366f1; color:#fff; text-decoration:none;
                      border-radius:8px; font-weight:600;">
              Accept Invitation
            </a>
            <p style="margin-top:24px; font-size:12px; color:#888;">
              If you didn't expect this, you can safely ignore this email.<br/>
              Invite ID: ${invite_id}
            </p>
          </div>
        `
    };

    if (!RESEND_API_KEY) {
        console.warn("[worker] RESEND_API_KEY not set — skipping email send (dev mode)");
        return;
    }

    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(emailBody)
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Resend API error ${res.status}: ${errText}`);
    }

    console.log(`[worker] Invitation email sent to ${email} (invite: ${invite_id})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER: Generic space events (message, file, meeting, task, etc.)
// Resolves recipients from space_memberships, inserts in-app notifications,
// and broadcasts via Realtime
// ─────────────────────────────────────────────────────────────────────────────
async function handleGenericSpaceEvent(job: any, supabase: any) {
    let recipientIds: string[] = [];

    if (job.space_id) {
        const { data: members } = await supabase
            .from("space_memberships")
            .select("profile_id")
            .eq("space_id", job.space_id)
            .eq("is_active", true);

        recipientIds = (members ?? [])
            .map((m: any) => m.profile_id)
            .filter((id: string) => id !== job.initiator_id);
    } else if (job.organization_id) {
        // Org-level: notify org members
        const { data: orgMembers } = await supabase
            .from("org_memberships")
            .select("user_id")
            .eq("organization_id", job.organization_id)
            .eq("status", "active");

        recipientIds = (orgMembers ?? [])
            .map((m: any) => m.user_id)
            .filter((id: string) => id !== job.initiator_id);
    }

    const eventSeverity = job.event_type.includes("critical") ? "critical" : "general";

    for (const userId of recipientIds) {
        const { error: notifyError } = await supabase.from("notifications").insert({
            user_id: userId,
            space_id: job.space_id,
            organization_id: job.organization_id,
            type: job.event_type,
            message: `New ${job.entity_type}: ${job.payload?.content || job.payload?.title || ""}`,
            event_severity: eventSeverity,
            entity_type: job.entity_type,
            entity_id: job.entity_id,
            payload: job.payload,
            delivery_status: "pending"
        });

        if (notifyError) {
            console.error(`[worker] Error notifying user ${userId}:`, notifyError);
            continue;
        }

        // Realtime broadcast
        const channel = supabase.channel(`notifications:${userId}`);
        await channel.send({
            type: "broadcast",
            event: "new_notification",
            payload: {
                id: job.id,
                title: job.event_type,
                message: `New ${job.entity_type}: ${job.payload?.content || job.payload?.title || ""}`,
                severity: eventSeverity
            }
        });
    }
}
