-- Context switching updates `profiles.role` as an active snapshot. That should
-- not be treated as permanently demoting the last organization owner.

CREATE OR REPLACE FUNCTION public.prevent_last_owner_removal()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF current_setting('app.context_switch', true) = 'on' THEN
        RETURN NEW;
    END IF;

    IF OLD.role = 'owner' AND NEW.role != 'owner' THEN
        IF (
            SELECT COUNT(*)
            FROM public.profiles
            WHERE organization_id = OLD.organization_id
              AND role = 'owner'
              AND id != OLD.id
        ) = 0 THEN
            RAISE EXCEPTION 'Cannot remove the last owner from organization';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_membership_context(p_context_type text, p_context_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_new_role   text;
  v_new_org_id uuid;
  v_updated    int := 0;
  v_new_session_version integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'NOT_AUTHENTICATED');
  END IF;

  IF p_context_type = 'org' THEN
    SELECT om.base_role, om.organization_id
    INTO   v_new_role, v_new_org_id
    FROM   public.org_memberships om
    WHERE  om.user_id        = v_uid
      AND  om.organization_id = p_context_id
      AND  om.status          = 'active'
      AND  om.base_role      != 'client';

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'MEMBERSHIP_NOT_FOUND');
    END IF;

  ELSIF p_context_type = 'client_space' THEN
    SELECT 'client', sm.org_id
    INTO   v_new_role, v_new_org_id
    FROM   public.space_memberships sm
    WHERE  sm.profile_id   = v_uid
      AND  sm.space_id     = p_context_id
      AND  sm.context_role = 'client'
      AND  sm.is_active    = true
      AND  sm.status       = 'active';

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'MEMBERSHIP_NOT_FOUND');
    END IF;

  ELSE
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_CONTEXT_TYPE');
  END IF;

  PERFORM set_config('app.context_switch', 'on', true);

  UPDATE public.profiles p
  SET
    role            = v_new_role,
    organization_id = v_new_org_id,
    session_version = p.session_version + 1,
    updated_at      = now()
  WHERE p.id = v_uid
  RETURNING p.session_version INTO v_new_session_version;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  PERFORM set_config('app.context_switch', 'off', true);

  IF v_updated <> 1 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'PROFILE_NOT_UPDATED',
      'updated_rows', v_updated
    );
  END IF;

  RETURN jsonb_build_object(
    'success',         true,
    'role',            v_new_role,
    'organization_id', v_new_org_id,
    'context_type',    p_context_type,
    'context_id',      p_context_id,
    'session_version', v_new_session_version
  );
END;
$$;

REVOKE ALL ON FUNCTION public.activate_membership_context(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_membership_context(text, uuid) TO authenticated;
