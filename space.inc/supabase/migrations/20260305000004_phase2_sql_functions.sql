-- =============================================================================
-- Migration: 20260305000004_phase2_sql_functions.sql
-- Phase 2: SQL Functions — The Logic Layer
-- =============================================================================
-- STRATEGY: Remove duplicate/recursive stat triggers, then replace/create all
-- domain RPCs according to the approved implementation plan.
-- Each domain function writes ONLY to its own table + exactly ONE activity_log.
-- No function will chain into another function that also writes logs.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- SECTION 0: DROP DUPLICATE/RECURSIVE TRIGGERS
-- These cause doubled stat writes and potential log cascade chains during testing
-- -----------------------------------------------------------------------------

-- files table: two competing stat triggers for same event
DROP TRIGGER IF EXISTS tr_sync_file_stats ON public.files;
DROP TRIGGER IF EXISTS trg_file_inserted_stats ON public.files;
DROP TRIGGER IF EXISTS trg_file_deleted_stats ON public.files;
DROP TRIGGER IF EXISTS tr_audit_files ON public.files;

-- meetings table: two competing stat triggers for same event
DROP TRIGGER IF EXISTS tr_sync_meeting_stats ON public.meetings;
DROP TRIGGER IF EXISTS trg_meeting_inserted_stats ON public.meetings;

-- messages table: two competing stat triggers for same event
DROP TRIGGER IF EXISTS tr_sync_message_stats ON public.messages;
DROP TRIGGER IF EXISTS trg_message_inserted_stats ON public.messages;
DROP TRIGGER IF EXISTS trg_message_deleted_stats ON public.messages;

-- profiles table: conflicts with handle_new_user's own org creation logic
DROP TRIGGER IF EXISTS trigger_auto_create_organization_profile ON public.profiles;

-- auth.users: drop the secondary trigger (handle_new_user is on on_auth_user_created)
-- trigger_auto_create_organization fires call_auto_create_organization which duplicates org logic
-- This only affects auth schema triggers
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_schema = 'auth'
    AND trigger_name = 'trigger_auto_create_organization'
    AND event_object_table = 'users'
  ) THEN
    EXECUTE 'DROP TRIGGER trigger_auto_create_organization ON auth.users';
  END IF;
END
$$;


-- -----------------------------------------------------------------------------
-- SECTION 1: 2A — HANDLE NEW USER TRIGGER (Fixed)
-- Added: organization_policies INSERT after org creation
-- Fixed: removed dangerous RAISE which would silently swallow auth
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id     uuid;
  v_org_name   text;
  v_full_name  text;
  v_role       text;
BEGIN
  -- Safely extract metadata
  v_org_name  := NEW.raw_user_meta_data->>'organization_name';
  v_full_name := NEW.raw_user_meta_data->>'full_name';
  v_role      := COALESCE(NEW.raw_user_meta_data->>'role', 'owner');

  -- Provide sensible default name
  IF v_full_name IS NULL OR v_full_name = '' THEN
    v_full_name := split_part(NEW.email, '@', 1);
  END IF;

  -- 1. Create Organization if metadata contains org name
  IF v_org_name IS NOT NULL AND v_org_name != '' THEN
    INSERT INTO public.organizations (name, plan_tier)
    VALUES (v_org_name, 'starter')
    RETURNING id INTO v_org_id;

    -- 2. Initialize Quotas for the new org
    PERFORM public.initialize_org_quotas(v_org_id);

    -- 3. Insert default organization policies (2A fix — was missing)
    INSERT INTO public.organization_policies (organization_id)
    VALUES (v_org_id)
    ON CONFLICT (organization_id) DO NOTHING;
  END IF;

  -- 4. Create the Profile row (id = auth.uid)
  INSERT INTO public.profiles (id, email, full_name, organization_id, role)
  VALUES (NEW.id, NEW.email, v_full_name, v_org_id, v_role)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the warning but NEVER fail the auth INSERT — user must still get their JWT
  RAISE WARNING 'handle_new_user failed for % (uid: %): %', NEW.email, NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;


-- -----------------------------------------------------------------------------
-- SECTION 2: 2H — CHECK_CAPABILITY (canonical alias for has_capability)
-- has_capability(target_user_id, cap_key, target_space_id) already exists.
-- We create check_capability as the clean canonical name going forward.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_capability(
  p_user_id    uuid,
  p_capability text,
  p_space_id   uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.has_capability(p_user_id, p_capability, p_space_id);
END;
$$;


-- -----------------------------------------------------------------------------
-- SECTION 3: 2B — REQUEST_UPLOAD_VOUCHER (Fixed: added capability check)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.request_upload_voucher(
  p_space_id    uuid,
  p_filename    text,
  p_content_type text,
  p_file_size   bigint DEFAULT NULL,
  p_checksum    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id      uuid;
  v_file_id     uuid;
  v_storage_path text;
  v_user_role   text;
BEGIN
  v_org_id := public.get_my_org_id_secure();

  -- Validate space belongs to org
  IF p_space_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.spaces WHERE id = p_space_id AND organization_id = v_org_id
  ) THEN
    RAISE EXCEPTION 'SPACE_NOT_FOUND';
  END IF;

  -- Get caller's role for capability check
  SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();

  -- Policy check: clients need explicit permission to upload
  IF v_user_role = 'client' THEN
    IF NOT public.check_capability(auth.uid(), 'client_can_upload', p_space_id) THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: client upload not allowed in this space';
    END IF;
  END IF;

  -- Generate deterministic storage path
  v_file_id := gen_random_uuid();
  v_storage_path := v_org_id::text
    || '/' || COALESCE(p_space_id::text, 'global')
    || '/' || v_file_id::text
    || '/' || p_filename;

  -- Create the pending file record
  INSERT INTO public.files (
    id, organization_id, space_id, name, display_name,
    mime_type, file_size, checksum, storage_path, status, uploaded_by, owner_role
  ) VALUES (
    v_file_id, v_org_id, p_space_id, p_filename, p_filename,
    p_content_type, p_file_size, p_checksum, v_storage_path, 'pending', auth.uid(), v_user_role
  );

  RETURN jsonb_build_object(
    'file_id', v_file_id,
    'storage_path', v_storage_path
  );
END;
$$;


-- -----------------------------------------------------------------------------
-- SECTION 4: 2B — CONFIRM_FILE_UPLOAD (Fixed: added virus_scan job enqueue)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.confirm_file_upload(
  p_file_id uuid
)
RETURNS public.files
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_file public.files;
BEGIN
  UPDATE public.files
  SET status = 'available', updated_at = now()
  WHERE id = p_file_id
    AND organization_id = public.get_my_org_id_secure()
    AND uploaded_by = auth.uid()
    AND status = 'pending'
  RETURNING * INTO v_file;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FILE_NOT_FOUND or already confirmed';
  END IF;

  -- Enqueue virus scan background job (2B fix — was missing)
  INSERT INTO public.background_jobs (
    organization_id, job_type, payload, idempotency_key
  ) VALUES (
    v_file.organization_id,
    'virus_scan',
    jsonb_build_object('file_id', p_file_id, 'storage_path', v_file.storage_path),
    'virus_scan_' || p_file_id::text
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  -- Audit log
  INSERT INTO public.activity_logs (organization_id, user_id, space_id, action_type, metadata)
  VALUES (
    v_file.organization_id, auth.uid(), v_file.space_id,
    'file_uploaded',
    jsonb_build_object('name', v_file.name, 'size', v_file.file_size, 'file_id', p_file_id)
  );

  RETURN v_file;
END;
$$;


-- -----------------------------------------------------------------------------
-- SECTION 5: 2B — RESTORE_FILE (New)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.restore_file(
  p_file_id uuid
)
RETURNS public.files
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_file public.files;
BEGIN
  UPDATE public.files
  SET status = 'available', deleted_at = NULL, updated_at = now()
  WHERE id = p_file_id
    AND organization_id = public.get_my_org_id_secure()
    AND status = 'deleted'
  RETURNING * INTO v_file;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FILE_NOT_FOUND or not in deleted state';
  END IF;

  INSERT INTO public.activity_logs (organization_id, user_id, space_id, action_type, metadata)
  VALUES (
    v_file.organization_id, auth.uid(), v_file.space_id,
    'file_restored',
    jsonb_build_object('name', v_file.name, 'file_id', p_file_id)
  );

  RETURN v_file;
END;
$$;


-- -----------------------------------------------------------------------------
-- SECTION 6: 2B — HARD_DELETE_FILE (New)
-- Returns storage_path so edge function can delete from storage
-- Only owner/admin/staff can hard-delete
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.hard_delete_file(
  p_file_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id       uuid;
  v_user_role    text;
  v_storage_path text;
  v_space_id     uuid;
  v_file_name    text;
BEGIN
  v_org_id := public.get_my_org_id_secure();

  SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();

  -- Only permitted roles can hard-delete
  IF v_user_role NOT IN ('owner', 'admin', 'staff') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: only staff and above can hard delete files';
  END IF;

  -- Cannot hard-delete files on legal hold
  IF EXISTS (SELECT 1 FROM public.files WHERE id = p_file_id AND is_legal_hold = true) THEN
    RAISE EXCEPTION 'FILE_LEGAL_HOLD: file is under legal hold and cannot be deleted';
  END IF;

  DELETE FROM public.files
  WHERE id = p_file_id AND organization_id = v_org_id
  RETURNING storage_path, space_id, name
  INTO v_storage_path, v_space_id, v_file_name;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FILE_NOT_FOUND';
  END IF;

  INSERT INTO public.activity_logs (organization_id, user_id, space_id, action_type, metadata)
  VALUES (
    v_org_id, auth.uid(), v_space_id,
    'file_hard_deleted',
    jsonb_build_object('name', v_file_name, 'file_id', p_file_id, 'storage_path', v_storage_path)
  );

  RETURN jsonb_build_object('storage_path', v_storage_path);
END;
$$;


-- -----------------------------------------------------------------------------
-- SECTION 7: 2C — CREATE_MEETING (canonical alias for create_meeting_v2)
-- Fixed: audit log uses activity_logs correctly; adds 'is_instant' to metadata
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_meeting(
  p_space_id          uuid,
  p_title             text,
  p_starts_at         timestamptz DEFAULT now(),
  p_duration_minutes  integer DEFAULT 60,
  p_description       text DEFAULT NULL,
  p_recording_enabled boolean DEFAULT true,
  p_daily_room_name   text DEFAULT NULL,
  p_daily_room_url    text DEFAULT NULL,
  p_is_instant        boolean DEFAULT false,
  p_meeting_type      text DEFAULT 'standard'
)
RETURNS public.meetings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id  uuid;
  v_meeting public.meetings;
BEGIN
  v_org_id := public.get_my_org_id_secure();

  IF NOT EXISTS (SELECT 1 FROM public.spaces WHERE id = p_space_id AND organization_id = v_org_id) THEN
    RAISE EXCEPTION 'SPACE_NOT_FOUND';
  END IF;

  INSERT INTO public.meetings (
    organization_id, space_id, title, starts_at, duration_minutes,
    description, recording_enabled, daily_room_name, daily_room_url,
    meeting_type, created_by, status
  ) VALUES (
    v_org_id, p_space_id, p_title, p_starts_at, p_duration_minutes,
    p_description, p_recording_enabled, p_daily_room_name, p_daily_room_url,
    p_meeting_type, auth.uid(),
    CASE WHEN p_is_instant THEN 'live' ELSE 'scheduled' END
  )
  RETURNING * INTO v_meeting;

  INSERT INTO public.activity_logs (organization_id, user_id, space_id, action_type, metadata)
  VALUES (
    v_org_id, auth.uid(), p_space_id,
    'meeting_created',
    jsonb_build_object(
      'title', p_title,
      'starts_at', p_starts_at,
      'is_instant', p_is_instant,
      'meeting_id', v_meeting.id
    )
  );

  RETURN v_meeting;
END;
$$;


-- Canonical aliases for meeting lifecycle functions
CREATE OR REPLACE FUNCTION public.start_meeting(p_meeting_id uuid, p_daily_room_url text DEFAULT NULL, p_daily_room_name text DEFAULT NULL)
RETURNS public.meetings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org_id  uuid;
  v_meeting public.meetings;
BEGIN
  v_org_id := public.get_my_org_id_secure();

  UPDATE public.meetings
  SET status = 'active',
      started_at = now(),
      daily_room_url = COALESCE(p_daily_room_url, daily_room_url),
      daily_room_name = COALESCE(p_daily_room_name, daily_room_name),
      updated_at = now()
  WHERE id = p_meeting_id AND organization_id = v_org_id
  RETURNING * INTO v_meeting;

  IF NOT FOUND THEN RAISE EXCEPTION 'MEETING_NOT_FOUND'; END IF;

  RETURN v_meeting;
END; $$;

CREATE OR REPLACE FUNCTION public.end_meeting(p_meeting_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org_id uuid;
BEGIN
  v_org_id := public.get_my_org_id_secure();

  UPDATE public.meetings
  SET status = 'ended',
      ended_at = now(),
      updated_at = now()
  WHERE id = p_meeting_id AND organization_id = v_org_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'MEETING_NOT_FOUND'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.join_meeting(p_meeting_id uuid)
RETURNS public.meetings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org_id  uuid;
  v_meeting public.meetings;
BEGIN
  v_org_id := public.get_my_org_id_secure();

  SELECT * INTO v_meeting
  FROM public.meetings
  WHERE id = p_meeting_id AND organization_id = v_org_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'MEETING_NOT_FOUND'; END IF;

  -- Insert participant record
  INSERT INTO public.meeting_participants (meeting_id, profile_id, role, joined_at)
  VALUES (p_meeting_id, auth.uid(), (SELECT role FROM public.profiles WHERE id = auth.uid()), now())
  ON CONFLICT DO NOTHING;

  RETURN v_meeting;
END; $$;

CREATE OR REPLACE FUNCTION public.cancel_meeting(p_meeting_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org_id  uuid;
  v_space_id uuid;
  v_title text;
BEGIN
  v_org_id := public.get_my_org_id_secure();

  SELECT space_id, title INTO v_space_id, v_title
  FROM public.meetings
  WHERE id = p_meeting_id AND organization_id = v_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEETING_NOT_FOUND';
  END IF;

  UPDATE public.meetings
  SET status = 'cancelled',
      deleted_at = now(),
      updated_at = now()
  WHERE id = p_meeting_id;

  INSERT INTO public.activity_logs (organization_id, user_id, space_id, action_type, metadata)
  VALUES (
    v_org_id, auth.uid(), v_space_id,
    'meeting_cancelled',
    jsonb_build_object(
      'title', v_title,
      'meeting_id', p_meeting_id
    )
  );
END; $$;


-- -----------------------------------------------------------------------------
-- SECTION 8: 2D — CREATE_TASK (Fixed: client policy gate added)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_task(
  p_space_id    uuid,
  p_title       text,
  p_description text DEFAULT NULL,
  p_due_date    date DEFAULT NULL,
  p_priority    text DEFAULT 'medium',
  p_assignee_id uuid DEFAULT NULL,
  p_status      text DEFAULT 'Pending'
)
RETURNS public.tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id    uuid;
  v_user_role text;
  v_task      public.tasks;
BEGIN
  v_org_id := public.get_my_org_id_secure();

  SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();

  -- Policy gate: clients must have explicit permission to create tasks
  IF v_user_role = 'client' THEN
    IF NOT public.check_capability(auth.uid(), 'client_can_create_tasks', p_space_id) THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: clients cannot create tasks in this space';
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.spaces WHERE id = p_space_id AND organization_id = v_org_id) THEN
    RAISE EXCEPTION 'SPACE_NOT_FOUND';
  END IF;

  INSERT INTO public.tasks (
    space_id, organization_id, title, description,
    status, priority, due_date, assignee_id, created_by
  ) VALUES (
    p_space_id, v_org_id, p_title, p_description,
    p_status, p_priority, p_due_date, p_assignee_id, auth.uid()
  )
  RETURNING * INTO v_task;

  INSERT INTO public.activity_logs (organization_id, user_id, space_id, action_type, metadata)
  VALUES (
    v_org_id, auth.uid(), p_space_id,
    'task_created',
    jsonb_build_object('title', p_title, 'task_id', v_task.id)
  );

  RETURN v_task;
END;
$$;

-- Canonical aliases for task functions
CREATE OR REPLACE FUNCTION public.update_task(p_task_id uuid, p_updates jsonb)
RETURNS public.tasks LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RETURN public.update_task_v2(p_task_id, p_updates); END; $$;

CREATE OR REPLACE FUNCTION public.delete_task(p_task_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.delete_task_v2(p_task_id); END; $$;

CREATE OR REPLACE FUNCTION public.list_tasks(p_space_id uuid DEFAULT NULL)
RETURNS SETOF public.tasks LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RETURN QUERY SELECT * FROM public.list_tasks_v2(p_space_id); END; $$;


-- -----------------------------------------------------------------------------
-- SECTION 9: 2E — GET_MY_PROFILE + UPDATE_MY_PROFILE (New)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.get_my_profile_v2();
END;
$$;

CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_updates jsonb
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result public.profiles;
BEGIN
  -- Only allow safe, user-controlled fields — role, organization_id, email are DROPPED silently
  UPDATE public.profiles SET
    full_name  = COALESCE(p_updates->>'full_name',  full_name),
    avatar_url = COALESCE(p_updates->>'avatar_url', avatar_url),
    phone      = CASE WHEN p_updates ? 'phone' THEN p_updates->>'phone' ELSE phone END,
    updated_at = now()
  WHERE id = auth.uid()
  RETURNING * INTO v_result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  RETURN v_result;
END;
$$;


-- -----------------------------------------------------------------------------
-- SECTION 10: 2F — LIST_MESSAGES (canonical alias)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_messages(
  p_space_id uuid,
  p_channel  text DEFAULT NULL,
  p_before   timestamptz DEFAULT NULL,
  p_limit    integer DEFAULT 50
)
RETURNS TABLE (
  id           uuid,
  content      text,
  sender_id    uuid,
  sender_type  text,
  channel      text,
  created_at   timestamptz,
  parent_id    uuid,
  reply_count  integer,
  sender_name  text,
  sender_avatar text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.list_messages_v2(p_space_id, p_channel, p_before, p_limit);
END;
$$;


-- -----------------------------------------------------------------------------
-- SECTION 11: 2G — LIST_ACTIVITY_LOGS (canonical alias)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_activity_logs(
  p_space_id uuid DEFAULT NULL,
  p_limit    integer DEFAULT 100
)
RETURNS TABLE (
  id          uuid,
  action_type text,
  user_id     uuid,
  space_id    uuid,
  metadata    jsonb,
  created_at  timestamptz,
  user_name   text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.list_activity_logs_v2(p_space_id, p_limit);
END;
$$;


-- -----------------------------------------------------------------------------
-- SECTION 12: Single clean stat trigger (replaces the deleted ones)
-- Only updates space_stats counts — does NOT write to activity_logs
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trg_update_space_stats_clean()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_space_id uuid;
  v_org_id   uuid;
BEGIN
  -- Determine the space_id from the changed row
  v_space_id := COALESCE(NEW.space_id, OLD.space_id);
  IF v_space_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT organization_id INTO v_org_id FROM public.spaces WHERE id = v_space_id;

  INSERT INTO public.space_stats (space_id, organization_id, updated_at)
  VALUES (v_space_id, v_org_id, now())
  ON CONFLICT (space_id) DO UPDATE
    SET updated_at = now();

  -- Asynchronously roll up (we refrain from heavy SELECT COUNT(*) in trigger for perf)
  -- Full rollup is run by space-analytics-worker periodically
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach the clean single trigger to each domain table
DROP TRIGGER IF EXISTS trg_clean_stats_messages ON public.messages;
CREATE TRIGGER trg_clean_stats_messages
  AFTER INSERT OR DELETE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_update_space_stats_clean();

DROP TRIGGER IF EXISTS trg_clean_stats_files ON public.files;
CREATE TRIGGER trg_clean_stats_files
  AFTER INSERT OR DELETE ON public.files
  FOR EACH ROW EXECUTE FUNCTION public.trg_update_space_stats_clean();

DROP TRIGGER IF EXISTS trg_clean_stats_meetings ON public.meetings;
CREATE TRIGGER trg_clean_stats_meetings
  AFTER INSERT OR DELETE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.trg_update_space_stats_clean();
