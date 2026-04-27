-- =============================================================================
-- Fix recursive org lookup used by public.profiles policies
-- =============================================================================
-- The previous implementation of get_my_org_id_secure() read from public.profiles,
-- which can recurse when public.profiles RLS policies call that helper.
-- This replacement derives the org directly from org_memberships, avoiding the
-- profiles table entirely and preventing policy recursion during profile fetches.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_my_org_id_secure()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT om.organization_id
  INTO v_org_id
  FROM public.org_memberships om
  WHERE om.user_id = auth.uid()
    AND om.status = 'active'
  LIMIT 1;

  RETURN v_org_id;
END;
$$;
