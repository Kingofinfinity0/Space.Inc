-- Normalize role variable declarations after pg_get_functiondef preserved
-- spacing that the previous string-rewrite migration did not match.

DO $$
DECLARE
  v_sql text;
BEGIN
  v_sql := pg_get_functiondef('public.accept_invitation(text)'::regprocedure);
  v_sql := replace(v_sql, 'v_mapped_role   public.user_role;', 'v_mapped_role   public.space_member_role;');
  v_sql := replace(v_sql, 'v_mapped_role public.user_role;', 'v_mapped_role public.space_member_role;');
  EXECUTE v_sql;

  v_sql := pg_get_functiondef('public.join_via_share_link(text)'::regprocedure);
  v_sql := replace(v_sql, 'v_mapped_role   public.user_role;', 'v_mapped_role   public.space_member_role;');
  v_sql := replace(v_sql, 'v_mapped_role public.user_role;', 'v_mapped_role public.space_member_role;');
  EXECUTE v_sql;
END $$;
