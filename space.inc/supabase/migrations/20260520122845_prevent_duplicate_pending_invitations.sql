-- Prefer explicit regeneration over implicit duplicate creation. The frontend
-- now blocks duplicate emails before submit; this keeps the RPC aligned if a
-- caller bypasses the UI.

DO $$
DECLARE
  v_sql text;
BEGIN
  SELECT pg_get_functiondef('public.create_invitation(uuid, text, public.member_type, public.member_role)'::regprocedure)
  INTO v_sql;

  v_sql := replace(
    v_sql,
    '  IF v_old_id IS NOT NULL THEN
    UPDATE public.invitations
    SET status = ''revoked'', revoked_at = now()
    WHERE id = v_old_id;

    INSERT INTO public.invitation_events (invitation_id, event_type, actor_id, metadata)
    VALUES (v_old_id, ''revoked'', v_caller, jsonb_build_object(''reason'', ''superseded_by_new_invite''));
  END IF;',
    '  IF v_old_id IS NOT NULL THEN
    RAISE EXCEPTION ''INVITE_ALREADY_PENDING'' USING ERRCODE = ''PT409'';
  END IF;'
  );

  EXECUTE v_sql;
END $$;

REVOKE ALL ON FUNCTION public.create_invitation(uuid, text, public.member_type, public.member_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_invitation(uuid, text, public.member_type, public.member_role) TO authenticated;
