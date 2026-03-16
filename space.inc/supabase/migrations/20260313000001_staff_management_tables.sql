-- =============================================================================
-- Migration: Staff Management Tables, Column Extensions, RLS, and Indexes
-- Phase:     Staff Lifecycle & Capability Assignment
-- Date:      2026-03-13
-- =============================================================================
-- GUARDRAILS:
--   - No RPCs or SQL functions in this migration.
--   - Only creates new tables, adds columns to existing tables,
--     creates new RLS policies for new tables, and creates indexes.
--   - Does NOT modify existing RLS policies.
--   - Does NOT touch any existing tables beyond the two listed extensions.
-- =============================================================================


-- =============================================================================
-- TABLE 1: staff_invitations
-- Purpose: Tracks invitations sent to staff members before they have accounts.
--          A staff invitation carries space assignments and per-space capabilities
--          so the onboarding RPC can set them up atomically upon acceptance.
--
-- space_assignments JSONB shape:
--   [
--     {
--       "space_id": "<uuid>",
--       "capabilities": {
--         "can_view":            true,
--         "can_edit":            false,
--         "can_delete":          false,
--         "can_message_client":  false,
--         "can_upload_files":    false,
--         "can_manage_tasks":    false,
--         "can_delegate":        false
--       }
--     }
--   ]
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.staff_invitations (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    invited_by          uuid        NOT NULL REFERENCES public.profiles(id),
    email               text        NOT NULL,

    -- Role this staff member will receive upon acceptance.
    -- Values: 'owner' | 'admin' | 'staff'  (client invites use the invitations table)
    role                public.user_role NOT NULL,

    -- Array of space assignments with per-space capability overrides.
    -- See JSONB shape documented above.
    space_assignments   jsonb       NOT NULL DEFAULT '[]'::jsonb,

    -- Lifecycle status of this invitation.
    -- Values: 'pending' | 'accepted' | 'expired' | 'revoked'
    status              text        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),

    -- Supabase Auth invite ID returned by admin.inviteUserByEmail, if used.
    supabase_invite_id  text        NULL,

    expires_at          timestamptz NOT NULL DEFAULT (now() + interval '72 hours'),
    accepted_at         timestamptz NULL,
    created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- TABLE 2: org_announcements
-- Purpose: Internal broadcast messages surfaced to admins/owners when
--          significant staff lifecycle events occur (suspension, removal,
--          capability changes). Inserted exclusively by SECURITY DEFINER RPCs.
--
-- payload JSONB shape:
--   {
--     "affected_staff_id": "<uuid>",
--     "message":           "<string>",
--     "action_required":   true | false
--   }
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.org_announcements (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- Event type that triggered this announcement.
    -- Values: 'staff_suspended' | 'staff_removed' | 'capability_changed'
    type            text        NOT NULL
                                CHECK (type IN ('staff_suspended', 'staff_removed', 'capability_changed')),

    -- Structured payload describing the event.
    -- See JSONB shape documented above.
    payload         jsonb       NOT NULL,

    -- Which role(s) should see this announcement in their dashboard.
    -- Defaults to owners and admins only.
    target_roles    text[]      NOT NULL DEFAULT '{owner,admin}'::text[],

    -- UUIDs of profiles that have dismissed this announcement.
    dismissed_by    uuid[]      NOT NULL DEFAULT '{}'::uuid[],

    created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_announcements ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- TABLE 3: task_reassignments
-- Purpose: Audit trail for task ownership transfers. Written exclusively by
--          SECURITY DEFINER RPCs (e.g., during staff offboarding).
--
-- reason values: 'offboarding' | 'manual' | 'delegation'
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.task_reassignments (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    task_id         uuid        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    from_profile_id uuid        NOT NULL REFERENCES public.profiles(id),
    to_profile_id   uuid        NOT NULL REFERENCES public.profiles(id),
    space_id        uuid        NOT NULL REFERENCES public.spaces(id),

    -- Context for why the reassignment occurred.
    -- Values: 'offboarding' | 'manual' | 'delegation'
    reason          text        NOT NULL DEFAULT 'offboarding'
                                CHECK (reason IN ('offboarding', 'manual', 'delegation')),

    created_by      uuid        NOT NULL REFERENCES public.profiles(id),
    created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_reassignments ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- EXTEND: notifications
-- The notifications table already exists. We add recipient_id and payload
-- columns to support the new structured notification system used by
-- SECURITY DEFINER RPCs.
--
-- recipient_id: mirrors user_id for the new notification system.
--               We add it as a separate nullable column to avoid breaking
--               any existing queries that use user_id.
-- payload:      structured data payload (jsonb) for the notification.
--
-- type check values: 'staff_assigned' | 'task_assigned' | 'capability_changed'
--                  | 'client_message' | 'plan_limit' | 'staff_suspended'
-- =============================================================================
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS recipient_id  uuid        REFERENCES public.profiles(id),
    ADD COLUMN IF NOT EXISTS payload       jsonb       NOT NULL DEFAULT '{}'::jsonb;

-- Add a check constraint on type for the new notification categories.
-- Uses IF NOT EXISTS pattern via DO block to avoid re-adding.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'notifications_type_check_v2'
          AND conrelid = 'public.notifications'::regclass
    ) THEN
        ALTER TABLE public.notifications
            ADD CONSTRAINT notifications_type_check_v2
            CHECK (type IN (
                'staff_assigned',
                'task_assigned',
                'capability_changed',
                'client_message',
                'plan_limit',
                'staff_suspended',
                -- legacy types that may exist
                'info',
                'warning',
                'error',
                'success',
                'invitation',
                'task_update',
                'meeting_reminder',
                'file_uploaded',
                'space_update',
                'system'
            ));
    END IF;
END;
$$;


-- =============================================================================
-- EXTEND: space_memberships
-- Add capability tracking, assignment provenance, and lifecycle status.
--
-- capabilities JSONB default shape:
--   {
--     "can_view":           true,
--     "can_edit":           false,
--     "can_delete":         false,
--     "can_message_client": false,
--     "can_upload_files":   false,
--     "can_manage_tasks":   false,
--     "can_delegate":       false
--   }
--
-- status values: 'active' | 'suspended'
-- =============================================================================
ALTER TABLE public.space_memberships
    ADD COLUMN IF NOT EXISTS capabilities jsonb DEFAULT '{
        "can_view":           true,
        "can_edit":           false,
        "can_delete":         false,
        "can_message_client": false,
        "can_upload_files":   false,
        "can_manage_tasks":   false,
        "can_delegate":       false
    }'::jsonb,
    ADD COLUMN IF NOT EXISTS assigned_by  uuid  REFERENCES public.profiles(id),
    ADD COLUMN IF NOT EXISTS status       text  NOT NULL DEFAULT 'active'
                                                CHECK (status IN ('active', 'suspended'));


-- =============================================================================
-- EXTEND: profiles
-- Track when a user was last active to support churn detection, suspension
-- eligibility checks, and the staff activity dashboard widget.
-- =============================================================================
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS last_active_at timestamptz NULL;


-- =============================================================================
-- RLS POLICIES: staff_invitations
-- =============================================================================

-- SELECT: org members can see their org's invitations
CREATE POLICY "staff_invitations_select"
    ON public.staff_invitations
    FOR SELECT
    USING (
        organization_id = (
            SELECT organization_id
            FROM public.profiles
            WHERE id = auth.uid()
        )
    );

-- INSERT: only owners and admins may create staff invitations
CREATE POLICY "staff_invitations_insert"
    ON public.staff_invitations
    FOR INSERT
    WITH CHECK (
        (
            SELECT role
            FROM public.profiles
            WHERE id = auth.uid()
        ) IN ('owner', 'admin')
        AND
        organization_id = (
            SELECT organization_id
            FROM public.profiles
            WHERE id = auth.uid()
        )
    );

-- UPDATE: only owners and admins may update (e.g., revoke) staff invitations
CREATE POLICY "staff_invitations_update"
    ON public.staff_invitations
    FOR UPDATE
    USING (
        (
            SELECT role
            FROM public.profiles
            WHERE id = auth.uid()
        ) IN ('owner', 'admin')
        AND
        organization_id = (
            SELECT organization_id
            FROM public.profiles
            WHERE id = auth.uid()
        )
    );


-- =============================================================================
-- RLS POLICIES: org_announcements
-- =============================================================================

-- SELECT: visible to users whose role is in target_roles for their org
CREATE POLICY "org_announcements_select"
    ON public.org_announcements
    FOR SELECT
    USING (
        organization_id = (
            SELECT organization_id
            FROM public.profiles
            WHERE id = auth.uid()
        )
        AND (
            SELECT role
            FROM public.profiles
            WHERE id = auth.uid()
        ) = ANY(target_roles)
    );

-- INSERT: blocked at RLS level — only SECURITY DEFINER RPCs can insert
CREATE POLICY "org_announcements_insert_deny"
    ON public.org_announcements
    FOR INSERT
    WITH CHECK (false);


-- =============================================================================
-- RLS POLICIES: task_reassignments
-- =============================================================================

-- SELECT: org members can see their org's reassignment audit trail
CREATE POLICY "task_reassignments_select"
    ON public.task_reassignments FOR SELECT
    USING (
        organization_id = (
            SELECT organization_id
            FROM public.profiles
            WHERE id = auth.uid()
        )
    );

-- INSERT: blocked at RLS level — only SECURITY DEFINER RPCs can insert
CREATE POLICY "task_reassignments_insert_deny"
    ON public.task_reassignments
    FOR INSERT
    WITH CHECK (false);


-- =============================================================================
-- RLS POLICIES: notifications (new policies for recipient_id column)
-- Note: Existing policies on notifications are NOT touched.
-- These policies are additive and scoped to the new recipient_id column.
-- =============================================================================

-- SELECT: users can see notifications where they are the recipient
CREATE POLICY "notifications_select_by_recipient"
    ON public.notifications
    FOR SELECT
    USING (
        recipient_id = auth.uid()
        OR user_id = auth.uid()  -- backward compat with existing user_id pattern
    );

-- INSERT: blocked — only SECURITY DEFINER RPCs may insert notifications
CREATE POLICY "notifications_insert_deny"
    ON public.notifications
    FOR INSERT
    WITH CHECK (false);

-- UPDATE: users may update (e.g., mark as read) their own notifications
CREATE POLICY "notifications_update_by_recipient"
    ON public.notifications
    FOR UPDATE
    USING (
        recipient_id = auth.uid()
        OR user_id = auth.uid()
    );


-- =============================================================================
-- INDEXES
-- =============================================================================

-- space_memberships: fast lookups by member + status and space + status
CREATE INDEX IF NOT EXISTS idx_space_memberships_profile_status
    ON public.space_memberships (profile_id, status);

CREATE INDEX IF NOT EXISTS idx_space_memberships_space_status
    ON public.space_memberships (space_id, status);

-- staff_invitations: deduplication check (email + org) and status filter
CREATE INDEX IF NOT EXISTS idx_staff_invitations_email_org
    ON public.staff_invitations (email, organization_id);

CREATE INDEX IF NOT EXISTS idx_staff_invitations_status
    ON public.staff_invitations (status);

-- notifications: recipient unread feed
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read
    ON public.notifications (recipient_id, read);

-- org_announcements: org-scoped chronological feed (most recent first)
CREATE INDEX IF NOT EXISTS idx_org_announcements_org_created
    ON public.org_announcements (organization_id, created_at DESC);
