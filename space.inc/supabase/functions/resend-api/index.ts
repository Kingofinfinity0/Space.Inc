// resend-api/index.ts
// Dedicated edge function for sending transactional emails via Resend.
// Called internally by invitations-api after invitation is created.
// Never called directly from the frontend.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Config ────────────────────────────────────────────────────────────────────
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FRONTEND_URL   = Deno.env.get("FRONTEND_URL") ?? "https://space-inc.vercel.app";

// From address — update once you verify a domain in Resend dashboard.
// e.g. "Space.inc <invites@yourdomain.com>"
const FROM_ADDRESS = "Space.inc <onboarding@resend.dev>";

// ── Template variable renderer ────────────────────────────────────────────────
function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

// ── Main ──────────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Validate secrets are present
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not set in Supabase Vault");
    }

    const body = await req.json();
    const {
      to,           // recipient email
      template_key, // 'staff_invitation' | 'client_invitation'
      token,        // invitation token for link construction
      org_id,       // to fetch org-specific template or fall back to default
      vars = {},    // extra vars: inviter_name, org_name, role
    } = body;

    if (!to || !template_key || !token) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, template_key, token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Service-role client to read templates (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Fetch template — org-specific first, then global default
    let template = null;

    if (org_id) {
      const { data } = await supabase
        .from("email_templates")
        .select("subject, html_body")
        .eq("organization_id", org_id)
        .eq("template_key", template_key)
        .maybeSingle();
      template = data;
    }

    if (!template) {
      const { data } = await supabase
        .from("email_templates")
        .select("subject, html_body")
        .is("organization_id", null)
        .eq("template_key", template_key)
        .eq("is_default", true)
        .maybeSingle();
      template = data;
    }

    if (!template) {
      throw new Error(`No email template found for key: ${template_key}`);
    }

    // 2. Build all template variables
    const inviteLink = `${FRONTEND_URL}/join?token=${token}`;
    const allVars: Record<string, string> = {
      invite_link:  inviteLink,
      inviter_name: vars.inviter_name ?? "Your team",
      org_name:     vars.org_name ?? "Space.inc",
      role:         vars.role ?? "member",
      ...vars,
    };

    // 3. Render subject + body
    const subject = render(template.subject, allVars);
    const html    = render(template.html_body, allVars);

    // 4. Send via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:     FROM_ADDRESS,
        to:       [to],
        reply_to: vars.inviter_email ?? undefined,
        subject,
        html,
      }),
    });

    const resendData = await resendRes.json().catch(() => ({}));

    if (!resendRes.ok) {
      console.error("[resend-api] Resend error:", resendRes.status, resendData);
      throw new Error(
        `Resend API error ${resendRes.status}: ${resendData?.message ?? JSON.stringify(resendData)}`
      );
    }

    console.log(`[resend-api] ✅ Sent ${template_key} to ${to} — id: ${resendData.id}`);

    return new Response(
      JSON.stringify({ success: true, email_id: resendData.id, to }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[resend-api] Error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
