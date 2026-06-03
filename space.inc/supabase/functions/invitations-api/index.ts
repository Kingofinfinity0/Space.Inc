// invitations-api/index.ts — Thin Gateway V4
// Changes from V3:
//   - After creating invitation, calls resend-api edge function directly
//   - No more background_jobs indirection for email sending
//   - validate now correctly passes p_token
//   - accept now correctly passes p_token

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  getAuthContext,
  hydrateError,
  errorResponse,
} from "shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// ── Helper: call resend-api to dispatch the email ─────────────────────────────
async function dispatchEmail(params: {
  to: string;
  template_key: string;
  token: string;
  org_id: string;
  vars: Record<string, string>;
}): Promise<void> {
  const resendUrl = `${SUPABASE_URL}/functions/v1/resend-api`;

  const res = await fetch(resendUrl, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    // Log but don't throw — invitation was created successfully,
    // email failure shouldn't roll back the invite.
    console.error("[invitations-api] resend-api error:", err);
  } else {
    const data = await res.json().catch(() => ({}));
    console.log("[invitations-api] Email dispatched:", data.email_id);
  }
}

// ── Helper: fetch inviter context for email vars ──────────────────────────────
async function getInviterContext(
  supabaseAdmin: ReturnType<typeof createClient>,
  invitedById: string,
  orgId: string
): Promise<{ inviter_name: string; org_name: string; inviter_email: string }> {
  const [{ data: profile }, { data: org }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", invitedById)
      .single(),
    supabaseAdmin
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .single(),
  ]);

  return {
    inviter_name:  profile?.full_name ?? profile?.email?.split("@")[0] ?? "Your team",
    org_name:      org?.name ?? "Space.inc",
    inviter_email: profile?.email ?? "",
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let supabaseClient: ReturnType<typeof createClient> | undefined;

  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (!action) {
      return new Response(
        JSON.stringify({ error: "Action required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── PUBLIC: validate (no auth required — invitee hasn't signed up yet) ──
    if (action === "validate") {
      const { token } = body;
      if (!token) {
        return errorResponse(
          await hydrateError(null, "VAL_MISSING_FIELD", { field: "token" })
        );
      }

      const anon = createClient(
        SUPABASE_URL,
        Deno.env.get("SUPABASE_ANON_KEY") ?? ""
      );

      const { data, error } = await anon.rpc("get_invitation_by_token", {
        p_raw_token: token,
      });

      if (error) throw error;

      return new Response(
        JSON.stringify({ data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "resolve_space_link") {
      const { token } = body;
      if (!token) {
        return errorResponse(
          await hydrateError(null, "VAL_MISSING_FIELD", { field: "token" })
        );
      }

      const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

      const { data, error } = await supabaseAdmin.rpc("get_share_link_by_token", {
        p_raw_token: token,
      });

      if (error) throw error;

      return new Response(
        JSON.stringify({ data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── AUTH REQUIRED for all other actions ──────────────────────────────────
    const { userId, supabase } = await getAuthContext(req);
    supabaseClient = supabase;

    // Admin client for reading profile/org context without RLS restrictions
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

    // ── SEND STAFF INVITATION ─────────────────────────────────────────────────
    if (action === "send_staff") {
      const { email, role, space_assignments = [] } = body;

      if (!email || !role) {
        return errorResponse(
          await hydrateError(supabase, "VAL_MISSING_FIELD", {
            fields: ["email", "role"],
          })
        );
      }

      if (!Array.isArray(space_assignments) || space_assignments.length === 0) {
        return errorResponse(
          await hydrateError(supabase, "VAL_MISSING_FIELD", {
            fields: ["space_assignments"],
          })
        );
      }

      const normalizedRole = role === "admin" ? "admin" : "member";
      const created = [];

      for (const assignment of space_assignments) {
        if (!assignment?.space_id) continue;
        const { data: invitation, error: createError } = await supabase.rpc("create_invitation", {
          p_space_id: assignment.space_id,
          p_email: email.toLowerCase().trim(),
          p_member_type: "staff",
          p_role: normalizedRole,
        });

        if (createError) throw createError;
        created.push(Array.isArray(invitation) ? invitation[0] : invitation);
      }

      if (created.length === 0) {
        return errorResponse(
          await hydrateError(supabase, "VAL_MISSING_FIELD", {
            fields: ["space_assignments.space_id"],
          })
        );
      }

      const data = {
        invitations: created,
        token: created[0]?.raw_token ?? "",
        org_id: "",
      };

      const { data: firstSpace } = await supabaseAdmin
        .from("spaces")
        .select("organization_id")
        .eq("id", space_assignments[0].space_id)
        .single();

      data.org_id = firstSpace?.organization_id ?? "";

      // Fetch inviter context for email template vars
      const ctx = await getInviterContext(supabaseAdmin, userId, data.org_id);

      // Dispatch email via resend-api (non-blocking — invite already created)
      await dispatchEmail({
        to:           email.toLowerCase().trim(),
        template_key: "staff_invitation",
        token:        data.token ?? "", // RPC now returns token
        org_id:       data.org_id ?? "",
        vars: {
          inviter_name:  ctx.inviter_name,
          org_name:      ctx.org_name,
          inviter_email: ctx.inviter_email,
          role,
        },
      });

      return new Response(
        JSON.stringify({ data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── SEND CLIENT INVITATION ────────────────────────────────────────────────
    if (action === "send_client") {
      const { email, space_id } = body;

      if (!email || !space_id) {
        return errorResponse(
          await hydrateError(supabase, "VAL_MISSING_FIELD", {
            fields: ["email", "space_id"],
          })
        );
      }

      const { data, error } = await supabase.rpc("create_invitation", {
        p_space_id: space_id,
        p_email: email.toLowerCase().trim(),
        p_member_type: "client",
        p_role: "member",
      });

      if (error) throw error;

      const invitation = Array.isArray(data) ? data[0] : data;
      const { data: space } = await supabaseAdmin
        .from("spaces")
        .select("organization_id")
        .eq("id", space_id)
        .single();
      const orgId = space?.organization_id ?? "";

      const ctx = await getInviterContext(supabaseAdmin, userId, orgId);

      await dispatchEmail({
        to:           email.toLowerCase().trim(),
        template_key: "client_invitation",
        token:        invitation?.raw_token ?? "",
        org_id:       orgId,
        vars: {
          inviter_name:  ctx.inviter_name,
          org_name:      ctx.org_name,
          inviter_email: ctx.inviter_email,
          role:          "client",
        },
      });

      return new Response(
        JSON.stringify({ data: invitation }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── ACCEPT INVITATION ─────────────────────────────────────────────────────
    if (action === "accept") {
      const { token } = body;
      if (!token) {
        return errorResponse(
          await hydrateError(supabase, "VAL_MISSING_FIELD", { field: "token" })
        );
      }

      const { data, error } = await supabase.rpc("accept_invitation", {
        p_raw_token: token,
      });

      if (error) throw error;

      return new Response(
        JSON.stringify({ data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "accept_space_link") {
      const { token } = body;
      if (!token) {
        return errorResponse(
          await hydrateError(supabase, "VAL_MISSING_FIELD", { field: "token" })
        );
      }

      const { data, error } = await supabase.rpc("join_via_share_link", {
        p_raw_token: token,
      });

      if (error) throw error;

      return new Response(
        JSON.stringify({ data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return errorResponse(
      await hydrateError(supabaseClient, "METHOD_NOT_ALLOWED", { action })
    );

  } catch (err: unknown) {
    console.error("[invitations-api] Error:", err);
    const code =
      (err as { isStandard?: boolean; message?: string; code?: string })
        ?.isStandard
        ? (err as { message: string }).message
        : ((err as { code?: string })?.code ?? "INTERNAL_ERROR");

    const richError = await hydrateError(
      supabaseClient ?? null,
      code,
      {
        original_error:
          err instanceof Error ? err.message : String(err),
      }
    );
    return errorResponse(richError);
  }
});
