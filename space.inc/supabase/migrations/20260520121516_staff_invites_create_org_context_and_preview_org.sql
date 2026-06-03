-- Staff invitations should behave as team/org invitations in the product UI.
-- They still create the space-scoped membership required by the unified
-- invitation model, but they also activate an org-level staff/admin context so
-- accepted staff land on the dashboard instead of a client space.

DO $$
DECLARE
  v_sql text;
BEGIN
  SELECT pg_get_functiondef('public.accept_invitation(text)'::regprocedure) INTO v_sql;

  v_sql := replace(
    v_sql,
    '  CASE v_invite.role',
    '  IF v_invite.member_type = ''staff'' THEN
    INSERT INTO public.org_memberships (
      user_id, organization_id, status, invited_by, joined_at, created_at, updated_at, role, base_role
    ) VALUES (
      v_caller,
      v_space_org_id,
      ''active'',
      v_invite.invited_by,
      now(), now(), now(),
      CASE v_invite.role
        WHEN ''owner'' THEN ''owner''
        WHEN ''admin'' THEN ''admin''
        ELSE ''staff''
      END,
      CASE v_invite.role
        WHEN ''owner'' THEN ''owner''
        WHEN ''admin'' THEN ''admin''
        ELSE ''staff''
      END
    )
    ON CONFLICT ON CONSTRAINT org_memberships_user_id_organization_id_key DO UPDATE
      SET status = ''active'',
          role = EXCLUDED.role,
          base_role = EXCLUDED.base_role,
          invited_by = COALESCE(public.org_memberships.invited_by, EXCLUDED.invited_by),
          joined_at = COALESCE(public.org_memberships.joined_at, now()),
          updated_at = now();
  END IF;

  CASE v_invite.role'
  );

  EXECUTE v_sql;
END $$;

REVOKE ALL ON FUNCTION public.accept_invitation(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;

DROP FUNCTION IF EXISTS public.get_invitation_by_token(text);

CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_raw_token text)
RETURNS TABLE(
  space_id uuid,
  space_name text,
  organization_name text,
  email citext,
  member_type public.member_type,
  role public.member_role,
  status public.invite_status,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash     text;
  v_invite   public.invitations%ROWTYPE;
  v_space_nm text;
  v_org_nm   text;
  v_caller   uuid := auth.uid();
BEGIN
  IF p_raw_token IS NULL OR trim(p_raw_token) = '' THEN
    RAISE EXCEPTION 'INVITE_NOT_FOUND' USING ERRCODE = 'PT404';
  END IF;

  v_hash := public.hash_token(p_raw_token);

  SELECT * INTO v_invite
  FROM public.invitations
  WHERE token_hash = v_hash;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITE_NOT_FOUND' USING ERRCODE = 'PT404';
  END IF;

  IF v_invite.status = 'pending' AND v_invite.expires_at < now() THEN
    UPDATE public.invitations SET status = 'expired' WHERE id = v_invite.id;
    v_invite.status := 'expired';
    INSERT INTO public.invitation_events (invitation_id, event_type, actor_id, metadata)
    VALUES (v_invite.id, 'expired', v_caller, jsonb_build_object('cleanup_type', 'on_demand'));
  END IF;

  SELECT s.name, o.name
  INTO v_space_nm, v_org_nm
  FROM public.spaces s
  LEFT JOIN public.organizations o ON o.id = s.organization_id
  WHERE s.id = v_invite.space_id;

  INSERT INTO public.invitation_events (invitation_id, event_type, actor_id, metadata)
  VALUES (
    v_invite.id,
    'viewed',
    v_caller,
    jsonb_build_object('authenticated', v_caller IS NOT NULL)
  );

  RETURN QUERY SELECT
    v_invite.space_id,
    v_space_nm,
    v_org_nm,
    v_invite.email,
    v_invite.member_type,
    v_invite.role,
    v_invite.status,
    v_invite.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.get_invitation_by_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;
