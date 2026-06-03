create or replace function public.space_task_membership(p_user_id uuid, p_space_id uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  profile_id uuid,
  space_id uuid,
  organization_id uuid,
  role text,
  context_role text,
  member_type text,
  permission_level text,
  capabilities jsonb,
  status text,
  is_active boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    sm.id,
    coalesce(sm.user_id, sm.profile_id),
    sm.profile_id,
    sm.space_id,
    coalesce(sm.organization_id, sm.org_id, s.organization_id),
    sm.role::text,
    sm.context_role,
    case when sm.context_role = 'staff' or sm.role::text in ('owner', 'admin', 'staff') then 'staff' else 'client' end,
    sm.permission_level::text,
    coalesce(sm.capabilities, '{}'::jsonb),
    coalesce(sm.status, 'active'),
    coalesce(sm.is_active, true)
  from public.space_memberships sm
  join public.spaces s on s.id = sm.space_id
  where sm.space_id = p_space_id
    and coalesce(sm.user_id, sm.profile_id) = p_user_id
    and coalesce(sm.is_active, true)
    and coalesce(sm.status, 'active') = 'active'
  limit 1;
$$;

create or replace function public.space_task_action_allowed(p_user_id uuid, p_space_id uuid, p_action text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.space_task_membership(p_user_id, p_space_id) m
    where m.role in ('owner', 'admin')
       or m.member_type = 'staff'
       or coalesce((m.capabilities ->> p_action)::boolean, false)
       or p_action = 'view_task'
  );
$$;

create or replace function public.task_action_allowed(p_user_id uuid, p_task_id uuid, p_action text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tasks t
    where t.id = p_task_id
      and t.deleted_at is null
      and public.space_task_action_allowed(p_user_id, t.space_id, p_action)
  );
$$;

create or replace function public.assert_task_assignee_valid(p_space_id uuid, p_assignee_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_assignee_id is null then
    return;
  end if;

  if not exists (
    select 1
    from public.space_task_membership(p_assignee_id, p_space_id)
  ) then
    raise exception 'ASSIGNEE_NOT_IN_SPACE' using errcode = 'PT400';
  end if;
end;
$$;

revoke execute on function public.space_task_membership(uuid, uuid) from public, anon;
revoke execute on function public.space_task_action_allowed(uuid, uuid, text) from public, anon;
revoke execute on function public.task_action_allowed(uuid, uuid, text) from public, anon;
revoke execute on function public.assert_task_assignee_valid(uuid, uuid) from public, anon;
grant execute on function public.space_task_membership(uuid, uuid) to authenticated;
grant execute on function public.space_task_action_allowed(uuid, uuid, text) to authenticated;
grant execute on function public.task_action_allowed(uuid, uuid, text) to authenticated;
grant execute on function public.assert_task_assignee_valid(uuid, uuid) to authenticated;
