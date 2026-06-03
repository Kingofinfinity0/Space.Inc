-- Avoid text-array concatenation ambiguity in the central RBAC helper.

CREATE OR REPLACE FUNCTION public.has_space_role(_user uuid, _space uuid, _roles public.member_role[])
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mapped_roles text[] := ARRAY[]::text[];
  v_role         public.member_role;
BEGIN
  FOREACH v_role IN ARRAY _roles LOOP
    CASE v_role
      WHEN 'owner' THEN v_mapped_roles := array_append(v_mapped_roles, 'owner');
      WHEN 'admin' THEN v_mapped_roles := array_append(v_mapped_roles, 'admin');
      WHEN 'manager' THEN v_mapped_roles := array_append(v_mapped_roles, 'admin');
      WHEN 'member' THEN v_mapped_roles := array_append(v_mapped_roles, 'client');
      WHEN 'viewer' THEN v_mapped_roles := array_append(v_mapped_roles, 'client');
      ELSE NULL;
    END CASE;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM public.space_members sm
    WHERE sm.user_id = _user
      AND sm.space_id = _space
      AND sm.role = ANY(_roles)
  ) THEN
    RETURN true;
  END IF;

  IF array_length(v_mapped_roles, 1) > 0 AND EXISTS (
    SELECT 1
    FROM public.space_memberships sm
    WHERE sm.profile_id = _user
      AND sm.space_id = _space
      AND sm.is_active = true
      AND sm.role::text = ANY(v_mapped_roles)
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.has_space_role(uuid, uuid, public.member_role[]) FROM PUBLIC, anon, authenticated;
