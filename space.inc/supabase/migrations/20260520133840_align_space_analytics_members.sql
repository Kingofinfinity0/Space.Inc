-- Align analytics with the unified membership model and make space activity
-- counters refresh whenever the underlying rows change.

CREATE OR REPLACE FUNCTION public.rollup_space_stats(p_space_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id uuid;
    v_message_count integer;
    v_file_count integer;
    v_meeting_count integer;
    v_member_count integer;
    v_last_activity timestamptz;
BEGIN
    SELECT organization_id
    INTO v_org_id
    FROM public.spaces
    WHERE id = p_space_id;

    IF v_org_id IS NULL THEN
        RETURN;
    END IF;

    SELECT COUNT(*)
    INTO v_message_count
    FROM public.messages
    WHERE space_id = p_space_id
      AND deleted_at IS NULL;

    SELECT COUNT(*)
    INTO v_file_count
    FROM public.files
    WHERE space_id = p_space_id
      AND deleted_at IS NULL;

    SELECT COUNT(*)
    INTO v_meeting_count
    FROM public.meetings
    WHERE space_id = p_space_id
      AND deleted_at IS NULL;

    SELECT COUNT(DISTINCT member_user_id)
    INTO v_member_count
    FROM (
        SELECT sm.user_id AS member_user_id
        FROM public.space_members sm
        WHERE sm.space_id = p_space_id

        UNION

        SELECT smh.profile_id AS member_user_id
        FROM public.space_memberships smh
        WHERE smh.space_id = p_space_id
          AND COALESCE(smh.is_active, true) = true
          AND COALESCE(smh.status, 'active') = 'active'
    ) members
    WHERE member_user_id IS NOT NULL;

    SELECT MAX(activity_at)
    INTO v_last_activity
    FROM (
        SELECT MAX(created_at) AS activity_at
        FROM public.space_events
        WHERE space_id = p_space_id

        UNION ALL

        SELECT MAX(created_at) AS activity_at
        FROM public.messages
        WHERE space_id = p_space_id
          AND deleted_at IS NULL

        UNION ALL

        SELECT MAX(created_at) AS activity_at
        FROM public.files
        WHERE space_id = p_space_id
          AND deleted_at IS NULL

        UNION ALL

        SELECT MAX(created_at) AS activity_at
        FROM public.meetings
        WHERE space_id = p_space_id
          AND deleted_at IS NULL

        UNION ALL

        SELECT MAX(joined_at) AS activity_at
        FROM public.space_members
        WHERE space_id = p_space_id
    ) activity;

    INSERT INTO public.space_stats (
        space_id,
        organization_id,
        message_count,
        file_count,
        meeting_count,
        member_count,
        last_activity_at,
        updated_at
    )
    VALUES (
        p_space_id,
        v_org_id,
        v_message_count,
        v_file_count,
        v_meeting_count,
        v_member_count,
        COALESCE(v_last_activity, now()),
        now()
    )
    ON CONFLICT (space_id) DO UPDATE SET
        organization_id = EXCLUDED.organization_id,
        message_count = EXCLUDED.message_count,
        file_count = EXCLUDED.file_count,
        meeting_count = EXCLUDED.meeting_count,
        member_count = EXCLUDED.member_count,
        last_activity_at = EXCLUDED.last_activity_at,
        updated_at = now();

    UPDATE public.space_events
    SET processed_at = now()
    WHERE space_id = p_space_id
      AND processed_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller uuid := auth.uid();
    v_active_spaces bigint;
    v_active_clients bigint;
    v_total_messages_7d bigint;
    v_meetings_month bigint;
    v_files_month bigint;
    v_7d_ago timestamptz := now() - interval '7 days';
    v_start_of_month timestamptz := date_trunc('month', now());
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'PT401';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = v_caller
          AND p.organization_id = p_organization_id
    )
    AND NOT EXISTS (
        SELECT 1
        FROM public.org_memberships om
        WHERE om.user_id = v_caller
          AND om.organization_id = p_organization_id
          AND COALESCE(om.status, 'active') = 'active'
    ) THEN
        RAISE EXCEPTION 'NOT_AUTHORIZED' USING ERRCODE = 'PT403';
    END IF;

    SELECT COUNT(*)
    INTO v_active_spaces
    FROM public.spaces s
    WHERE s.organization_id = p_organization_id
      AND s.deleted_at IS NULL
      AND COALESCE(lower(s.status), 'active') IN ('active', 'onboarding');

    SELECT COUNT(DISTINCT sm.user_id)
    INTO v_active_clients
    FROM public.space_members sm
    JOIN public.spaces s ON s.id = sm.space_id
    WHERE s.organization_id = p_organization_id
      AND s.deleted_at IS NULL
      AND sm.member_type = 'client';

    SELECT COUNT(*)
    INTO v_total_messages_7d
    FROM public.messages m
    WHERE m.organization_id = p_organization_id
      AND m.deleted_at IS NULL
      AND m.created_at > v_7d_ago;

    SELECT COUNT(*)
    INTO v_meetings_month
    FROM public.meetings m
    WHERE m.organization_id = p_organization_id
      AND m.deleted_at IS NULL
      AND m.starts_at >= v_start_of_month;

    SELECT COUNT(*)
    INTO v_files_month
    FROM public.files f
    WHERE f.organization_id = p_organization_id
      AND f.deleted_at IS NULL
      AND f.created_at >= v_start_of_month;

    RETURN jsonb_build_object(
        'activeSpaces', v_active_spaces,
        'activeClients', v_active_clients,
        'totalMessagesWeek', v_total_messages_7d,
        'meetingsMonth', v_meetings_month,
        'filesMonth', v_files_month
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_space_dashboard_data(
    p_space_id uuid,
    p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller uuid := auth.uid();
    v_space_row record;
    v_stats_row record;
    v_recent_files_count bigint;
    v_upcoming_meetings jsonb;
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'PT401';
    END IF;

    IF NOT public.has_space_role(
        v_caller,
        p_space_id,
        ARRAY['owner','admin','manager','member','viewer']::public.member_role[]
    ) THEN
        RAISE EXCEPTION 'NOT_AUTHORIZED' USING ERRCODE = 'PT403';
    END IF;

    SELECT *
    INTO v_space_row
    FROM public.spaces
    WHERE id = p_space_id
      AND organization_id = p_organization_id
      AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    PERFORM public.rollup_space_stats(p_space_id);

    SELECT message_count, file_count, meeting_count, member_count, last_activity_at
    INTO v_stats_row
    FROM public.space_stats
    WHERE space_id = p_space_id
      AND organization_id = p_organization_id;

    SELECT COUNT(*)
    INTO v_recent_files_count
    FROM public.files
    WHERE space_id = p_space_id
      AND organization_id = p_organization_id
      AND deleted_at IS NULL
      AND COALESCE(status, 'available') = 'available'
      AND created_at > now() - interval '7 days';

    SELECT jsonb_agg(row_to_json(m))
    INTO v_upcoming_meetings
    FROM (
        SELECT id, title, starts_at, status
        FROM public.meetings
        WHERE space_id = p_space_id
          AND organization_id = p_organization_id
          AND deleted_at IS NULL
          AND starts_at > now()
          AND COALESCE(status, 'scheduled') IN ('scheduled', 'active', 'live')
        ORDER BY starts_at ASC
        LIMIT 3
    ) m;

    RETURN jsonb_build_object(
        'space', to_jsonb(v_space_row),
        'stats', to_jsonb(v_stats_row),
        'unread_messages', 0,
        'unreadMessages', 0,
        'recent_files', v_recent_files_count,
        'recentFilesCount', v_recent_files_count,
        'upcoming_meetings', COALESCE(v_upcoming_meetings, '[]'::jsonb),
        'upcomingMeetings', COALESCE(v_upcoming_meetings, '[]'::jsonb)
    );
END;
$$;

DROP TRIGGER IF EXISTS trg_clean_stats_messages ON public.messages;
CREATE TRIGGER trg_clean_stats_messages
AFTER INSERT OR UPDATE OR DELETE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.trg_update_space_stats_clean();

DROP TRIGGER IF EXISTS trg_clean_stats_files ON public.files;
CREATE TRIGGER trg_clean_stats_files
AFTER INSERT OR UPDATE OR DELETE ON public.files
FOR EACH ROW EXECUTE FUNCTION public.trg_update_space_stats_clean();

DROP TRIGGER IF EXISTS trg_clean_stats_meetings ON public.meetings;
CREATE TRIGGER trg_clean_stats_meetings
AFTER INSERT OR UPDATE OR DELETE ON public.meetings
FOR EACH ROW EXECUTE FUNCTION public.trg_update_space_stats_clean();

DROP TRIGGER IF EXISTS trg_clean_stats_space_members ON public.space_members;
CREATE TRIGGER trg_clean_stats_space_members
AFTER INSERT OR UPDATE OR DELETE ON public.space_members
FOR EACH ROW EXECUTE FUNCTION public.trg_update_space_stats_clean();

DROP TRIGGER IF EXISTS trg_clean_stats_space_memberships ON public.space_memberships;
CREATE TRIGGER trg_clean_stats_space_memberships
AFTER INSERT OR UPDATE OR DELETE ON public.space_memberships
FOR EACH ROW EXECUTE FUNCTION public.trg_update_space_stats_clean();

DO $$
DECLARE
    v_space record;
BEGIN
    FOR v_space IN SELECT id FROM public.spaces WHERE deleted_at IS NULL LOOP
        PERFORM public.rollup_space_stats(v_space.id);
    END LOOP;
END;
$$;
