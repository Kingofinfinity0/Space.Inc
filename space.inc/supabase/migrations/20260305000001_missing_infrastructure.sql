-- Migration: Missing Infrastructure (Phase 6)
-- Created: 2026-03-05
-- Description: Adds tables and functions referenced in code but missing from schema

-- 1. Audit Logs (6A)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id ON public.audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);

CREATE OR REPLACE FUNCTION public.write_audit_log(
    p_organization_id uuid,
    p_actor_id uuid,
    p_action text,
    p_resource_type text,
    p_resource_id uuid,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.audit_logs (
        organization_id, actor_id, action, resource_type, resource_id, metadata
    ) VALUES (
        p_organization_id, p_actor_id, p_action, p_resource_type, p_resource_id, p_metadata
    );
END;
$$;

-- 2. Space Memberships (6B)
-- This table was already referenced in migrations but ensure it exists with correct columns
CREATE TABLE IF NOT EXISTS public.space_memberships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
    profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role public.space_member_role NOT NULL DEFAULT 'client'::public.space_member_role,
    permission_level text,
    is_active boolean NOT NULL DEFAULT true,
    joined_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(space_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_space_memberships_profile ON public.space_memberships(profile_id);

-- 3. Background Jobs (6C)
CREATE TABLE IF NOT EXISTS public.background_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    job_type text NOT NULL,
    status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'pending', 'processing', 'completed', 'failed')),
    payload jsonb DEFAULT '{}'::jsonb,
    idempotency_key text UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz,
    locked_at timestamptz,
    locked_by text,
    retry_count int DEFAULT 0,
    last_error text
);

CREATE INDEX IF NOT EXISTS idx_background_jobs_status ON public.background_jobs(status) WHERE status IN ('queued', 'pending');

-- 4. Notification Queue (6D)
CREATE TABLE IF NOT EXISTS public.notification_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    space_id uuid REFERENCES public.spaces(id) ON DELETE CASCADE,
    event_type text NOT NULL,
    entity_type text,
    entity_id uuid,
    initiator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    payload jsonb DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'queued',
    retry_count int DEFAULT 0,
    next_attempt_at timestamptz,
    locked_at timestamptz,
    locked_by text,
    last_error text,
    processed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON public.notification_queue(status) WHERE status = 'queued';

-- Enable RLS (Default Deny for security)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

-- Note: RLS Policies for these tables should be defined in a subsequent migration 
-- focused on access control (Phase 2), but basic org-level read is added here.

CREATE POLICY "Audit logs are viewable by org staff" ON public.audit_logs
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('owner', 'admin', 'staff')
        )
    );

CREATE POLICY "Space memberships are viewable by space members" ON public.space_memberships
    FOR SELECT USING (
        space_id IN (
            SELECT space_id FROM public.space_memberships WHERE profile_id = auth.uid()
        ) OR organization_id IN (
            SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND role = 'owner'
        )
    );
-- Need org_id in space_memberships for the policy above if we want to avoid extra joins, 
-- but we can join spaces for now. Let's fix the policy.

DROP POLICY IF EXISTS "Space memberships are viewable by space members" ON public.space_memberships;
CREATE POLICY "Space memberships are viewable by space members" ON public.space_memberships
    FOR SELECT USING (
        space_id IN (
            SELECT space_id FROM public.space_memberships WHERE profile_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM public.spaces s
            JOIN public.profiles p ON s.organization_id = p.organization_id
            WHERE s.id = space_id AND p.id = auth.uid() AND p.role = 'owner'
        )
    );
