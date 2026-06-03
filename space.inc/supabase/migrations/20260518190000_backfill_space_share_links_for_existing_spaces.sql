-- Existing spaces predate the share-link trigger. Create one hashed share-link
-- row per space so admins can rotate/reveal a fresh raw token from settings.

INSERT INTO public.space_share_links (
  space_id,
  token_hash,
  default_member_type,
  default_role,
  created_by
)
SELECT
  s.id,
  public.hash_token(public.generate_url_token()),
  'client'::public.member_type,
  'member'::public.member_role,
  COALESCE(
    s.created_by,
    (
      SELECT p.id
      FROM public.profiles p
      WHERE p.organization_id = s.organization_id
      ORDER BY p.created_at ASC
      LIMIT 1
    ),
    (
      SELECT u.id
      FROM auth.users u
      ORDER BY u.created_at ASC
      LIMIT 1
    )
  )
FROM public.spaces s
WHERE NOT EXISTS (
  SELECT 1
  FROM public.space_share_links l
  WHERE l.space_id = s.id
)
AND COALESCE(
  s.created_by,
  (
    SELECT p.id
    FROM public.profiles p
    WHERE p.organization_id = s.organization_id
    ORDER BY p.created_at ASC
    LIMIT 1
  ),
  (
    SELECT u.id
    FROM auth.users u
    ORDER BY u.created_at ASC
    LIMIT 1
  )
) IS NOT NULL;
