drop function if exists public.list_tasks(uuid, text, text, uuid, text);
drop function if exists public.list_tasks(uuid, text, text, jsonb);
drop function if exists public.list_tasks(uuid);

create or replace function public.list_task_statuses(p_space_id uuid default null)
returns setof public.task_statuses
language sql
stable
security definer
set search_path = public
as $$
  select ts.*
  from public.task_statuses ts
  where (p_space_id is null or ts.space_id = p_space_id)
    and public.space_task_action_allowed(auth.uid(), ts.space_id, 'view_task')
  order by ts.position, ts.name;
$$;

create or replace function public.list_task_assignees(p_space_id uuid, p_search text default null)
returns table (
  user_id uuid,
  membership_id uuid,
  full_name text,
  email text,
  avatar_url text,
  role text,
  context_role text,
  member_type text,
  status text,
  is_active boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.space_task_action_allowed(auth.uid(), p_space_id, 'view_task') then
    raise exception 'PERMISSION_DENIED' using errcode = 'PT403';
  end if;

  return query
  select distinct on (coalesce(sm.user_id, sm.profile_id))
    coalesce(sm.user_id, sm.profile_id), sm.id,
    coalesce(nullif(trim(p.full_name), ''), p.email, 'Unknown member'),
    p.email::text, p.avatar_url, sm.role::text, sm.context_role,
    case when sm.context_role = 'staff' or sm.role::text in ('owner', 'admin', 'staff') or p.role::text in ('owner', 'admin', 'staff') then 'staff' else 'client' end,
    coalesce(sm.status, 'active'), coalesce(sm.is_active, true)
  from public.space_memberships sm
  join public.profiles p on p.id = coalesce(sm.user_id, sm.profile_id)
  where sm.space_id = p_space_id
    and coalesce(sm.is_active, true)
    and coalesce(sm.status, 'active') = 'active'
    and coalesce(sm.user_id, sm.profile_id) is not null
    and (nullif(trim(coalesce(p_search, '')), '') is null or p.full_name ilike '%' || trim(p_search) || '%' or p.email ilike '%' || trim(p_search) || '%')
  order by coalesce(sm.user_id, sm.profile_id), p.full_name nulls last, p.email;
end;
$$;

create or replace function public.list_tasks(p_space_id uuid default null, p_priority text default null, p_search text default null, p_filters jsonb default '{}'::jsonb)
returns table (
  id uuid, organization_id uuid, space_id uuid, assignee_id uuid, assignee_name text, assignee_avatar text,
  reviewer_id uuid, reviewer_name text, reviewer_avatar text, title text, due_date date, start_date date,
  status text, created_at timestamptz, description text, priority text, completed_at timestamptz, created_by uuid,
  updated_at timestamptz, task_number integer, task_key text, parent_task_id uuid, estimate_points integer,
  estimate_hours numeric, assigned_group text, archived_at timestamptz, archived_by uuid, labels jsonb,
  subtask_count bigint, comment_count bigint, watcher_count bigint, relation_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select t.id, t.organization_id, t.space_id, t.assignee_id, assignee.full_name, assignee.avatar_url,
    t.reviewer_id, reviewer.full_name, reviewer.avatar_url, t.title, t.due_date, t.start_date, t.status,
    t.created_at, t.description, t.priority, t.completed_at, t.created_by, t.updated_at, t.task_number,
    case when t.task_number is null then null else 'SPA-' || t.task_number::text end, t.parent_task_id,
    t.estimate_points, t.estimate_hours, t.assigned_group, t.archived_at, t.archived_by, '[]'::jsonb,
    (select count(*) from public.tasks st where st.parent_task_id = t.id and st.deleted_at is null),
    (select count(*) from public.task_comments c where c.task_id = t.id and c.deleted_at is null),
    (select count(*) from public.task_watchers w where w.task_id = t.id),
    0::bigint
  from public.tasks t
  left join public.profiles assignee on assignee.id = t.assignee_id
  left join public.profiles reviewer on reviewer.id = t.reviewer_id
  where t.deleted_at is null
    and (coalesce((p_filters->>'include_archived')::boolean, false) or t.archived_at is null)
    and (p_space_id is null or t.space_id = p_space_id)
    and public.space_task_action_allowed(auth.uid(), t.space_id, 'view_task')
    and (p_priority is null or t.priority = p_priority)
    and (p_filters->>'status' is null or t.status = p_filters->>'status')
    and (p_filters->>'assignee_id' is null or t.assignee_id = (p_filters->>'assignee_id')::uuid)
    and (p_filters->>'reviewer_id' is null or t.reviewer_id = (p_filters->>'reviewer_id')::uuid)
    and (p_filters->>'created_by' is null or t.created_by = (p_filters->>'created_by')::uuid)
    and (p_filters->>'space_id' is null or t.space_id = (p_filters->>'space_id')::uuid)
    and (p_search is null or t.title ilike '%' || p_search || '%' or coalesce(t.description, '') ilike '%' || p_search || '%' or coalesce(t.assigned_group, '') ilike '%' || p_search || '%')
  order by case t.status when 'in_progress' then 10 when 'todo' then 20 when 'pending' then 20 when 'review' then 30 when 'done' then 40 when 'canceled' then 50 else 60 end,
    t.sort_order nulls last, t.due_date nulls last, t.created_at desc;
end;
$$;

revoke execute on function public.list_tasks(uuid, text, text, jsonb) from public, anon;
revoke execute on function public.list_task_assignees(uuid, text) from public, anon;
revoke execute on function public.list_task_statuses(uuid) from public, anon;
grant execute on function public.list_tasks(uuid, text, text, jsonb) to authenticated;
grant execute on function public.list_task_assignees(uuid, text) to authenticated;
grant execute on function public.list_task_statuses(uuid) to authenticated;
notify pgrst, 'reload schema';
