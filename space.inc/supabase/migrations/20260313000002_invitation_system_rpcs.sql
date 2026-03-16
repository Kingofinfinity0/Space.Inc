-- =============================================================================
-- Migration: Invitation System RPCs
-- Date: 2026-03-13
-- =============================================================================

-- =============================================================================
-- 1. send_staff_invitation (SECURITY DEFINER)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.send_staff_invitation(
    email text,
    role public.user_role,
    space_assignments jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
    v_caller_role public.user_role;
    v_org_id uuid;
    v_invitation_id uuid;
    v_host text;
    v_url text;
BEGIN
    -- 1. Validate caller is owner or admin
    SELECT p.role::public.user_role, p.organization_id INTO v_caller_role, v_org_id
    FROM public.profiles p
    WHERE p.id = auth.uid();
    
    IF v_caller_role NOT IN ('owner'::public.user_role, 'admin'::public.user_role) THEN
        RAISE EXCEPTION 'Only owners and admins can send staff invitations';
    END IF;

    -- 2. Check org seat quota stub (Phase 8 wires real limits)
    -- always return allowed for now

    -- 3. Insert a record into staff_invitations
    INSERT INTO public.staff_invitations (
        organization_id,
        invited_by,
        email,
        role,
        space_assignments,
        status
    ) VALUES (
        v_org_id,
        auth.uid(),
        email,
        role,
        space_assignments,
        'pending'
    ) RETURNING id INTO v_invitation_id;

    -- 4. Call the invitation-api edge function via pg_net
    v_host := current_setting('request.headers', true)::jsonb->>'host';
    IF v_host IS NULL THEN
        -- Fallback for local dev 
        v_url := 'http://kong:8000/functions/v1/';
    ELSE
        IF v_host LIKE 'localhost%' OR v_host LIKE '127.0.0.1%' THEN
            v_url := 'http://' || v_host || '/functions/v1/';
        ELSE
            v_url := 'https://' || v_host || '/functions/v1/';
        END IF;
    END IF;
    
    PERFORM net.http_post(
        url := v_url || 'invitation-api',
        headers := jsonb_build_object(
            'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
            'email', email,
            'role', role,
            'org_id', v_org_id,
            'invitation_id', v_invitation_id
        )
    );

    -- 5. Return invitation_id
    RETURN v_invitation_id;
END;
$$;


-- =============================================================================
-- 2. send_client_invitation (SECURITY DEFINER)
-- Notes: Encountered Logic Failure - cannot insert stub into space_memberships
-- without a valid profile_id. Used invitations table instead as dictated by schema.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.send_client_invitation(
    email text,
    space_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
    v_caller_role public.user_role;
    v_org_id uuid;
    v_invitation_id uuid;
    v_host text;
    v_url text;
BEGIN
    -- 1. Validate caller is owner or admin
    SELECT p.role::public.user_role, p.organization_id INTO v_caller_role, v_org_id
    FROM public.profiles p
    WHERE p.id = auth.uid();
    
    IF v_caller_role NOT IN ('owner'::public.user_role, 'admin'::public.user_role) THEN
        RAISE EXCEPTION 'Only owners and admins can send client invitations';
    END IF;

    -- Insert into invitations table with role=client and status=pending
    INSERT INTO public.invitations (
        organization_id,
        space_id,
        email,
        role,
        invited_by,
        status
    ) VALUES (
        v_org_id,
        space_id,
        email,
        'client',
        auth.uid(),
        'pending'
    ) RETURNING id INTO v_invitation_id;

    -- Call the invitation-api edge function
    v_host := current_setting('request.headers', true)::jsonb->>'host';
    IF v_host IS NULL THEN
        -- Fallback for local dev 
        v_url := 'http://kong:8000/functions/v1/';
    ELSE
        IF v_host LIKE 'localhost%' OR v_host LIKE '127.0.0.1%' THEN
            v_url := 'http://' || v_host || '/functions/v1/';
        ELSE
            v_url := 'https://' || v_host || '/functions/v1/';
        END IF;
    END IF;
    
    PERFORM net.http_post(
        url := v_url || 'invitation-api',
        headers := jsonb_build_object(
            'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
            'email', email,
            'role', 'client',
            'org_id', v_org_id,
            'invitation_id', v_invitation_id
        )
    );

    RETURN v_invitation_id;
END;
$$;

-- =============================================================================
-- 3. accept_invitation (SECURITY DEFINER)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.accept_invitation(
    accepting_user_id uuid,
    invitation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role text;
    v_org_id uuid;
    v_space_assignments jsonb;
    v_is_client boolean := false;
    v_space_id uuid;
    v_status text;
    v_record record;
    v_assignment jsonb;
BEGIN
    -- Check staff_invitations
    SELECT role::text, organization_id, space_assignments, status INTO v_role, v_org_id, v_space_assignments, v_status
    FROM public.staff_invitations
    WHERE id = invitation_id;

    IF NOT FOUND THEN
        -- Check client invitations
        SELECT role::text, organization_id, space_id, status INTO v_role, v_org_id, v_space_id, v_status
        FROM public.invitations
        WHERE id = invitation_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invitation not found';
        END IF;

        IF v_role = 'client' THEN
            v_is_client := true;
        END IF;
    END IF;

    IF v_status = 'accepted' THEN
        -- Idempotent return
        RETURN jsonb_build_object('role', v_role, 'redirect_path', CASE WHEN v_role = 'client' THEN '/client/portal' ELSE '/dashboard' END);
    END IF;

    -- If no profile exists for accepting_user_id: INSERT into profiles
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = accepting_user_id) THEN
        INSERT INTO public.profiles (
            id,
            email,
            role,
            organization_id,
            session_version
        ) VALUES (
            accepting_user_id,
            (SELECT email FROM auth.users WHERE id = accepting_user_id),
            v_role,
            v_org_id,
            0
        );
    END IF;

    -- Process assignments
    IF v_is_client THEN
        -- Insert client membership based on the space_id stored
        IF NOT EXISTS (SELECT 1 FROM public.space_memberships WHERE profile_id = accepting_user_id AND space_id = v_space_id) THEN
            INSERT INTO public.space_memberships (
                space_id,
                profile_id,
                status
            ) VALUES (
                v_space_id,
                accepting_user_id,
                'active'
            );
        END IF;

        -- Update invitation status
        UPDATE public.invitations
        SET status = 'accepted', accepted_at = now()
        WHERE id = invitation_id;
    ELSE
        -- Iterate over space_assignments jsonb
        FOR v_assignment IN SELECT * FROM jsonb_array_elements(v_space_assignments)
        LOOP
            IF NOT EXISTS (SELECT 1 FROM public.space_memberships WHERE profile_id = accepting_user_id AND space_id = (v_assignment->>'space_id')::uuid) THEN
                INSERT INTO public.space_memberships (
                    space_id,
                    profile_id,
                    capabilities,
                    status
                ) VALUES (
                    (v_assignment->>'space_id')::uuid,
                    accepting_user_id,
                    COALESCE(v_assignment->'capabilities', '{}'::jsonb),
                    'active'
                );
            END IF;
        END LOOP;

        -- Update staff_invitations status
        UPDATE public.staff_invitations
        SET status = 'accepted', accepted_at = now()
        WHERE id = invitation_id;
    END IF;

    RETURN jsonb_build_object('role', v_role, 'redirect_path', CASE WHEN v_role = 'client' THEN '/client/portal' ELSE '/dashboard' END);
END;
$$;

-- =============================================================================
-- 4. validate_invitation_context (SECURITY INVOKER)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.validate_invitation_context(
    invitation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_context jsonb;
    v_org_name text;
    v_inviter_name text;
    v_role text;
    v_expires_at timestamptz;
    v_status text;
BEGIN
    -- Check staff_invitations
    SELECT 
        o.name, 
        COALESCE(p.full_name, split_part(p.email, '@', 1)), 
        si.role::text, 
        si.expires_at,
        si.status
    INTO v_org_name, v_inviter_name, v_role, v_expires_at, v_status
    FROM public.staff_invitations si
    JOIN public.organizations o ON o.id = si.organization_id
    JOIN public.profiles p ON p.id = si.invited_by
    WHERE si.id = invitation_id;

    IF NOT FOUND THEN
        -- Check client invitations
        SELECT 
            o.name, 
            COALESCE(p.full_name, split_part(p.email, '@', 1)), 
            i.role, 
            i.expires_at,
            i.status
        INTO v_org_name, v_inviter_name, v_role, v_expires_at, v_status
        FROM public.invitations i
        JOIN public.organizations o ON o.id = i.organization_id
        JOIN public.profiles p ON p.id = i.invited_by
        WHERE i.id = invitation_id;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('valid', false, 'error', 'Invitation not found');
        END IF;
    END IF;

    IF v_status != 'pending' THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Invitation is no longer pending');
    END IF;

    IF v_expires_at < now() THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Invitation has expired');
    END IF;

    RETURN jsonb_build_object(
        'valid', true,
        'org_name', v_org_name,
        'inviter_name', v_inviter_name,
        'role', v_role,
        'expires_at', v_expires_at
    );
END;
$$;
