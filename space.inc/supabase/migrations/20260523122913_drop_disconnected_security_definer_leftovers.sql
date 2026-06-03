-- Consolidate the last disconnected SECURITY DEFINER leftovers.
--
-- These functions had no current React caller, no current Edge Function caller,
-- no trigger/event-trigger binding, no policy/view reference, and no cron job.
-- Payment and billing functions are intentionally left in place for the later
-- payment cleanup pass.

CREATE OR REPLACE FUNCTION public.notify_space_members(
  p_space_id uuid,
  p_org_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_action_url text DEFAULT NULL::text,
  p_exclude_user uuid DEFAULT NULL::uuid,
  p_client_only boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_member record;
BEGIN
  FOR v_member IN
    SELECT sm.profile_id, p.role::text AS role
    FROM public.space_memberships sm
    JOIN public.profiles p ON p.id = sm.profile_id
    WHERE sm.space_id = p_space_id
      AND sm.is_active = true
      AND sm.profile_id != COALESCE(p_exclude_user, '00000000-0000-0000-0000-000000000000'::uuid)
      AND (NOT p_client_only OR p.role::text = 'client')
  LOOP
    BEGIN
      INSERT INTO public.notifications (
        organization_id, space_id, recipient_id, user_id,
        type, title, message, read,
        action_url, delivery_status, payload
      ) VALUES (
        p_org_id, p_space_id, v_member.profile_id, v_member.profile_id,
        p_type, p_title, p_message, false,
        p_action_url, 'delivered',
        jsonb_build_object(
          'title', p_title,
          'message', p_message,
          'space_id', p_space_id,
          'action_url', p_action_url
        )
      )
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_space_members: failed for user %: %', v_member.profile_id, SQLERRM;
    END;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_space_members (outer): %', SQLERRM;
END;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_file_upload(p_file_id uuid)
RETURNS public.files
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_file       public.files;
  v_uploader   text;
  v_ver_num    int;
BEGIN
  UPDATE public.files SET status = 'available', updated_at = now()
  WHERE id = p_file_id AND organization_id = public.get_my_org_id_secure()
    AND uploaded_by = auth.uid() AND status = 'pending'
  RETURNING * INTO v_file;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FILE_NOT_FOUND: File does not exist or was already confirmed';
  END IF;

  SELECT COALESCE(full_name, split_part(email, '@', 1))
  INTO v_uploader
  FROM public.profiles
  WHERE id = auth.uid();

  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO v_ver_num
  FROM public.file_versions
  WHERE file_id = p_file_id;

  INSERT INTO public.file_versions (file_id, storage_path, version_number, file_size, checksum, uploaded_by)
  VALUES (p_file_id, v_file.storage_path, v_ver_num, v_file.file_size, v_file.checksum, auth.uid());

  INSERT INTO public.background_jobs (organization_id, job_type, payload, idempotency_key)
  VALUES (
    v_file.organization_id,
    'virus_scan',
    jsonb_build_object('file_id', p_file_id, 'storage_path', v_file.storage_path),
    'virus_scan_' || p_file_id::text
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  INSERT INTO public.activity_logs (organization_id, user_id, space_id, action_type, metadata)
  VALUES (
    v_file.organization_id,
    auth.uid(),
    v_file.space_id,
    'file_uploaded',
    jsonb_build_object('name', v_file.name, 'size', v_file.file_size, 'file_id', p_file_id)
  );

  UPDATE public.space_stats
  SET file_count = file_count + 1,
      last_activity_at = now(),
      updated_at = now()
  WHERE space_id = v_file.space_id;

  BEGIN
    IF v_file.space_id IS NOT NULL THEN
      PERFORM public.notify_space_members(
        p_space_id := v_file.space_id,
        p_org_id := v_file.organization_id,
        p_type := 'file_uploaded',
        p_title := COALESCE(v_uploader, 'Someone') || ' uploaded a file',
        p_message := v_file.name,
        p_action_url := '/spaces/' || v_file.space_id || '/files',
        p_exclude_user := auth.uid(),
        p_client_only := false
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'confirm_file_upload: notification side effect failed: %', SQLERRM;
  END;

  RETURN v_file;
END;
$function$;

DROP FUNCTION IF EXISTS public.list_tasks(uuid);
DROP FUNCTION IF EXISTS public.notify_space_members(uuid, text, text, text, text, uuid, text, uuid);
DROP FUNCTION IF EXISTS public.attach_daily_room(uuid, text, text);
DROP FUNCTION IF EXISTS public.cleanup_deleted_files();
DROP FUNCTION IF EXISTS public.cleanup_read_notifications();
DROP FUNCTION IF EXISTS public.create_notification(uuid, uuid, text, text, text, uuid, text, jsonb, text);
DROP FUNCTION IF EXISTS public.create_share_link(uuid, public.member_type, public.member_role);
DROP FUNCTION IF EXISTS public.get_acquisition_pipeline();
DROP FUNCTION IF EXISTS public.get_activity_feed(integer);
DROP FUNCTION IF EXISTS public.get_auth_context();
DROP FUNCTION IF EXISTS public.get_auth_org_id();
DROP FUNCTION IF EXISTS public.get_client_engagement_scores();
DROP FUNCTION IF EXISTS public.get_meeting_intelligence(integer);
DROP FUNCTION IF EXISTS public.get_owner_dashboard_summary();
DROP FUNCTION IF EXISTS public.get_space_dashboard(uuid);
DROP FUNCTION IF EXISTS public.get_staff_dashboard_summary();
DROP FUNCTION IF EXISTS public.get_staff_performance();
DROP FUNCTION IF EXISTS public.get_user_context();
DROP FUNCTION IF EXISTS public.get_user_org_id(uuid);
DROP FUNCTION IF EXISTS public.get_user_organization_id();
DROP FUNCTION IF EXISTS public.get_user_role_safe(uuid);
DROP FUNCTION IF EXISTS public.increment_space_notifications(uuid);
DROP FUNCTION IF EXISTS public.is_staff_or_owner();
DROP FUNCTION IF EXISTS public.log_activity(uuid, uuid, text, text, uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.permanent_delete_file(uuid);
DROP FUNCTION IF EXISTS public.record_meeting_outcome(uuid, text, text);
DROP FUNCTION IF EXISTS public.user_belongs_to_org(uuid, uuid);
DROP FUNCTION IF EXISTS public.user_has_role(uuid, text);
DROP FUNCTION IF EXISTS public.user_is_staff_or_above(uuid);
DROP FUNCTION IF EXISTS public.validate_session();
