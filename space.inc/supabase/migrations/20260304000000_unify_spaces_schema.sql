-- AGENT 1: Unified Space Infrastructure Recovery
-- This migration renames client_spaces to spaces and standardizes creation logic.

-- 1. Rename the main table
ALTER TABLE public.client_spaces RENAME TO spaces;

-- 2. Drop legacy create_space functions to avoid ambiguity
DROP FUNCTION IF EXISTS public.create_space(text, text, jsonb);
DROP FUNCTION IF EXISTS public.create_space(uuid, text, text, text, jsonb);

-- 3. Create Unified create_space RPC
-- This function handles validation, quota check, insertion into spaces, 
-- and CRITICALLY ensures the creator is added as a member immediately.
CREATE OR REPLACE FUNCTION public.create_space(
    p_name text,
    p_description text DEFAULT NULL,
    p_modules jsonb DEFAULT '{"messaging": true, "meetings": true, "files": true}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER -- Escalates to service role for system inserts
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_org_id uuid;
    v_space_id uuid;
    v_quota_ok boolean;
BEGIN
    -- 1. Identify Actor's Organization
    SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = v_user_id;
    IF v_org_id IS NULL THEN RAISE EXCEPTION 'NOT_MEMBER: User has no organization affiliation'; END IF;

    -- 2. Capability Check: Does user have permission to create spaces?
    -- (Reuse existing capability logic or assume 'manage_team' / 'owner')
    IF NOT EXISTS (
        SELECT 1 FROM public.role_capabilities rc
        JOIN public.profiles p ON p.role::text = rc.role_key
        WHERE p.id = v_user_id AND rc.capability_key = 'manage_team'
    ) AND (SELECT role FROM public.profiles WHERE id = v_user_id) != 'owner' THEN
        RAISE EXCEPTION 'CAPABILITY_DENIED: Policy prevents space creation';
    END IF;

    -- 3. Atomic Quota Check + Increment
    v_quota_ok := public.check_and_increment_quota(v_org_id, 'spaces');
    IF NOT v_quota_ok THEN RAISE EXCEPTION 'QUOTA_EXCEEDED: Organization space limit reached'; END IF;

    -- 4. Central Space Entry
    INSERT INTO public.spaces (
        organization_id, 
        name, 
        description, 
        modules, 
        status, 
        created_at, 
        last_activity_at
    ) VALUES (
        v_org_id, 
        p_name, 
        p_description, 
        p_modules, 
        'Active', 
        now(), 
        now()
    ) RETURNING id INTO v_space_id;

    -- 5. MANDATORY: Auto-join creator as Owner/Principal
    -- This ensures the space is visible to the creator immediately via RLS and list APIs.
    INSERT INTO public.space_memberships (
        space_id, 
        profile_id, 
        role, 
        permission_level
    ) VALUES (
        v_space_id, 
        v_user_id, 
        'owner', 
        'principal'
    );

    -- 6. Domain Event Emission
    INSERT INTO public.space_events (organization_id, space_id, actor_id, event_type, payload)
    VALUES (v_org_id, v_space_id, v_user_id, 'space.created', jsonb_build_object('name', p_name));

    -- 7. Initialize Stats
    INSERT INTO public.space_stats (space_id) VALUES (v_space_id);

    RETURN v_space_id;
END;
$$;

-- 4. Update list_user_spaces to use the new table name
CREATE OR REPLACE FUNCTION public.list_user_spaces()
RETURNS TABLE (
    id uuid,
    name text,
    description text,
    status text,
    visibility text,
    role text,
    permission_level text,
    message_count integer,
    file_count integer,
    meeting_count integer,
    member_count integer,
    last_activity_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id, s.name, s.description, s.status::text, 'private'::text,
        sm.role::text, sm.permission_level::text,
        ss.message_count::integer, ss.file_count::integer, ss.meeting_count::integer, ss.member_count::integer,
        s.last_activity_at
    FROM public.spaces s
    JOIN public.space_memberships sm ON s.id = sm.space_id
    LEFT JOIN public.space_stats ss ON s.id = ss.space_id
    WHERE sm.profile_id = auth.uid() 
      AND sm.is_active = true
      AND s.deleted_at IS NULL;
END;
$$;

-- 5. Hardened RLS for the unified 'spaces' table
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Spaces are viewable by organization members" ON public.spaces;
DROP POLICY IF EXISTS "Spaces are viewable by members" ON public.spaces;

CREATE POLICY "Spaces are viewable by members" ON public.spaces
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.space_memberships
            WHERE space_id = public.spaces.id 
              AND profile_id = auth.uid()
              AND is_active = true
        ) OR (
            -- High-level visibility for org owners
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid() AND role = 'owner' AND organization_id = public.spaces.organization_id
            )
        )
    );

CREATE POLICY "No direct inserts" ON public.spaces FOR INSERT WITH CHECK (false);
CREATE POLICY "No direct updates" ON public.spaces FOR UPDATE USING (false);
