-- Supabase Postgres does not support encode(..., 'base64url').
-- Generate a normal base64 token and translate it into URL-safe form.

CREATE OR REPLACE FUNCTION public.generate_url_token()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT translate(rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='), '+/', '-_');
$$;

REVOKE ALL ON FUNCTION public.generate_url_token() FROM PUBLIC, anon, authenticated;

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
  v_caller     uuid := auth.uid();
  v_email      citext;
  v_raw_token  text;
  v_token_hash text;
  v_expires    timestamptz;
  v_invite_id  uuid;
  v_old_id     uuid;
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

  v_raw_token := public.generate_url_token();
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

CREATE OR REPLACE FUNCTION public.regenerate_invitation(p_invitation_id uuid)
RETURNS TABLE(invitation_id uuid, raw_token text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller     uuid := auth.uid();
  v_old        public.invitations%ROWTYPE;
  v_raw_token  text;
  v_token_hash text;
  v_expires    timestamptz;
  v_new_id     uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'PT401';
  END IF;

  SELECT * INTO v_old FROM public.invitations WHERE id = p_invitation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITE_NOT_FOUND' USING ERRCODE = 'PT404';
  END IF;

  IF NOT public.has_space_role(v_caller, v_old.space_id, ARRAY['owner','admin']::public.member_role[]) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED' USING ERRCODE = 'PT403';
  END IF;

  IF v_old.status = 'accepted' THEN
    RAISE EXCEPTION 'INVITE_ALREADY_ACCEPTED' USING ERRCODE = 'PT409';
  END IF;

  UPDATE public.invitations
  SET status = 'revoked', revoked_at = now()
  WHERE id = v_old.id AND status <> 'revoked';

  INSERT INTO public.invitation_events (invitation_id, event_type, actor_id, metadata)
  VALUES (v_old.id, 'revoked', v_caller, jsonb_build_object('reason', 'regenerated'));

  v_raw_token := public.generate_url_token();
  v_token_hash := public.hash_token(v_raw_token);
  v_expires := now() + interval '7 days';

  INSERT INTO public.invitations (space_id, email, member_type, role, token_hash, status, invited_by, expires_at)
  VALUES (v_old.space_id, v_old.email, v_old.member_type, v_old.role, v_token_hash, 'pending', v_caller, v_expires)
  RETURNING id INTO v_new_id;

  INSERT INTO public.invitation_events (invitation_id, event_type, actor_id, metadata)
  VALUES (v_new_id, 'regenerated', v_caller, jsonb_build_object('old_invitation_id', v_old.id, 'email', v_old.email, 'member_type', v_old.member_type, 'role', v_old.role));

  RETURN QUERY SELECT v_new_id, v_raw_token, v_expires;
END;
$$;

CREATE OR REPLACE FUNCTION public.rotate_share_link(p_space_id uuid)
RETURNS TABLE(raw_token text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller     uuid := auth.uid();
  v_raw_token  text;
  v_token_hash text;
  v_link       public.space_share_links%ROWTYPE;
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

  v_raw_token := public.generate_url_token();
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

REVOKE ALL ON FUNCTION public.create_invitation(uuid, text, public.member_type, public.member_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.regenerate_invitation(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rotate_share_link(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_invitation(uuid, text, public.member_type, public.member_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerate_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_share_link(uuid) TO authenticated;
