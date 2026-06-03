-- `space_memberships.role` uses the legacy `space_member_role` enum.
-- Invitation flows map the richer invitation roles into that context enum.

DO $$
DECLARE
  v_sql text;
BEGIN
  v_sql := pg_get_functiondef('public.accept_invitation(text)'::regprocedure);
  v_sql := replace(v_sql, 'v_mapped_role public.user_role;', 'v_mapped_role public.space_member_role;');
  v_sql := replace(v_sql, '::public.user_role', '::public.space_member_role');
  v_sql := replace(v_sql, 'ELSE v_mapped_role := ''client''::public.space_member_role;', 'ELSE v_mapped_role := CASE v_invite.member_type WHEN ''staff'' THEN ''staff''::public.space_member_role ELSE ''client''::public.space_member_role END;');
  EXECUTE v_sql;

  v_sql := pg_get_functiondef('public.join_via_share_link(text)'::regprocedure);
  v_sql := replace(v_sql, 'v_mapped_role   public.user_role;', 'v_mapped_role   public.space_member_role;');
  v_sql := replace(v_sql, '::public.user_role', '::public.space_member_role');
  v_sql := replace(v_sql, 'ELSE v_mapped_role := ''client''::public.space_member_role;', 'ELSE v_mapped_role := CASE v_link.default_member_type WHEN ''staff'' THEN ''staff''::public.space_member_role ELSE ''client''::public.space_member_role END;');
  EXECUTE v_sql;
END $$;
