-- Qualify column references that conflict with RETURNS TABLE output names.

DO $$
DECLARE
  v_sql text;
BEGIN
  v_sql := pg_get_functiondef('public.accept_invitation(text)'::regprocedure);
  v_sql := replace(v_sql, 'FROM public.space_members
    WHERE space_id = v_invite.space_id AND user_id = v_caller;', 'FROM public.space_members sm_existing
    WHERE sm_existing.space_id = v_invite.space_id AND sm_existing.user_id = v_caller;');
  EXECUTE v_sql;

  v_sql := pg_get_functiondef('public.join_via_share_link(text)'::regprocedure);
  v_sql := replace(v_sql, 'FROM public.space_members
  WHERE space_id = v_link.space_id AND user_id = v_caller;', 'FROM public.space_members sm_existing
  WHERE sm_existing.space_id = v_link.space_id AND sm_existing.user_id = v_caller;');
  v_sql := replace(v_sql, 'WHERE space_id = v_link.space_id AND profile_id = v_caller;', 'WHERE public.space_memberships.space_id = v_link.space_id AND public.space_memberships.profile_id = v_caller;');
  EXECUTE v_sql;
END $$;
