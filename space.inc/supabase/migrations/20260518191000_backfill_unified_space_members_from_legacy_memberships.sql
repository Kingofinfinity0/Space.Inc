-- The invitation authorization helpers read `space_members`.
-- Backfill it from the app's existing active `space_memberships` rows so
-- current owners/admins can create invitations and rotate share links.

INSERT INTO public.space_members (
  space_id,
  user_id,
  member_type,
  role,
  invited_by,
  joined_at
)
SELECT
  smp.space_id,
  smp.profile_id,
  CASE
    WHEN smp.context_role = 'staff' OR smp.role::text IN ('owner', 'admin', 'staff') THEN 'staff'::public.member_type
    ELSE 'client'::public.member_type
  END,
  CASE smp.role::text
    WHEN 'owner' THEN 'owner'::public.member_role
    WHEN 'admin' THEN 'admin'::public.member_role
    ELSE 'member'::public.member_role
  END,
  smp.invited_by,
  COALESCE(smp.joined_at, smp.created_at, now())
FROM public.space_memberships smp
WHERE smp.status = 'active'
  AND smp.space_id IS NOT NULL
  AND smp.profile_id IS NOT NULL
ON CONFLICT ON CONSTRAINT uq_space_members_space_user DO UPDATE
SET member_type = EXCLUDED.member_type,
    role = EXCLUDED.role,
    invited_by = COALESCE(public.space_members.invited_by, EXCLUDED.invited_by),
    joined_at = COALESCE(public.space_members.joined_at, EXCLUDED.joined_at);
