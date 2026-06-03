CREATE OR REPLACE FUNCTION public.list_user_spaces()
RETURNS TABLE(
  id uuid,
  name text,
  description text,
  modules jsonb,
  status text,
  created_at timestamptz,
  member_count bigint,
  file_count bigint,
  message_count bigint,
  organization_id uuid,
  visibility text,
  role text,
  permission_level text,
  last_activity_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_user_role text;
BEGIN
  SELECT p.organization_id, p.role
  INTO v_org_id, v_user_role
  FROM public.profiles p
  WHERE p.id = v_user_id;

  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.description,
    s.modules,
    s.status,
    s.created_at,
    COALESCE(ss.member_count, 0) AS member_count,
    COALESCE(ss.file_count, 0) AS file_count,
    COALESCE(ss.message_count, 0) AS message_count,
    s.organization_id,
    COALESCE(s.modules->>'visibility', 'private') AS visibility,
    COALESCE(sm_user.role, v_user_role, 'member')::text AS role,
    CASE
      WHEN v_user_role IN ('owner', 'admin') THEN 'full'
      WHEN sm_user.role = 'manager' THEN 'manage'
      ELSE 'view'
    END AS permission_level,
    COALESCE(
      (
        SELECT m.created_at
        FROM public.messages m
        WHERE m.space_id = s.id
          AND m.deleted_at IS NULL
        ORDER BY m.created_at DESC
        LIMIT 1
      ),
      s.created_at
    ) AS last_activity_at
  FROM public.spaces s
  LEFT JOIN public.space_stats ss ON ss.space_id = s.id
  LEFT JOIN public.space_memberships sm_user
    ON sm_user.space_id = s.id
    AND sm_user.profile_id = v_user_id
    AND sm_user.is_active = true
  WHERE s.organization_id = v_org_id
    AND s.deleted_at IS NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.space_memberships sm
        WHERE sm.space_id = s.id
          AND sm.profile_id = v_user_id
          AND sm.is_active = true
      )
      OR v_user_role = 'owner'
    )
  ORDER BY last_activity_at DESC NULLS LAST;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_task(p_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_task public.tasks;
BEGIN
  v_org_id := public.get_my_org_id_secure();

  DELETE FROM public.tasks
  WHERE id = p_task_id
    AND organization_id = v_org_id
  RETURNING * INTO v_task;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TASK_NOT_FOUND';
  END IF;

  INSERT INTO public.activity_logs (organization_id, user_id, space_id, action_type, metadata)
  VALUES (
    v_org_id,
    auth.uid(),
    v_task.space_id,
    'task_deleted',
    jsonb_build_object('title', v_task.title, 'task_id', p_task_id)
  );
END;
$function$;

COMMENT ON FUNCTION public.list_user_spaces()
IS 'Canonical spaces list RPC. Fixed ambiguous organization_id reference after removing list_spaces_v2.';

COMMENT ON FUNCTION public.delete_task(uuid)
IS 'Canonical task delete RPC. Inlined former delete_task_v2 behavior so delete_task_v2 remains removed.';
