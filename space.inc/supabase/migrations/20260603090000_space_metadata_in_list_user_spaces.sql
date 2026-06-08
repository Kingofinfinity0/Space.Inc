drop function if exists public.list_user_spaces();

create or replace function public.list_user_spaces()
returns table(
  id uuid,
  name text,
  description text,
  modules jsonb,
  metadata jsonb,
  status text,
  created_at timestamptz,
  member_count bigint,
  file_count bigint,
  message_count bigint,
  organization_id uuid,
  visibility text,
  role text,
  permission_level text,
  last_activity_at timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_user_role text;
begin
  select p.organization_id, p.role into v_org_id, v_user_role
  from public.profiles p where p.id = v_user_id;

  return query
  select s.id, s.name, s.description, s.modules,
    coalesce(s.metadata, '{}'::jsonb) as metadata, s.status, s.created_at,
    coalesce(ss.member_count, 0)::bigint, coalesce(ss.file_count, 0)::bigint,
    coalesce(ss.message_count, 0)::bigint, s.organization_id,
    coalesce(s.modules->>'visibility', 'private') as visibility,
    coalesce(sm_user.role::text, v_user_role, 'member') as role,
    case when v_user_role in ('owner', 'admin') then 'full'
      when sm_user.role::text = 'manager' then 'manage' else 'view' end,
    coalesce((
      select m.created_at from public.messages m
      where m.space_id = s.id and m.deleted_at is null
      order by m.created_at desc limit 1
    ), s.created_at) as last_activity_at
  from public.spaces s
  left join public.space_stats ss on ss.space_id = s.id
  left join public.space_memberships sm_user
    on sm_user.space_id = s.id and sm_user.profile_id = v_user_id
    and sm_user.is_active = true
  where s.organization_id = v_org_id and s.deleted_at is null
    and (exists (
      select 1 from public.space_memberships sm
      where sm.space_id = s.id and sm.profile_id = v_user_id
        and sm.is_active = true
    ) or v_user_role = 'owner')
  order by last_activity_at desc nulls last;
end;
$function$;

revoke execute on function public.list_user_spaces() from public, anon;
grant execute on function public.list_user_spaces() to authenticated;
