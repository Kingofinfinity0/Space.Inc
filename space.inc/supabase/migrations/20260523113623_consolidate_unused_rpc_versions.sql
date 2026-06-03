-- Mark duplicate/versioned RPCs after caller comparison without breaking unknown external callers.
-- These comments are intentionally non-breaking. Removal requires traffic/log confirmation.

COMMENT ON FUNCTION public.archive_space_v2(uuid)
IS 'Deprecated candidate: no local React or Edge caller found on 2026-05-23. Canonical path is public.archive_space(uuid, text) via createspace-api.';

COMMENT ON FUNCTION public.create_meeting_v2(uuid, text, timestamp with time zone, integer, text, boolean, text, text, text)
IS 'Deprecated candidate: no local React or Edge caller found on 2026-05-23. Canonical path is public.create_meeting(...) via meetings-api.';

COMMENT ON FUNCTION public.create_space_v2(text, text, text, text, text[], jsonb)
IS 'Deprecated candidate: no local React or Edge caller found on 2026-05-23. Canonical path is public.create_space(text, text, jsonb, jsonb) via createspace-api.';

COMMENT ON FUNCTION public.create_task_v2(uuid, text, text, text, text, timestamp with time zone, uuid)
IS 'Deprecated candidate: no local React or Edge caller found on 2026-05-23. Canonical path is public.create_task(...) via tasks-api.';

COMMENT ON FUNCTION public.delete_task_v2(uuid)
IS 'Deprecated candidate: no local React or Edge caller found on 2026-05-23. Canonical path is public.delete_task(uuid) via tasks-api.';

COMMENT ON FUNCTION public.get_my_profile_v2()
IS 'Deprecated candidate: no local React or Edge caller found on 2026-05-23. Current app profile reads use profiles/get_capability_lens/context RPCs.';

COMMENT ON FUNCTION public.list_activity_logs_v2(uuid, integer)
IS 'Deprecated candidate: no local React or Edge caller found on 2026-05-23. Canonical path is public.list_activity_logs(uuid, integer) via activity-logs-api.';

COMMENT ON FUNCTION public.list_files_v2(uuid)
IS 'Deprecated candidate: no local React or Edge caller found on 2026-05-23. Canonical path is files-api GET plus file RPC mutation paths.';

COMMENT ON FUNCTION public.list_spaces_v2()
IS 'Deprecated candidate: no local React or Edge caller found on 2026-05-23. Canonical path is public.list_user_spaces() via createspace-api.';

COMMENT ON FUNCTION public.list_tasks_v2(uuid)
IS 'Deprecated candidate: no local React or Edge caller found on 2026-05-23. Canonical path is public.list_tasks(...) via tasks-api/apiService.';

COMMENT ON FUNCTION public.update_task_v2(uuid, jsonb)
IS 'Deprecated candidate: no local React or Edge caller found on 2026-05-23. Canonical path is public.update_task(uuid, jsonb) via tasks-api.';

COMMENT ON FUNCTION public.list_meetings_v2(uuid)
IS 'Active: local apiService.listMeetings calls this RPC directly. Keep until meeting list is moved behind meetings-api or renamed canonically.';

COMMENT ON FUNCTION public.trg_update_space_stats_clean()
IS 'Active trigger function: bound to files, meetings, messages, space_members, and space_memberships stats triggers. Keep.';

COMMENT ON FUNCTION public.request_upload_voucher(uuid, uuid, text, text, text, text)
IS 'Deprecated overload candidate: live files-api v22 calls request_upload_voucher(uuid, text, text, text, text) without p_organization_id. Remove only after external RPC traffic check.';

COMMENT ON FUNCTION public.confirm_file_upload(uuid, uuid)
IS 'Deprecated overload candidate: live files-api v22 calls confirm_file_upload(uuid) without p_organization_id. Remove only after external RPC traffic check.';

COMMENT ON FUNCTION public.soft_delete_file(uuid, uuid)
IS 'Deprecated overload candidate: live files-api v22 calls soft_delete_file(uuid) without p_organization_id. Remove only after external RPC traffic check.';

COMMENT ON FUNCTION public.restore_file(uuid, uuid)
IS 'Deprecated overload candidate: live files-api v22 calls restore_file(uuid) without p_organization_id. Remove only after external RPC traffic check.';

COMMENT ON FUNCTION public.hard_delete_file(uuid, uuid)
IS 'Deprecated overload candidate: live files-api v22 calls hard_delete_file(uuid) without p_organization_id. Remove only after external RPC traffic check.';
