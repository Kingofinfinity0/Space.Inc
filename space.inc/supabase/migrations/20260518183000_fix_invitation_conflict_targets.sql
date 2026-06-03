-- Avoid PL/pgSQL ambiguity with RETURNS TABLE column names.
-- Function output columns named `space_id` can shadow conflict-target columns,
-- so use explicit unique constraint names in invitation membership upserts.

DO $$
DECLARE
  v_sql text;
BEGIN
  v_sql := pg_get_functiondef('public.accept_invitation(text)'::regprocedure);
  v_sql := replace(v_sql, 'ON CONFLICT (space_id, user_id) DO NOTHING', 'ON CONFLICT ON CONSTRAINT uq_space_members_space_user DO NOTHING');
  v_sql := replace(v_sql, 'ON CONFLICT (space_id, profile_id) DO UPDATE', 'ON CONFLICT ON CONSTRAINT space_memberships_space_id_profile_id_key DO UPDATE');
  EXECUTE v_sql;

  v_sql := pg_get_functiondef('public.join_via_share_link(text)'::regprocedure);
  v_sql := replace(v_sql, 'ON CONFLICT (space_id, profile_id) DO UPDATE', 'ON CONFLICT ON CONSTRAINT space_memberships_space_id_profile_id_key DO UPDATE');
  EXECUTE v_sql;
END $$;
