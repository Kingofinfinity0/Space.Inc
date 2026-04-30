-- Fix the audit_file_operation function to handle tables without direct org/space columns (like file_versions)
CREATE OR REPLACE FUNCTION public.audit_file_operation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id   uuid;
    v_space_id uuid;
    v_name     text;
BEGIN
    -- If the table is file_versions, we must fetch context from the parent files record
    IF (TG_TABLE_NAME = 'file_versions') THEN
        SELECT organization_id, space_id, name
        INTO v_org_id, v_space_id, v_name
        FROM public.files
        WHERE id = NEW.file_id;
    ELSE
        -- Default to the record's own columns for 'files' table
        v_org_id := NEW.organization_id;
        v_space_id := NEW.space_id;
        v_name := NEW.name;
    END IF;

    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.activity_logs (
            organization_id,
            space_id,
            user_id,
            action_type,
            payload_after,
            metadata
        ) VALUES (
            v_org_id,
            v_space_id,
            auth.uid(),
            'FILE_UPLOADED',
            row_to_json(NEW)::jsonb,
            jsonb_build_object('display_name', v_name, 'storage_path', NEW.storage_path)
        );
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Audit deletions or status changes
        IF (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) OR (NEW.status = 'deleted' AND OLD.status != 'deleted') THEN
            INSERT INTO public.activity_logs (
                organization_id,
                space_id,
                user_id,
                action_type,
                payload_before,
                payload_after,
                metadata
            ) VALUES (
                v_org_id,
                v_space_id,
                auth.uid(),
                'FILE_DELETED',
                row_to_json(OLD)::jsonb,
                row_to_json(NEW)::jsonb,
                jsonb_build_object('display_name', v_name, 'storage_path', NEW.storage_path)
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- Ensure triggers are correctly attached
DROP TRIGGER IF EXISTS tr_audit_files ON public.files;
CREATE TRIGGER tr_audit_files
    AFTER INSERT OR UPDATE ON public.files
    FOR EACH ROW EXECUTE FUNCTION public.audit_file_operation();

DROP TRIGGER IF EXISTS tr_audit_file_versions ON public.file_versions;
CREATE TRIGGER tr_audit_file_versions
    AFTER INSERT ON public.file_versions
    FOR EACH ROW EXECUTE FUNCTION public.audit_file_operation();

-- Canonical implementation of request_new_version (Synced from DB state)
CREATE OR REPLACE FUNCTION public.request_new_version(
    p_file_id uuid,
    p_file_name text,
    p_content_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id      uuid;
    v_parent_file record;
    v_new_file_id uuid;
    v_new_version integer;
    v_storage_path text;
    v_user_role   text;
BEGIN
    v_org_id := public.get_my_org_id_secure();

    SELECT * INTO v_parent_file
    FROM public.files
    WHERE id = p_file_id AND organization_id = v_org_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'FILE_NOT_FOUND';
    END IF;

    SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();

    IF v_user_role = 'client' THEN
        IF NOT public.check_capability(auth.uid(), 'client_can_upload', v_parent_file.space_id) THEN
            RAISE EXCEPTION 'PERMISSION_DENIED';
        END IF;
    END IF;

    SELECT COALESCE(MAX(version_number), 1) + 1 INTO v_new_version
    FROM public.files
    WHERE (id = p_file_id OR parent_id = p_file_id) AND organization_id = v_org_id;

    v_new_file_id := gen_random_uuid();
    v_storage_path := v_org_id::text
        || '/' || COALESCE(v_parent_file.space_id::text, 'global')
        || '/' || p_file_id::text
        || '/v' || v_new_version::text
        || '/' || p_file_name;

    INSERT INTO public.files (
        id, organization_id, space_id, name, display_name,
        mime_type, storage_path, status, uploaded_by,
        parent_id, version_number, owner_role
    ) VALUES (
        v_new_file_id, v_org_id, v_parent_file.space_id, p_file_name, p_file_name,
        p_content_type, v_storage_path, 'pending', auth.uid(),
        COALESCE(v_parent_file.parent_id, p_file_id),
        v_new_version, v_user_role
    );

    RETURN jsonb_build_object(
        'file_id', v_new_file_id,
        'storage_path', v_storage_path,
        'version_number', v_new_version
    );
END;
$$;

-- Canonical implementation of soft_delete_file (Synced and fixed)
CREATE OR REPLACE FUNCTION public.soft_delete_file(p_file_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_role   text;
  v_space  uuid;
  v_name   text;
BEGIN
  v_org_id := public.get_my_org_id_secure();
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();

  UPDATE public.files
  SET status = 'deleted', deleted_at = now(), updated_at = now()
  WHERE id = p_file_id
    AND organization_id = v_org_id
    AND (uploaded_by = auth.uid() OR v_role IN ('owner','admin','staff'))
    AND deleted_at IS NULL
  RETURNING space_id, name INTO v_space, v_name;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FILE_NOT_FOUND';
  END IF;

  RETURN jsonb_build_object('success', true, 'file_id', p_file_id);
END;
$$;
