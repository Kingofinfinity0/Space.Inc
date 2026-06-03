-- Invitation acceptance creates a space-scoped membership. The space route then
-- reads public.spaces directly, so RLS must let direct space members see their
-- own space even when they do not have an org_memberships row.

DROP POLICY IF EXISTS spaces_select_space_members ON public.spaces;

CREATE POLICY spaces_select_space_members
ON public.spaces
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND public.has_space_role(
    auth.uid(),
    id,
    ARRAY[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'manager'::public.member_role,
      'member'::public.member_role,
      'viewer'::public.member_role
    ]
  )
);
