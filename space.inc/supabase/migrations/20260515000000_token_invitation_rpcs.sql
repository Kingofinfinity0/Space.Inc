-- Token-based invitation RPCs used by invitations-api edge function and the web app.
-- Adds p_token overloads without removing legacy uuid-based functions.

-- -----------------------------------------------------------------------------
-- validate_invitation_context(p_token text)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_invitation_context(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation_id uuid;
  v_org_name text;
  v_inviter_name text;
  v_role text;
  v_expires_at timestamptz;
  v_status text;
  v_email text;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN jsonb_build_object('valid', false, 'status', 'not_found');
  END IF;

  BEGIN
    v_invitation_id := p_token::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN jsonb_build_object('valid', false, 'status', 'not_found');
  END;

  SELECT
    o.name,
    COALESCE(p.full_name, split_part(p.email, '@', 1)),
    si.role::text,
    si.expires_at,
    si.status,
    si.email
  INTO v_org_name, v_inviter_name, v_role, v_expires_at, v_status, v_email
  FROM public.staff_invitations si
  JOIN public.organizations o ON o.id = si.organization_id
  JOIN public.profiles p ON p.id = si.invited_by
  WHERE si.id = v_invitation_id;

  IF FOUND THEN
  IF v_status = 'accepted' THEN
    RETURN jsonb_build_object('valid', false, 'status', 'accepted');
  END IF;
  IF v_status = 'revoked' THEN
    RETURN jsonb_build_object('valid', false, 'status', 'revoked');
  END IF;
  IF v_status <> 'pending' THEN
    RETURN jsonb_build_object('valid', false, 'status', 'not_found');
  END IF;
  IF v_expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'status', 'expired');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'status', 'pending',
    'org_name', v_org_name,
    'inviter_name', v_inviter_name,
    'role', v_role,
    'invited_email', v_email,
    'expires_at', v_expires_at,
    'invite_type', 'teams_link'
  );
  END IF;

  SELECT
    o.name,
    COALESCE(p.full_name, split_part(p.email, '@', 1)),
    i.role,
    i.expires_at,
    i.status,
    i.email
  INTO v_org_name, v_inviter_name, v_role, v_expires_at, v_status, v_email
  FROM public.invitations i
  JOIN public.organizations o ON o.id = i.organization_id
  JOIN public.profiles p ON p.id = i.invited_by
  WHERE i.id = v_invitation_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'status', 'not_found');
  END IF;

  IF v_status = 'accepted' THEN
    RETURN jsonb_build_object('valid', false, 'status', 'accepted');
  END IF;
  IF v_status = 'revoked' THEN
    RETURN jsonb_build_object('valid', false, 'status', 'revoked');
  END IF;
  IF v_status <> 'pending' THEN
    RETURN jsonb_build_object('valid', false, 'status', 'not_found');
  END IF;
  IF v_expires_at IS NOT NULL AND v_expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'status', 'expired');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'status', 'pending',
    'org_name', v_org_name,
    'inviter_name', v_inviter_name,
    'role', v_role,
    'invited_email', v_email,
    'expires_at', v_expires_at,
    'invite_type', 'clients_link'
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- accept_invitation(p_token text)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_invitation_id uuid;
  v_legacy jsonb;
  v_role text;
  v_space_id uuid;
  v_org_id uuid;
  v_is_client boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'NOT_AUTHENTICATED');
  END IF;

  BEGIN
    v_invitation_id := p_token::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TOKEN');
  END;

  v_legacy := public.accept_invitation(v_user_id, v_invitation_id);

  v_role := v_legacy->>'role';
  v_space_id := NULL;
  v_org_id := NULL;

  SELECT organization_id INTO v_org_id
  FROM public.staff_invitations
  WHERE id = v_invitation_id;

  IF NOT FOUND THEN
    SELECT organization_id, space_id INTO v_org_id, v_space_id
    FROM public.invitations
    WHERE id = v_invitation_id;
    v_is_client := true;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'invite_type', CASE WHEN v_is_client THEN 'clients_link' ELSE 'teams_link' END,
    'context_type', CASE WHEN v_is_client THEN 'client_space' ELSE 'org' END,
    'context_id', CASE WHEN v_is_client THEN v_space_id::text ELSE v_org_id::text END,
    'role', v_role,
    'org_id', v_org_id,
    'space_id', v_space_id,
    'needs_activation', true,
    'membership_created', true,
    'already_member', false,
    'redirect_path', CASE
      WHEN v_role = 'client' AND v_space_id IS NOT NULL THEN '/spaces/' || v_space_id::text
      ELSE '/dashboard'
    END
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- resolve_space_invite_token(p_token text)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_space_invite_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_space record;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN jsonb_build_object('valid', false, 'error_code', 'INVALID_TOKEN');
  END IF;

  SELECT
    s.id,
    s.name,
    s.description,
    s.organization_id,
    o.name AS organization_name,
    s.invitation_token
  INTO v_space
  FROM public.spaces s
  JOIN public.organizations o ON o.id = s.organization_id
  WHERE s.invitation_token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error_code', 'INVALID_TOKEN');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'space_id', v_space.id,
    'space_name', v_space.name,
    'space_description', v_space.description,
    'organization_id', v_space.organization_id,
    'organization_name', v_space.organization_name,
    'requires_auth', true
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- accept_space_invite_token(p_token text, ...)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_space_invite_token(
  p_token text,
  p_client_name text DEFAULT NULL,
  p_client_company text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_space_id uuid;
  v_org_id uuid;
  v_email text;
  v_full_name text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'NOT_AUTHENTICATED');
  END IF;

  SELECT s.id, s.organization_id
  INTO v_space_id, v_org_id
  FROM public.spaces s
  WHERE s.invitation_token = p_token
  LIMIT 1;

  IF v_space_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TOKEN');
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  v_full_name := COALESCE(NULLIF(btrim(p_client_name), ''), split_part(v_email, '@', 1));

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
    INSERT INTO public.profiles (id, email, full_name, organization_id, role)
    VALUES (v_user_id, v_email, v_full_name, v_org_id, 'client')
    ON CONFLICT (id) DO UPDATE
      SET organization_id = COALESCE(public.profiles.organization_id, EXCLUDED.organization_id),
          role = CASE
            WHEN public.profiles.role IN ('owner', 'admin', 'staff') THEN public.profiles.role
            ELSE 'client'
          END;
  ELSE
    UPDATE public.profiles
    SET
      organization_id = COALESCE(organization_id, v_org_id),
      role = CASE WHEN role IN ('owner', 'admin', 'staff') THEN role ELSE 'client' END,
      full_name = COALESCE(NULLIF(full_name, ''), v_full_name)
    WHERE id = v_user_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.space_memberships
    WHERE profile_id = v_user_id AND space_id = v_space_id
  ) THEN
    INSERT INTO public.space_memberships (space_id, profile_id, role, status)
    VALUES (v_space_id, v_user_id, 'client', 'active');
  ELSE
    UPDATE public.space_memberships
    SET status = 'active', role = 'client'
    WHERE profile_id = v_user_id AND space_id = v_space_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'invite_type', 'clients_link',
    'context_type', 'client_space',
    'context_id', v_space_id,
    'role', 'client',
    'org_id', v_org_id,
    'space_id', v_space_id,
    'needs_activation', true,
    'membership_created', true,
    'already_member', false,
    'redirect_path', '/spaces/' || v_space_id::text
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_invitation_context(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_space_invite_token(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_space_invite_token(text, text, text) TO authenticated, service_role;
