import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // 1. Fetch pending background jobs
        const { data: jobs, error: fetchError } = await supabase
            .from("background_jobs")
            .select("*")
            .eq("status", "pending")
            .lte("scheduled_at", new Date().toISOString())
            .order("created_at", { ascending: true })
            .limit(10);

        if (fetchError) throw fetchError;
        if (!jobs || jobs.length === 0) {
            return new Response(JSON.stringify({ message: "No pending background jobs." }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        console.log(`[worker] Processing ${jobs.length} jobs.`);

        for (const job of jobs) {
            try {
                // Mark as processing
                await supabase.from("background_jobs")
                    .update({ status: "processing", started_at: new Date().toISOString() })
                    .eq("id", job.id);

                if (job.job_type === 'send_email') {
                    const { type, to, token, role, invitation_id } = job.payload;
                    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://space-inc.vercel.app';
                    const inviteLink = `${frontendUrl}/join?token=${token}`;
                    const resendApiKey = Deno.env.get('RESEND_API_KEY');

                    if (!resendApiKey) throw new Error("RESEND_API_KEY is missing in Edge Function environment.");

                    console.log(`[worker] Dispatching ${type} via Resend to ${to} (Invite ID: ${invitation_id})`);

                    const res = await fetch('https://api.resend.com/emails', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${resendApiKey}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            from: 'Space.inc <invites@space.inc>', // Note: User needs to verify this domain or use resend.dev for test
                            to: [to],
                            subject: type === 'staff_invitation' ? 'Join the Space.inc Team' : 'Your Space.inc Portal Invitation',
                            html: `
                                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                                    <h2 style="color: #111;">Welcome to Space.inc</h2>
                                    <p>Hello,</p>
                                    <p>You have been invited to join Space.inc as a <strong>${role}</strong>.</p>
                                    <div style="margin: 30px 0;">
                                        <a href="${inviteLink}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                                            Accept Your Invitation
                                        </a>
                                    </div>
                                    <p style="color: #666; font-size: 14px;">If the button above doesn't work, copy and paste this link into your browser:</p>
                                    <p style="word-break: break-all; color: #0066cc; font-size: 14px;">${inviteLink}</p>
                                    <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
                                    <p style="color: #999; font-size: 12px;">This invitation was sent by Space.inc. If you weren't expecting this, you can safely ignore this email.</p>
                                </div>
                            `,
                        }),
                    });

                    if (!res.ok) {
                        const errorMsg = await res.text();
                        throw new Error(`Resend API Error: ${errorMsg}`);
                    }
                }
                
                // Logic for other job types (e.g. virus_scan) can be added here

                // Mark as completed
                await supabase.from("background_jobs").update({ 
                    status: "completed", 
                    completed_at: new Date().toISOString(),
                    attempts: (job.attempts || 0) + 1
                }).eq("id", job.id);

                console.log(`[worker] Job ${job.id} (type: ${job.job_type}) completed successfully.`);

            } catch (jobError: any) {
                console.error(`[worker] Job ${job.id} failed:`, jobError.message);
                
                const nextAttempts = (job.attempts || 0) + 1;
                const finalStatus = nextAttempts >= (job.max_attempts || 3) ? 'failed' : 'pending';

                await supabase.from("background_jobs").update({
                    status: finalStatus,
                    last_error: jobError.message,
                    attempts: nextAttempts,
                    scheduled_at: finalStatus === 'pending' ? new Date(Date.now() + 60000).toISOString() : job.scheduled_at
                }).eq("id", job.id);
            }
        }

        return new Response(JSON.stringify({ success: true, processed: jobs.length }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error: any) {
        console.error("[worker] Critical Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
