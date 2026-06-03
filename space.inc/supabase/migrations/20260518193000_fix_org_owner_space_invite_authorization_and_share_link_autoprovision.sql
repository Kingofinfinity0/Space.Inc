-- Organization owners/admins should be able to manage invitations for spaces
-- inside their organization, even when they are not explicitly assigned as
-- per-space members yet. Also keep one standing share-link row per space.

CREATE OR REPLACE FUNCTION public.ensure_space_share_link(_space_id uuid, _created_by uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link_id uuid;
  v_created_by uuid;
BEGIN
  SELECT id INTO v_link_id
  FROM public.space_share_links
  WHERE space_id = _space_id;

  IF v_link_id IS NOT NULL THEN
    RETURN v_link_id;
  END IF;

  SELECT COALESCE(
    _created_by,
    s.created_by,
    (
      SELECT p.id
      FROM public.profiles p
      WHERE p.organization_id = s.organization_id
        AND p.role IN ('owner', 'admin')
      ORDER BY CASE p.role WHEN 'owner' THEN 0 ELSE 1 END, p.created_at ASC
      LIMIT 1
    ),
    (
      SELECT u.id
      FROM auth.users u
      ORDER BY u.created_at ASC
      LIMIT 1
    )
  ) INTO v_created_by
  FROM public.spaces s
  WHERE s.id = _space_id;

  IF v_created_by IS NULL THEN
    RAISE EXCEPTION 'SHARE_LINK_CREATOR_NOT_FOUND' USING ERRCODE = 'PT404';
  END IF;

  INSERT INTO public.space_share_links (
    space_id, token_hash, default_member_type, default_role, created_by
  ) VALUES (
    _space_id,
    public.hash_token(public.generate_url_token()),
    'client'::public.member_type,
    'member'::public.member_role,
    v_created_by
  )
  ON CONFLICT (space_id) DO NOTHING
  RETURNING id INTO v_link_id;

  IF v_link_id IS NULL THEN
    SELECT id INTO v_link_id
    FROM public.space_share_links
    WHERE space_id = _space_id;
  END IF;

  RETURN v_link_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_space_share_link_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_space_share_link(NEW.id, COALESCE(NEW.created_by, auth.uid()));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_space_share_link_after_insert ON public.spaces;
CREATE TRIGGER trg_create_space_share_link_after_insert
AFTER INSERT ON public.spaces
FOR EACH ROW
EXECUTE FUNCTION public.create_space_share_link_after_insert();

CREATE OR REPLACE FUNCTION public.has_space_role(_user uuid, _space uuid, _roles public.member_role[])
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mapped_roles text[] := ARRAY[]::text[];
  v_role         public.member_role;
BEGIN
  IF _user IS NULL OR _space IS NULL THEN
    RETURN false;
  END IF;

  FOREACH v_role IN ARRAY _roles LOOP
    CASE v_role
      WHEN 'owner' THEN v_mapped_roles := array_append(v_mapped_roles, 'owner');
      WHEN 'admin' THEN v_mapped_roles := array_append(v_mapped_roles, 'admin');
      WHEN 'manager' THEN v_mapped_roles := array_append(v_mapped_roles, 'admin');
      WHEN 'member' THEN v_mapped_roles := array_append(v_mapped_roles, 'client');
      WHEN 'viewer' THEN v_mapped_roles := array_append(v_mapped_roles, 'client');
      ELSE NULL;
    END CASE;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM public.space_members sm
    WHERE sm.user_id = _user
      AND sm.space_id = _space
      AND sm.role = ANY(_roles)
  ) THEN
    RETURN true;
  END IF;

  IF array_length(v_mapped_roles, 1) > 0 AND EXISTS (
    SELECT 1
    FROM public.space_memberships sm
    WHERE sm.profile_id = _user
      AND sm.space_id = _space
      AND sm.is_active = true
      AND sm.role::text = ANY(v_mapped_roles)
  ) THEN
    RETURN true;
  END IF;

  IF array_length(v_mapped_roles, 1) > 0 AND EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.spaces s ON s.organization_id = p.organization_id
    WHERE p.id = _user
      AND s.id = _space
      AND COALESCE(p.is_active, true) = true
      AND p.role = ANY(v_mapped_roles)
  ) THEN
    RETURN true;
  END IF;

  IF array_length(v_mapped_roles, 1) > 0 AND EXISTS (
    SELECT 1
    FROM public.org_memberships om
    JOIN public.spaces s ON s.organization_id = om.organization_id
    WHERE om.user_id = _user
      AND s.id = _space
      AND COALESCE(om.status, 'active') = 'active'
      AND (om.role = ANY(v_mapped_roles) OR om.base_role = ANY(v_mapped_roles))
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_share_link(p_space_id uuid)
RETURNS TABLE(id uuid, default_member_type public.member_type, default_role public.member_role, allowed_email_domain text, max_uses integer, use_count integer, expires_at timestamptz, is_active boolean, created_at timestamptz, rotated_at timestamptz)
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

  IF NOT public.has_space_role(v_caller, p_space_id, ARRAY['owner','admin']::public.member_role[]) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED' USING ERRCODE = 'PT403';
  END IF;

  PERFORM public.ensure_space_share_link(p_space_id, v_caller);

  RETURN QUERY
    SELECT ssl.id, ssl.default_member_type, ssl.default_role, ssl.allowed_email_domain, ssl.max_uses, ssl.use_count, ssl.expires_at, ssl.is_active, ssl.created_at, ssl.rotated_at
    FROM public.space_share_links ssl
    WHERE ssl.space_id = p_space_id;
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

  PERFORM public.ensure_space_share_link(p_space_id, v_caller);

  SELECT * INTO v_link
  FROM public.space_share_links ssl
  WHERE ssl.space_id = p_space_id
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
  WHERE space_share_links.id = v_link.id
  RETURNING * INTO v_link;

  INSERT INTO public.share_link_events (share_link_id, event_type, actor_id, metadata)
  VALUES (v_link.id, 'rotated', v_caller, jsonb_build_object('space_id', p_space_id));

  RETURN QUERY SELECT v_raw_token, v_link.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_space_share_link(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_space_share_link_after_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_space_role(uuid, uuid, public.member_role[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_share_link(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rotate_share_link(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_space_role(uuid, uuid, public.member_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_share_link(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_share_link(uuid) TO authenticated;
