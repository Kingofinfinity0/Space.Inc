-- =============================================================================
-- Migration: 20260413000100_fix_file_trash_access.sql
-- Purpose:
-- 1. Split file select access between active and deleted records.
-- 2. Add get_trash_files RPC for trash views.
-- =============================================================================

-- Clean up old/select policy variants if they already exist in any environment.
DROP POLICY IF EXISTS files_select ON public.files;
DROP POLICY IF EXISTS files_select_active ON public.files;
DROP POLICY IF EXISTS files_select_deleted ON public.files;

-- Active files remain visible to organization members.
CREATE POLICY files_select_active
ON public.files
FOR SELECT
TO authenticated
USING (
  organization_id = public.get_my_org_id_secure()
  AND deleted_at IS NULL
);

-- Soft-deleted files are visible only to the uploader or admins/owners.
CREATE POLICY files_select_deleted
ON public.files
FOR SELECT
TO authenticated
USING (
  organization_id = public.get_my_org_id_secure()
  AND status = 'deleted'
  AND (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.organization_id = public.get_my_org_id_secure()
        AND p.role IN ('owner', 'admin')
    )
  )
);

CREATE OR REPLACE FUNCTION public.get_trash_files(
  p_space_id uuid DEFAULT NULL
)
RETURNS SETOF public.files
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.*
  FROM public.files f
  WHERE f.organization_id = public.get_my_org_id_secure()
    AND f.status = 'deleted'
    AND (p_space_id IS NULL OR f.space_id = p_space_id)
  ORDER BY f.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_trash_files(uuid) TO authenticated;
