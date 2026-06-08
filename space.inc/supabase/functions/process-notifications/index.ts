import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_LIMIT = 50;
const MAX_RETRY_COUNT = 5;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") ?? "https://vero.inc";

type SupabaseClient = ReturnType<typeof createClient>;

type NotificationEvent = {
    id: string;
    source: "notification_queue" | "space_events";
    space_id: string | null;
    organization_id: string;
    actor_id: string | null;
    event_type: string;
    entity_type: string | null;
    entity_id: string | null;
    payload: Record<string, unknown>;
};

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    const workerId = crypto.randomUUID();

    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const queueResult = await processNotificationQueue(supabase, workerId);
        const eventResult = await processSpaceEvents(supabase, workerId);

        return new Response(JSON.stringify({
            success: true,
            worker: workerId,
            notification_queue: queueResult,
            space_events: eventResult,
            processed: queueResult.processed + eventResult.processed,
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

async function processNotificationQueue(supabase: SupabaseClient, workerId: string) {
    const { data: jobs, error } = await supabase
        .from("notification_queue")
        .select("*")
        .eq("status", "pending")
        .lte("next_attempt_at", new Date().toISOString())
        .limit(BATCH_LIMIT)
        .order("created_at", { ascending: true });

    if (error) throw error;

    let processed = 0;
    let failed = 0;

    for (const job of jobs ?? []) {
        const { data: locked, error: lockError } = await supabase
            .from("notification_queue")
            .update({
                status: "processing",
                locked_at: new Date().toISOString(),
                locked_by: workerId,
            })
            .eq("id", job.id)
            .eq("status", "pending")
            .select("id")
            .maybeSingle();

        if (lockError) {
            console.error(`[worker:${workerId}] Failed to lock queue job ${job.id}:`, lockError);
            failed += 1;
            continue;
        }

        if (!locked) {
            continue;
        }

        try {
            const event = normalizeQueueJob(job);
            const inserted = await dispatchEvent(event, supabase);

            await supabase
                .from("notification_queue")
                .update({
                    status: "done",
                    processed_at: new Date().toISOString(),
                    locked_at: null,
                    locked_by: null,
                    last_error: null,
                })
                .eq("id", job.id);

            processed += 1;
            console.log(`[worker:${workerId}] Queue job ${job.id} done, notifications=${inserted}`);
        } catch (jobError: any) {
            failed += 1;
            const retryCount = (job.retry_count ?? 0) + 1;
            const retryDelayMinutes = Math.min(2 ** retryCount, 60);

            await supabase
                .from("notification_queue")
                .update({
                    status: retryCount >= MAX_RETRY_COUNT ? "failed" : "pending",
                    retry_count: retryCount,
                    next_attempt_at: new Date(Date.now() + retryDelayMinutes * 60_000).toISOString(),
                    locked_at: null,
                    locked_by: null,
                    last_error: jobError?.message ?? String(jobError),
                })
                .eq("id", job.id);

            console.error(`[worker:${workerId}] Queue job ${job.id} failed:`, jobError);
        }
    }

    return { scanned: jobs?.length ?? 0, processed, failed };
}

async function processSpaceEvents(supabase: SupabaseClient, workerId: string) {
    const { data: events, error } = await supabase
        .from("space_events")
        .select("*")
        .is("processed_at", null)
        .limit(BATCH_LIMIT)
        .order("created_at", { ascending: true });

    if (error) throw error;

    let processed = 0;
    let failed = 0;

    for (const row of events ?? []) {
        try {
            const event = normalizeSpaceEvent(row);
            const inserted = await dispatchEvent(event, supabase);

            await supabase
                .from("space_events")
                .update({ processed_at: new Date().toISOString() })
                .eq("id", row.id);

            processed += 1;
            console.log(`[worker:${workerId}] Space event ${row.id} done, notifications=${inserted}`);
        } catch (eventError) {
            failed += 1;
            console.error(`[worker:${workerId}] Space event ${row.id} failed:`, eventError);
        }
    }

    return { scanned: events?.length ?? 0, processed, failed };
}

async function dispatchEvent(event: NotificationEvent, supabase: SupabaseClient) {
    if (event.event_type === "invitation.created" || event.event_type === "invitation_created") {
        await sendInvitationEmail(event);
        return 0;
    }

    const recipientIds = await resolveRecipientIds(event, supabase);
    const message = buildNotificationMessage(event);
    const notificationType = getNotificationType(event.event_type);
    const eventSeverity = event.event_type.includes("critical") ? "critical" : "general";
    let inserted = 0;

    for (const recipientId of recipientIds) {
        const { data: notification, error } = await supabase
            .from("notifications")
            .insert({
                recipient_id: recipientId,
                organization_id: event.organization_id,
                space_id: event.space_id,
                type: notificationType,
                message,
                read: false,
                read_at: null,
                event_id: event.source === "space_events" ? event.id : null,
                event_severity: eventSeverity,
                entity_type: event.entity_type,
                entity_id: event.entity_id,
                payload: event.payload,
                delivery_status: "pending",
            })
            .select("id")
            .single();

        if (error) {
            console.error(`[worker] Error notifying recipient ${recipientId}:`, error);
            continue;
        }

        inserted += 1;

        try {
            const channel = supabase.channel(`notifications:${recipientId}`);
            await channel.send({
                type: "broadcast",
                event: "new_notification",
                payload: {
                    id: notification.id,
                    title: event.event_type,
                    message,
                    severity: eventSeverity,
                },
            });
        } catch (broadcastError) {
            console.warn(`[worker] Realtime broadcast failed for ${recipientId}:`, broadcastError);
        }
    }

    return inserted;
}

async function resolveRecipientIds(event: NotificationEvent, supabase: SupabaseClient) {
    const recipients = new Set<string>();

    if (event.space_id) {
        const { data: members, error } = await supabase
            .from("space_memberships")
            .select("profile_id")
            .eq("space_id", event.space_id)
            .or("is_active.eq.true,status.eq.active");

        if (error) throw error;

        for (const member of members ?? []) {
            if (member.profile_id && member.profile_id !== event.actor_id) {
                recipients.add(member.profile_id);
            }
        }
    } else if (event.organization_id) {
        const { data: orgMembers, error } = await supabase
            .from("org_memberships")
            .select("user_id")
            .eq("organization_id", event.organization_id)
            .eq("status", "active");

        if (error) throw error;

        for (const member of orgMembers ?? []) {
            if (member.user_id && member.user_id !== event.actor_id) {
                recipients.add(member.user_id);
            }
        }
    }

    const assigneeId = event.payload?.assignee_id;
    if (typeof assigneeId === "string" && assigneeId !== event.actor_id) {
        recipients.add(assigneeId);
    }

    return [...recipients];
}

async function sendInvitationEmail(event: NotificationEvent) {
    const email = stringPayload(event.payload, "email");
    const role = stringPayload(event.payload, "role") ?? "member";
    const token = stringPayload(event.payload, "raw_token") ?? stringPayload(event.payload, "token");
    const inviteId = stringPayload(event.payload, "invite_id") ?? event.entity_id ?? event.id;

    if (!email || !token) {
        throw new Error("Missing email or token in invitation event payload");
    }

    if (!RESEND_API_KEY) {
        console.warn("[worker] RESEND_API_KEY not set; skipping invitation email send.");
        return;
    }

    const inviteLink = `${FRONTEND_URL}/invite/${token}`;
    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            from: "Vero <noreply@vero.inc>",
            to: [email],
            subject: `You've been invited to join as ${role}`,
            html: `
                <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                    <h2 style="color: #1a1a2e;">You're invited</h2>
                    <p>You've been invited to join a client space as <strong>${role}</strong>.</p>
                    <p>Click the button below to accept your invitation. This link expires in <strong>7 days</strong>.</p>
                    <a href="${inviteLink}" style="display:inline-block; margin-top:16px; padding:12px 24px; background:#6366f1; color:#fff; text-decoration:none; border-radius:8px; font-weight:600;">
                        Accept Invitation
                    </a>
                    <p style="margin-top:24px; font-size:12px; color:#888;">
                        If you did not expect this, you can safely ignore this email.<br/>
                        Invite ID: ${inviteId}
                    </p>
                </div>
            `,
        }),
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Resend API error ${response.status}: ${body}`);
    }
}

function normalizeQueueJob(job: any): NotificationEvent {
    return {
        id: job.id,
        source: "notification_queue",
        space_id: job.space_id ?? null,
        organization_id: job.organization_id,
        actor_id: job.initiator_id ?? null,
        event_type: job.event_type,
        entity_type: job.entity_type ?? inferEntityType(job.event_type),
        entity_id: job.entity_id ?? null,
        payload: job.payload ?? {},
    };
}

function normalizeSpaceEvent(row: any): NotificationEvent {
    const payload = row.payload ?? {};

    return {
        id: row.id,
        source: "space_events",
        space_id: row.space_id ?? null,
        organization_id: row.organization_id,
        actor_id: row.actor_id ?? null,
        event_type: row.event_type,
        entity_type: payload.entity_type ?? inferEntityType(row.event_type),
        entity_id: payload.entity_id ?? payload.message_id ?? null,
        payload,
    };
}

function getNotificationType(eventType: string) {
    switch (eventType) {
        case "message.created":
            return "message_received";
        case "meeting.created":
            return "meeting_scheduled";
        case "meeting.ended":
            return "meeting_ended";
        case "file.created":
        case "file.uploaded":
            return "file_uploaded";
        case "task.created":
            return "task_assigned";
        case "task.updated":
            return "task_update";
        case "space.created":
        case "space.updated":
            return "space_update";
        case "invitation.created":
        case "invitation_created":
            return "invitation_received";
        default:
            return "system";
    }
}

function buildNotificationMessage(event: NotificationEvent) {
    const title = stringPayload(event.payload, "title");
    const content = stringPayload(event.payload, "content");

    switch (event.event_type) {
        case "message.created":
            return content ? `New message: ${content}` : "New message";
        case "meeting.created":
            return title ? `Meeting scheduled: ${title}` : "Meeting scheduled";
        case "meeting.ended":
            return title ? `Meeting ended: ${title}` : "Meeting ended";
        case "task.created":
            return title ? `Task assigned: ${title}` : "Task assigned";
        case "task.updated":
            return title ? `Task updated: ${title}` : "Task updated";
        case "file.created":
        case "file.uploaded":
            return title ? `File uploaded: ${title}` : "File uploaded";
        case "space.created":
            return title ? `New space: ${title}` : "New space created";
        default:
            return title || content || `New ${event.entity_type ?? "event"}`;
    }
}

function inferEntityType(eventType: string) {
    return eventType.split(".")[0] || "event";
}

function stringPayload(payload: Record<string, unknown>, key: string) {
    const value = payload?.[key];
    return typeof value === "string" && value.trim() ? value : null;
}
