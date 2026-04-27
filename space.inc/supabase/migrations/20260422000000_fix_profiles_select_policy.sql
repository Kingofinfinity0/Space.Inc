-- =============================================================================
-- Fix recursive SELECT policies on public.profiles
-- =============================================================================
-- The existing profiles policies query public.profiles from inside a policy on
-- public.profiles, which can recurse and surface as a 500 during profile fetches.
-- This migration replaces those self-referential policies with a direct self
-- lookup and a non-recursive org-scoped lookup via get_my_org_id_secure().
-- =============================================================================

DROP POLICY IF EXISTS "Users can see their own organization" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by organization members" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone in the organization" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (id = auth.uid());

CREATE POLICY "Profiles are viewable by organization members"
ON public.profiles
FOR SELECT
USING (
  organization_id = public.get_my_org_id_secure()
);

