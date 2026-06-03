-- Final hardening patch for the invitation and share-link backend.
-- This migration is designed to run after the May 18 invitation rebuild
-- migrations (`01_enums` through `10_rpc_list_space_invitations`) and the
-- initial share-link migrations.

CREATE OR REPLACE FUNCTION public.hash_token(_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT encode(extensions.digest(_raw::bytea, 'sha256'), 'hex');
$$;

CREATE TABLE IF NOT EXISTS public.share_link_events (
  id bigserial PRIMARY KEY,
  share_link_id uuid NOT NULL REFERENCES public.space_share_links(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_id uuid REFERENCES auth.users(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.share_link_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "share_link_events: select for owners/admins" ON public.share_link_events;
CREATE POLICY "share_link_events: select for owners/admins"
ON public.share_link_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.space_share_links ssl
    WHERE ssl.id = share_link_events.share_link_id
      AND public.has_space_role(auth.uid(), ssl.space_id, ARRAY['owner','admin']::public.member_role[])
  )
);

CREATE OR REPLACE FUNCTION public.create_invitation(
  p_space_id uuid,
  p_email text,
  p_member_type public.member_type,
  p_role public.member_role
)
RETURNS TABLE(invitation_id uuid, raw_token text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_email citext;
  v_raw_token text;
  v_token_hash text;
  v_expires timestamptz;
  v_invite_id uuid;
  v_old_id uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'PT401';
  END IF;

  IF NOT public.has_space_role(v_caller, p_space_id, ARRAY['owner','admin']::public.member_role[]) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED' USING ERRCODE = 'PT403';
  END IF;

  v_email := lower(trim(p_email))::citext;
  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'INVALID_EMAIL' USING ERRCODE = 'PT400';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.space_members sm
    JOIN auth.users u ON u.id = sm.user_id
    WHERE sm.space_id = p_space_id
      AND lower(trim(u.email)) = v_email::text
  ) OR EXISTS (
    SELECT 1
    FROM public.space_memberships sm
    JOIN auth.users u ON u.id = sm.profile_id
    WHERE sm.space_id = p_space_id
      AND COALESCE(sm.is_active, true) = true
      AND lower(trim(u.email)) = v_email::text
  ) THEN
    RAISE EXCEPTION 'ALREADY_MEMBER' USING ERRCODE = 'PT409';
  END IF;

  SELECT id INTO v_old_id
  FROM public.invitations
  WHERE space_id = p_space_id
    AND email = v_email
    AND status = 'pending'
  FOR UPDATE;

  IF v_old_id IS NOT NULL THEN
    UPDATE public.invitations
    SET status = 'revoked', revoked_at = now()
    WHERE id = v_old_id;

    INSERT INTO public.invitation_events (invitation_id, event_type, actor_id, metadata)
    VALUES (v_old_id, 'revoked', v_caller, jsonb_build_object('reason', 'superseded_by_new_invite'));
  END IF;

  v_raw_token := encode(extensions.gen_random_bytes(32), 'base64url');
  v_token_hash := public.hash_token(v_raw_token);
  v_expires := now() + interval '7 days';

  INSERT INTO public.invitations (
    space_id, email, member_type, role, token_hash, status, invited_by, expires_at
  ) VALUES (
    p_space_id, v_email, p_member_type, p_role, v_token_hash, 'pending', v_caller, v_expires
  )
  RETURNING id INTO v_invite_id;

  INSERT INTO public.invitation_events (invitation_id, event_type, actor_id, metadata)
  VALUES (
    v_invite_id,
    'created',
    v_caller,
    jsonb_build_object('email', v_email, 'member_type', p_member_type, 'role', p_role, 'replaced_id', v_old_id)
  );

  RETURN QUERY SELECT v_invite_id, v_raw_token, v_expires;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_space_members(p_space_id uuid)
RETURNS TABLE(
  member_id uuid,
  user_id uuid,
  full_name text,
  email citext,
  member_type public.member_type,
  role public.member_role,
  joined_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'PT401';
  END IF;

  IF NOT public.has_space_role(v_caller, p_space_id, ARRAY['owner','admin','manager','member','viewer']::public.member_role[]) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED' USING ERRCODE = 'PT403';
  END IF;

  RETURN QUERY
    SELECT sm.id,
           sm.user_id,
           p.full_name,
           lower(trim(u.email))::citext,
           sm.member_type,
           sm.role,
           sm.joined_at
    FROM public.space_members sm
    JOIN auth.users u ON u.id = sm.user_id
    LEFT JOIN public.profiles p ON p.id = sm.user_id
    WHERE sm.space_id = p_space_id
    ORDER BY sm.joined_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.rotate_share_link(p_space_id uuid)
RETURNS TABLE(raw_token text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_raw_token text;
  v_token_hash text;
  v_link public.space_share_links%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'PT401';
  END IF;

  IF NOT public.has_space_role(v_caller, p_space_id, ARRAY['owner','admin']::public.member_role[]) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED' USING ERRCODE = 'PT403';
  END IF;

  SELECT * INTO v_link
  FROM public.space_share_links
  WHERE space_id = p_space_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARE_LINK_NOT_FOUND' USING ERRCODE = 'PT404';
  END IF;

  v_raw_token := encode(extensions.gen_random_bytes(32), 'base64url');
  v_token_hash := public.hash_token(v_raw_token);

  UPDATE public.space_share_links
  SET token_hash = v_token_hash,
      use_count = 0,
      is_active = true,
      rotated_at = now()
  WHERE id = v_link.id
  RETURNING * INTO v_link;

  INSERT INTO public.share_link_events (share_link_id, event_type, actor_id, metadata)
  VALUES (v_link.id, 'rotated', v_caller, jsonb_build_object('space_id', p_space_id));

  RETURN QUERY SELECT v_raw_token, v_link.expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_via_share_link(p_raw_token text)
RETURNS TABLE(space_id uuid, member_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_email text;
  v_caller_domain text;
  v_link public.space_share_links%ROWTYPE;
  v_sm_id uuid;
  v_smp_id uuid;
  v_mapped_role public.user_role;
  v_use_rows integer := 0;
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

  SELECT lower(trim(email)) INTO v_caller_email FROM auth.users WHERE id = v_caller;
  v_caller_domain := split_part(v_caller_email, '@', 2);

  IF v_link.allowed_email_domain IS NOT NULL AND v_caller_domain <> lower(trim(v_link.allowed_email_domain)) THEN
    RAISE EXCEPTION 'EMAIL_DOMAIN_NOT_ALLOWED' USING ERRCODE = 'PT403';
  END IF;

  SELECT id INTO v_sm_id
  FROM public.space_members
  WHERE space_id = v_link.space_id AND user_id = v_caller;

  IF v_sm_id IS NOT NULL THEN
    INSERT INTO public.share_link_events (share_link_id, event_type, actor_id, metadata)
    VALUES (v_link.id, 'already_member', v_caller, jsonb_build_object('space_id', v_link.space_id, 'space_member_id', v_sm_id));
    RETURN QUERY SELECT v_link.space_id, v_sm_id;
    RETURN;
  END IF;

  CASE v_link.default_role
    WHEN 'owner' THEN v_mapped_role := 'owner'::public.user_role;
    WHEN 'admin' THEN v_mapped_role := 'admin'::public.user_role;
    WHEN 'manager' THEN v_mapped_role := 'admin'::public.user_role;
    ELSE v_mapped_role := 'client'::public.user_role;
  END CASE;

  INSERT INTO public.space_members (space_id, user_id, member_type, role, invited_by)
  VALUES (v_link.space_id, v_caller, v_link.default_member_type, v_link.default_role, v_link.created_by)
  RETURNING id INTO v_sm_id;

  INSERT INTO public.space_memberships (
    space_id, profile_id, role, context_role, status, is_active, invited_by, joined_at, created_at, updated_at
  ) VALUES (
    v_link.space_id,
    v_caller,
    v_mapped_role,
    CASE v_link.default_member_type WHEN 'staff' THEN 'staff' ELSE 'client' END,
    'active', true, v_link.created_by, now(), now(), now()
  )
  ON CONFLICT (space_id, profile_id) DO UPDATE
    SET status = 'active',
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
  VALUES (v_link.id, 'joined', v_caller, jsonb_build_object('space_id', v_link.space_id, 'space_member_id', v_sm_id, 'space_membership_id', v_smp_id));

  RETURN QUERY SELECT v_link.space_id, v_sm_id;
END;
$$;

-- Token-hash columns remain invisible to API roles; mutations are RPC-only.
REVOKE ALL ON TABLE public.invitations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.space_members FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.invitation_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.space_share_links FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.share_link_uses FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.share_link_events FROM PUBLIC, anon, authenticated;

GRANT SELECT (id, space_id, email, member_type, role, status, invited_by, expires_at, accepted_at, accepted_by, revoked_at, created_at)
  ON public.invitations TO authenticated;
GRANT SELECT ON public.space_members TO authenticated;
GRANT SELECT ON public.invitation_events TO authenticated;
GRANT SELECT (id, space_id, default_member_type, default_role, allowed_email_domain, max_uses, use_count, expires_at, is_active, created_by, created_at, rotated_at)
  ON public.space_share_links TO authenticated;
GRANT SELECT ON public.share_link_uses TO authenticated;
GRANT SELECT ON public.share_link_events TO authenticated;

REVOKE ALL ON FUNCTION public.hash_token(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_space_role(uuid, uuid, public.member_role[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_space_role(uuid, uuid, public.member_role[]) TO authenticated;

REVOKE ALL ON FUNCTION public.create_invitation(uuid, text, public.member_type, public.member_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_invitation_by_token(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accept_invitation(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_invitation(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.regenerate_invitation(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_space_invitations(uuid, public.invite_status) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_space_members(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_invitation(uuid, text, public.member_type, public.member_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerate_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_space_invitations(uuid, public.invite_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_space_members(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_share_link(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rotate_share_link(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_share_link_config(uuid, public.member_type, public.member_role, text, integer, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.disable_share_link(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enable_share_link(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_share_link_by_token(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.join_via_share_link(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_share_link(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_share_link(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_share_link_config(uuid, public.member_type, public.member_role, text, integer, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.disable_share_link(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enable_share_link(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_share_link_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_via_share_link(text) TO authenticated;
