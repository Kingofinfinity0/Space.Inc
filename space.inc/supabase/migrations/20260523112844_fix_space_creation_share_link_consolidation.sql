-- Fix space creation failures caused by an obsolete base64url token generator,
-- and keep one canonical auto-provision path for space share links/stats.

DROP TRIGGER IF EXISTS after_space_created_share_link ON public.spaces;
DROP FUNCTION IF EXISTS public.trg_auto_create_share_link();

DROP TRIGGER IF EXISTS tr_init_stats_spaces ON public.spaces;
DROP FUNCTION IF EXISTS public.init_space_stats();

CREATE OR REPLACE FUNCTION public.create_share_link(
  p_space_id uuid,
  p_default_member_type public.member_type DEFAULT 'client'::public.member_type,
  p_default_role public.member_role DEFAULT 'member'::public.member_role
)
RETURNS TABLE(raw_token text, share_link_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller     uuid := auth.uid();
  v_raw_token  text;
  v_token_hash text;
  v_link_id    uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'PT401';
  END IF;

  IF NOT public.has_space_role(v_caller, p_space_id, ARRAY['owner','admin']::public.member_role[]) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED' USING ERRCODE = 'PT403';
  END IF;

  IF EXISTS (SELECT 1 FROM public.space_share_links WHERE space_id = p_space_id) THEN
    RAISE EXCEPTION 'SHARE_LINK_EXISTS: use rotate_share_link instead' USING ERRCODE = 'PT409';
  END IF;

  v_raw_token := public.generate_url_token();
  v_token_hash := public.hash_token(v_raw_token);

  INSERT INTO public.space_share_links (
    space_id, token_hash, default_member_type, default_role, created_by
  )
  VALUES (p_space_id, v_token_hash, p_default_member_type, p_default_role, v_caller)
  RETURNING id INTO v_link_id;

  RETURN QUERY SELECT v_raw_token, v_link_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_space(
  p_name text,
  p_description text DEFAULT NULL::text,
  p_modules jsonb DEFAULT '{"messages": true, "chat": true, "upload": true, "meetings": true}'::jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id          uuid := auth.uid();
  v_org_id           uuid;
  v_role             text;
  v_space_id         uuid;
  v_raw_token        text;
  v_token_hash       text;
  v_app_url          text := 'https://space-inc.vercel.app';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'PT401';
  END IF;

  IF trim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'VAL_MISSING_FIELD' USING ERRCODE = 'PT400';
  END IF;

  SELECT organization_id, role INTO v_org_id, v_role
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND' USING ERRCODE = 'PT404';
  END IF;

  IF v_role NOT IN ('owner', 'admin', 'staff') THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED' USING ERRCODE = 'PT403';
  END IF;

  INSERT INTO public.spaces (
    organization_id, name, description, modules, metadata, status, created_by, created_at, updated_at
  ) VALUES (
    v_org_id,
    trim(p_name),
    p_description,
    coalesce(p_modules, '{"messages": true, "chat": true, "upload": true, "meetings": true}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb),
    'active',
    v_user_id,
    now(),
    now()
  )
  RETURNING id INTO v_space_id;

  INSERT INTO public.space_memberships (
    space_id,
    profile_id,
    role,
    permission_level,
    is_active,
    status,
    joined_at,
    capabilities,
    org_id,
    context_role,
    assigned_by
  ) VALUES (
    v_space_id,
    v_user_id,
    'owner'::public.space_member_role,
    'principal'::public.space_permission_level,
    true,
    'active',
    now(),
    '{"can_view":true,"can_edit":true,"can_delete":true,"can_delegate":true,"can_manage_tasks":true,"can_upload_files":true,"can_message_client":true}'::jsonb,
    v_org_id,
    'owner',
    v_user_id
  )
  ON CONFLICT (space_id, profile_id) DO UPDATE
    SET role = EXCLUDED.role,
        permission_level = EXCLUDED.permission_level,
        is_active = true,
        status = 'active',
        capabilities = EXCLUDED.capabilities,
        org_id = EXCLUDED.org_id,
        context_role = EXCLUDED.context_role,
        assigned_by = EXCLUDED.assigned_by,
        updated_at = now();

  INSERT INTO public.space_members (space_id, user_id, member_type, role, invited_by)
  VALUES (v_space_id, v_user_id, 'staff'::public.member_type, 'owner'::public.member_role, v_user_id)
  ON CONFLICT (space_id, user_id) DO NOTHING;

  v_raw_token := public.generate_url_token();
  v_token_hash := public.hash_token(v_raw_token);

  INSERT INTO public.space_share_links (space_id, token_hash, default_member_type, default_role, created_by, is_active)
  VALUES (v_space_id, v_token_hash, 'client'::public.member_type, 'member'::public.member_role, v_user_id, true)
  ON CONFLICT (space_id) DO UPDATE
    SET token_hash = EXCLUDED.token_hash,
        default_member_type = EXCLUDED.default_member_type,
        default_role = EXCLUDED.default_role,
        created_by = EXCLUDED.created_by,
        use_count = 0,
        is_active = true,
        rotated_at = now();

  INSERT INTO public.space_stats (space_id, organization_id)
  VALUES (v_space_id, v_org_id)
  ON CONFLICT (space_id) DO NOTHING;

  INSERT INTO public.activity_logs (organization_id, user_id, space_id, action_type, metadata)
  VALUES (v_org_id, v_user_id, v_space_id, 'space_created', jsonb_build_object('name', trim(p_name)));

  RETURN jsonb_build_object(
    'id', v_space_id,
    'share_link_token', v_raw_token,
    'share_link_url', v_app_url || '/join/' || v_raw_token,
    'invitation_token', v_raw_token,
    'invitation_url', v_app_url || '/join/' || v_raw_token
  );
END;
$function$;

COMMENT ON FUNCTION public.create_space(text, text, jsonb, jsonb)
IS 'Canonical space creation RPC. Creates the space, owner membership, member record, share link, stats row, and activity log.';

COMMENT ON FUNCTION public.create_space_share_link_after_insert()
IS 'Canonical trigger path for spaces inserted outside create_space; ensures exactly one share link row exists.';

COMMENT ON FUNCTION public.trg_space_created_stats()
IS 'Canonical trigger path for initializing space_stats for spaces inserted outside create_space.';
