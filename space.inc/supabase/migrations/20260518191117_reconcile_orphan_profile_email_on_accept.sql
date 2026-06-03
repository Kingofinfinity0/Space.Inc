-- Some test/auth flows can leave an orphan public.profiles row with the same
-- email but no matching auth.users row. Free that email before creating the
-- current authenticated user's profile so invitation acceptance can proceed.

CREATE OR REPLACE FUNCTION public.reconcile_orphan_profile_email(_user uuid, _email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles p
  SET email = '__orphaned__' || p.id::text || '__' || p.email,
      updated_at = now()
  WHERE lower(p.email) = lower(trim(_email))
    AND p.id <> _user
    AND NOT EXISTS (
      SELECT 1
      FROM auth.users au
      WHERE au.id = p.id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_orphan_profile_email(uuid, text) FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_sql text;
BEGIN
  SELECT pg_get_functiondef('public.accept_invitation(text)'::regprocedure) INTO v_sql;

  v_sql := replace(
    v_sql,
    '  INSERT INTO public.profiles (id, email, role, organization_id, is_active, created_at, updated_at)',
    '  PERFORM public.reconcile_orphan_profile_email(v_caller, v_caller_email::text);

  INSERT INTO public.profiles (id, email, role, organization_id, is_active, created_at, updated_at)'
  );

  EXECUTE v_sql;
END $$;

DO $$
DECLARE
  v_sql text;
BEGIN
  SELECT pg_get_functiondef('public.join_via_share_link(text)'::regprocedure) INTO v_sql;

  v_sql := replace(
    v_sql,
    '  INSERT INTO public.profiles (id, email, role, organization_id, is_active, created_at, updated_at)',
    '  PERFORM public.reconcile_orphan_profile_email(v_caller, v_caller_email);

  INSERT INTO public.profiles (id, email, role, organization_id, is_active, created_at, updated_at)'
  );

  EXECUTE v_sql;
END $$;

REVOKE ALL ON FUNCTION public.accept_invitation(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;

REVOKE ALL ON FUNCTION public.join_via_share_link(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_via_share_link(text) TO authenticated;
