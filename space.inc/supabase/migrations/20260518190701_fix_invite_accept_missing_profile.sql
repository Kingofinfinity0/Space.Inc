-- Freshly signed-up invited users may not have a public.profiles row yet.
-- Both access tables ultimately reference profiles, so invitation/share-link
-- acceptance must create the minimal profile row before inserting membership.

CREATE OR REPLACE FUNCTION public.accept_invitation(p_raw_token text)
RETURNS TABLE(space_id uuid, member_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller        uuid := auth.uid();
  v_caller_email  citext;
  v_invite        public.invitations%ROWTYPE;
  v_space_org_id  uuid;
  v_sm_id         uuid;
  v_smp_id        uuid;
  v_mapped_role   public.space_member_role;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'PT401';
  END IF;

  IF p_raw_token IS NULL OR trim(p_raw_token) = '' THEN
    RAISE EXCEPTION 'INVITE_NOT_FOUND' USING ERRCODE = 'PT404';
  END IF;

  SELECT * INTO v_invite
  FROM public.invitations
  WHERE token_hash = public.hash_token(p_raw_token)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITE_NOT_FOUND' USING ERRCODE = 'PT404';
  END IF;

  IF v_invite.status = 'accepted' THEN
    IF v_invite.accepted_by = v_caller THEN
      SELECT id INTO v_sm_id
      FROM public.space_members sm_existing
      WHERE sm_existing.space_id = v_invite.space_id
        AND sm_existing.user_id = v_caller;

      IF v_sm_id IS NOT NULL THEN
        RETURN QUERY SELECT v_invite.space_id, v_sm_id;
        RETURN;
      END IF;
    END IF;

    RAISE EXCEPTION 'INVITE_ALREADY_ACCEPTED' USING ERRCODE = 'PT409';
  ELSIF v_invite.status = 'revoked' THEN
    RAISE EXCEPTION 'INVITE_REVOKED' USING ERRCODE = 'PT410';
  ELSIF v_invite.status = 'expired' OR v_invite.expires_at < now() THEN
    IF v_invite.status = 'pending' THEN
      UPDATE public.invitations SET status = 'expired' WHERE id = v_invite.id;
      INSERT INTO public.invitation_events (invitation_id, event_type, actor_id, metadata)
      VALUES (v_invite.id, 'expired', v_caller, jsonb_build_object('cleanup_type', 'accept_attempt'));
    END IF;
    RAISE EXCEPTION 'INVITE_EXPIRED' USING ERRCODE = 'PT410';
  END IF;

  SELECT lower(trim(u.email))::citext INTO v_caller_email
  FROM auth.users u
  WHERE u.id = v_caller;

  IF v_caller_email IS DISTINCT FROM v_invite.email THEN
    RAISE EXCEPTION 'EMAIL_MISMATCH' USING ERRCODE = 'PT403';
  END IF;

  SELECT s.organization_id INTO v_space_org_id
  FROM public.spaces s
  WHERE s.id = v_invite.space_id;

  IF v_space_org_id IS NULL THEN
    RAISE EXCEPTION 'SPACE_NOT_FOUND' USING ERRCODE = 'PT404';
  END IF;

  INSERT INTO public.profiles (id, email, role, organization_id, is_active, created_at, updated_at)
  VALUES (
    v_caller,
    v_caller_email::text,
    CASE v_invite.member_type WHEN 'staff' THEN 'staff' ELSE 'client' END,
    v_space_org_id,
    true,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        organization_id = COALESCE(public.profiles.organization_id, EXCLUDED.organization_id),
        is_active = true,
        updated_at = now();

  CASE v_invite.role
    WHEN 'owner' THEN v_mapped_role := 'owner'::public.space_member_role;
    WHEN 'admin' THEN v_mapped_role := 'admin'::public.space_member_role;
    WHEN 'manager' THEN v_mapped_role := 'admin'::public.space_member_role;
    ELSE v_mapped_role := CASE v_invite.member_type WHEN 'staff' THEN 'staff'::public.space_member_role ELSE 'client'::public.space_member_role END;
  END CASE;

  INSERT INTO public.space_members (space_id, user_id, member_type, role, invited_by)
  VALUES (v_invite.space_id, v_caller, v_invite.member_type, v_invite.role, v_invite.invited_by)
  ON CONFLICT ON CONSTRAINT uq_space_members_space_user DO NOTHING
  RETURNING id INTO v_sm_id;

  IF v_sm_id IS NULL THEN
    SELECT id INTO v_sm_id
    FROM public.space_members sm_existing
    WHERE sm_existing.space_id = v_invite.space_id AND sm_existing.user_id = v_caller;
  END IF;

  INSERT INTO public.space_memberships (
    space_id, profile_id, role, context_role, org_id, status, is_active, invited_by, joined_at, created_at, updated_at
  ) VALUES (
    v_invite.space_id,
    v_caller,
    v_mapped_role,
    CASE v_invite.member_type WHEN 'staff' THEN 'staff' ELSE 'client' END,
    v_space_org_id,
    'active',
    true,
    v_invite.invited_by,
    now(), now(), now()
  )
  ON CONFLICT ON CONSTRAINT space_memberships_space_id_profile_id_key DO UPDATE
    SET org_id = EXCLUDED.org_id,
        status = 'active',
        is_active = true,
        joined_at = COALESCE(public.space_memberships.joined_at, now()),
        updated_at = now()
  RETURNING id INTO v_smp_id;

  UPDATE public.invitations
  SET status = 'accepted', accepted_at = now(), accepted_by = v_caller
  WHERE id = v_invite.id;

  INSERT INTO public.invitation_events (invitation_id, event_type, actor_id, metadata)
  VALUES (v_invite.id, 'accepted', v_caller, jsonb_build_object('space_member_id', v_sm_id, 'space_membership_id', v_smp_id, 'org_id', v_space_org_id));

  RETURN QUERY SELECT v_invite.space_id, v_sm_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invitation(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.join_via_share_link(p_raw_token text)
RETURNS TABLE(space_id uuid, member_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller        uuid := auth.uid();
  v_caller_email  text;
  v_caller_domain text;
  v_link          public.space_share_links%ROWTYPE;
  v_space_org_id  uuid;
  v_sm_id         uuid;
  v_smp_id        uuid;
  v_mapped_role   public.space_member_role;
  v_use_rows      integer := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'PT401';
  END IF;

  IF p_raw_token IS NULL OR trim(p_raw_token) = '' THEN
    RAISE EXCEPTION 'SHARE_LINK_NOT_FOUND' USING ERRCODE = 'PT404';
  END IF;

  SELECT * INTO v_link
  FROM public.space_share_links
  WHERE token_hash = public.hash_token(p_raw_token)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARE_LINK_NOT_FOUND' USING ERRCODE = 'PT404';
  END IF;

  IF NOT v_link.is_active THEN
    RAISE EXCEPTION 'SHARE_LINK_INACTIVE' USING ERRCODE = 'PT410';
  ELSIF v_link.expires_at IS NOT NULL AND v_link.expires_at < now() THEN
    RAISE EXCEPTION 'SHARE_LINK_EXPIRED' USING ERRCODE = 'PT410';
  ELSIF v_link.max_uses IS NOT NULL AND v_link.use_count >= v_link.max_uses THEN
    RAISE EXCEPTION 'SHARE_LINK_EXHAUSTED' USING ERRCODE = 'PT410';
  END IF;

  SELECT lower(trim(email)) INTO v_caller_email
  FROM auth.users
  WHERE id = v_caller;

  v_caller_domain := split_part(v_caller_email, '@', 2);

  IF v_link.allowed_email_domain IS NOT NULL AND v_caller_domain <> lower(trim(v_link.allowed_email_domain)) THEN
    RAISE EXCEPTION 'EMAIL_DOMAIN_NOT_ALLOWED' USING ERRCODE = 'PT403';
  END IF;

  SELECT s.organization_id INTO v_space_org_id
  FROM public.spaces s
  WHERE s.id = v_link.space_id;

  IF v_space_org_id IS NULL THEN
    RAISE EXCEPTION 'SPACE_NOT_FOUND' USING ERRCODE = 'PT404';
  END IF;

  INSERT INTO public.profiles (id, email, role, organization_id, is_active, created_at, updated_at)
  VALUES (
    v_caller,
    v_caller_email,
    CASE v_link.default_member_type WHEN 'staff' THEN 'staff' ELSE 'client' END,
    v_space_org_id,
    true,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        organization_id = COALESCE(public.profiles.organization_id, EXCLUDED.organization_id),
        is_active = true,
        updated_at = now();

  SELECT id INTO v_sm_id
  FROM public.space_members sm_existing
  WHERE sm_existing.space_id = v_link.space_id AND sm_existing.user_id = v_caller;

  IF v_sm_id IS NOT NULL THEN
    INSERT INTO public.space_memberships (
      space_id, profile_id, role, context_role, org_id, status, is_active, invited_by, joined_at, created_at, updated_at
    ) VALUES (
      v_link.space_id,
      v_caller,
      CASE v_link.default_role
        WHEN 'owner' THEN 'owner'::public.space_member_role
        WHEN 'admin' THEN 'admin'::public.space_member_role
        WHEN 'manager' THEN 'admin'::public.space_member_role
        ELSE CASE v_link.default_member_type WHEN 'staff' THEN 'staff'::public.space_member_role ELSE 'client'::public.space_member_role END
      END,
      CASE v_link.default_member_type WHEN 'staff' THEN 'staff' ELSE 'client' END,
      v_space_org_id,
      'active', true, v_link.created_by, now(), now(), now()
    )
    ON CONFLICT ON CONSTRAINT space_memberships_space_id_profile_id_key DO UPDATE
      SET org_id = EXCLUDED.org_id,
          status = 'active',
          is_active = true,
          joined_at = COALESCE(public.space_memberships.joined_at, now()),
          updated_at = now()
    RETURNING id INTO v_smp_id;

    INSERT INTO public.share_link_events (share_link_id, event_type, actor_id, metadata)
    VALUES (v_link.id, 'already_member', v_caller, jsonb_build_object('space_id', v_link.space_id, 'space_member_id', v_sm_id, 'space_membership_id', v_smp_id, 'org_id', v_space_org_id));
    RETURN QUERY SELECT v_link.space_id, v_sm_id;
    RETURN;
  END IF;

  CASE v_link.default_role
    WHEN 'owner' THEN v_mapped_role := 'owner'::public.space_member_role;
    WHEN 'admin' THEN v_mapped_role := 'admin'::public.space_member_role;
    WHEN 'manager' THEN v_mapped_role := 'admin'::public.space_member_role;
    ELSE v_mapped_role := CASE v_link.default_member_type WHEN 'staff' THEN 'staff'::public.space_member_role ELSE 'client'::public.space_member_role END;
  END CASE;

  INSERT INTO public.space_members (space_id, user_id, member_type, role, invited_by)
  VALUES (v_link.space_id, v_caller, v_link.default_member_type, v_link.default_role, v_link.created_by)
  RETURNING id INTO v_sm_id;

  INSERT INTO public.space_memberships (
    space_id, profile_id, role, context_role, org_id, status, is_active, invited_by, joined_at, created_at, updated_at
  ) VALUES (
    v_link.space_id,
    v_caller,
    v_mapped_role,
    CASE v_link.default_member_type WHEN 'staff' THEN 'staff' ELSE 'client' END,
    v_space_org_id,
    'active', true, v_link.created_by, now(), now(), now()
  )
  ON CONFLICT ON CONSTRAINT space_memberships_space_id_profile_id_key DO UPDATE
    SET org_id = EXCLUDED.org_id,
        status = 'active',
        is_active = true,
        joined_at = COALESCE(public.space_memberships.joined_at, now()),
        updated_at = now()
  RETURNING id INTO v_smp_id;

  INSERT INTO public.share_link_uses (share_link_id, user_id)
  VALUES (v_link.id, v_caller)
  ON CONFLICT (share_link_id, user_id) DO NOTHING;

  GET DIAGNOSTICS v_use_rows = ROW_COUNT;

  IF v_use_rows > 0 THEN
    UPDATE public.space_share_links
    SET use_count = use_count + 1
    WHERE id = v_link.id;
  END IF;

  INSERT INTO public.share_link_events (share_link_id, event_type, actor_id, metadata)
  VALUES (v_link.id, 'joined', v_caller, jsonb_build_object('space_id', v_link.space_id, 'space_member_id', v_sm_id, 'space_membership_id', v_smp_id, 'org_id', v_space_org_id));

  RETURN QUERY SELECT v_link.space_id, v_sm_id;
END;
$$;

REVOKE ALL ON FUNCTION public.join_via_share_link(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_via_share_link(text) TO authenticated;
