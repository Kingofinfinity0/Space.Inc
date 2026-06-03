-- Consolidate old non-payment SECURITY DEFINER functions.
-- Payment/subscription candidates are intentionally left untouched for a later billing cleanup pass.

CREATE OR REPLACE FUNCTION public.update_task(p_task_id uuid, p_updates jsonb)
RETURNS public.tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_task public.tasks;
BEGIN
  v_org_id := public.get_my_org_id_secure();

  UPDATE public.tasks
  SET title = COALESCE(p_updates->>'title', title),
      description = CASE WHEN p_updates ? 'description' THEN p_updates->>'description' ELSE description END,
      status = COALESCE(p_updates->>'status', status),
      priority = COALESCE(p_updates->>'priority', priority),
      due_date = CASE
        WHEN p_updates ? 'due_date' THEN NULLIF(p_updates->>'due_date', '')::date
        ELSE due_date
      END,
      assignee_id = CASE
        WHEN p_updates ? 'assignee_id' THEN NULLIF(p_updates->>'assignee_id', '')::uuid
        ELSE assignee_id
      END,
      completed_at = CASE
        WHEN p_updates->>'status' = 'done' THEN now()
        WHEN p_updates ? 'status' AND p_updates->>'status' <> 'done' THEN NULL
        ELSE completed_at
      END,
      updated_at = now()
  WHERE id = p_task_id
    AND organization_id = v_org_id
  RETURNING * INTO v_task;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TASK_NOT_FOUND';
  END IF;

  RETURN v_task;
END;
$function$;

DROP FUNCTION IF EXISTS public.archive_space_v2(uuid);
DROP FUNCTION IF EXISTS public.create_meeting_v2(uuid, text, timestamp with time zone, integer, text, boolean, text, text, text);
DROP FUNCTION IF EXISTS public.create_space_v2(text, text, text, text, text[], jsonb);
DROP FUNCTION IF EXISTS public.create_task_v2(uuid, text, text, text, text, timestamp with time zone, uuid);
DROP FUNCTION IF EXISTS public.delete_task_v2(uuid);
DROP FUNCTION IF EXISTS public.get_my_profile_v2();
DROP FUNCTION IF EXISTS public.list_activity_logs_v2(uuid, integer);
DROP FUNCTION IF EXISTS public.list_files_v2(uuid);
DROP FUNCTION IF EXISTS public.list_spaces_v2();
DROP FUNCTION IF EXISTS public.list_tasks_v2(uuid);
DROP FUNCTION IF EXISTS public.update_task_v2(uuid, jsonb);

DROP FUNCTION IF EXISTS public.request_upload_voucher(uuid, uuid, text, text, text, text);
DROP FUNCTION IF EXISTS public.confirm_file_upload(uuid, uuid);
DROP FUNCTION IF EXISTS public.soft_delete_file(uuid, uuid);
DROP FUNCTION IF EXISTS public.restore_file(uuid, uuid);
DROP FUNCTION IF EXISTS public.hard_delete_file(uuid, uuid);

DROP FUNCTION IF EXISTS public.call_auto_create_organization();
DROP FUNCTION IF EXISTS public.handle_new_message_notification();
DROP FUNCTION IF EXISTS public.trg_file_deleted_stats();
DROP FUNCTION IF EXISTS public.trg_file_inserted_stats();
DROP FUNCTION IF EXISTS public.trg_meeting_inserted_stats();
DROP FUNCTION IF EXISTS public.trg_message_deleted_stats();
DROP FUNCTION IF EXISTS public.trg_message_inserted_stats();
DROP FUNCTION IF EXISTS public.update_conversation_on_message();

COMMENT ON FUNCTION public.update_task(uuid, jsonb)
IS 'Canonical task update RPC. Inlined former update_task_v2 logic so update_task_v2 can be removed.';
