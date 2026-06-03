drop function if exists public.create_task(uuid, text, text, date, text, uuid, text);
drop function if exists public.create_task(uuid, text, text, date, text, uuid, text, uuid, text, integer, numeric);

create or replace function public.create_task(
  p_space_id uuid, p_title text, p_description text default null, p_due_date date default null,
  p_priority text default 'medium', p_assignee_id uuid default null, p_status text default 'todo',
  p_reviewer_id uuid default null, p_assigned_group text default null, p_estimate_points integer default null,
  p_estimate_hours numeric default null
)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare v_task public.tasks; v_org uuid; v_status text := coalesce(nullif(trim(p_status), ''), 'todo');
begin
  if nullif(trim(coalesce(p_title, '')), '') is null then raise exception 'VAL_MISSING_FIELD' using errcode = 'PT400'; end if;
  if not public.space_task_action_allowed(auth.uid(), p_space_id, 'create_task') then raise exception 'PERMISSION_DENIED' using errcode = 'PT403'; end if;
  select organization_id into v_org from public.spaces where id = p_space_id;
  if v_org is null then raise exception 'SPACE_NOT_FOUND' using errcode = 'PT404'; end if;
  if not exists (select 1 from public.task_statuses where space_id = p_space_id and status_key = v_status) then
    raise exception 'TASK_STATUS_INVALID' using errcode = 'PT400';
  end if;
  perform public.assert_task_assignee_valid(p_space_id, p_assignee_id);
  perform public.assert_task_assignee_valid(p_space_id, p_reviewer_id);

  insert into public.tasks (
    organization_id, space_id, title, description, due_date, priority, assignee_id, status,
    reviewer_id, assigned_group, estimate_points, estimate_hours, created_by, completed_at
  )
  values (
    v_org, p_space_id, trim(p_title), nullif(trim(coalesce(p_description, '')), ''), p_due_date,
    coalesce(nullif(trim(p_priority), ''), 'medium'), p_assignee_id, v_status, p_reviewer_id,
    nullif(trim(coalesce(p_assigned_group, '')), ''), p_estimate_points, p_estimate_hours,
    auth.uid(), case when v_status = 'done' then now() else null end
  )
  returning * into v_task;

  insert into public.task_watchers (task_id, user_id) values (v_task.id, auth.uid()) on conflict do nothing;
  return v_task;
end;
$$;

create or replace function public.update_task(p_task_id uuid, p_updates jsonb)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare v_existing public.tasks; v_task public.tasks; v_status text; v_assignee uuid; v_reviewer uuid;
begin
  select * into v_existing from public.tasks where id = p_task_id and deleted_at is null;
  if v_existing.id is null then raise exception 'TASK_NOT_FOUND' using errcode = 'PT404'; end if;
  if not public.task_action_allowed(auth.uid(), p_task_id, 'edit_task') then raise exception 'PERMISSION_DENIED' using errcode = 'PT403'; end if;
  v_status := coalesce(nullif(p_updates->>'status', ''), v_existing.status);
  v_assignee := case when p_updates ? 'assignee_id' then nullif(p_updates->>'assignee_id', '')::uuid else v_existing.assignee_id end;
  v_reviewer := case when p_updates ? 'reviewer_id' then nullif(p_updates->>'reviewer_id', '')::uuid else v_existing.reviewer_id end;
  if not exists (select 1 from public.task_statuses where space_id = v_existing.space_id and status_key = v_status) then
    raise exception 'TASK_STATUS_INVALID' using errcode = 'PT400';
  end if;
  perform public.assert_task_assignee_valid(v_existing.space_id, v_assignee);
  perform public.assert_task_assignee_valid(v_existing.space_id, v_reviewer);

  update public.tasks set
    title = case when p_updates ? 'title' then coalesce(nullif(trim(p_updates->>'title'), ''), title) else title end,
    description = case when p_updates ? 'description' then nullif(trim(coalesce(p_updates->>'description', '')), '') else description end,
    due_date = case when p_updates ? 'due_date' then nullif(p_updates->>'due_date', '')::date else due_date end,
    start_date = case when p_updates ? 'start_date' then nullif(p_updates->>'start_date', '')::date else start_date end,
    priority = case when p_updates ? 'priority' then coalesce(nullif(trim(p_updates->>'priority'), ''), priority) else priority end,
    status = v_status, assignee_id = v_assignee, reviewer_id = v_reviewer,
    assigned_group = case when p_updates ? 'assigned_group' then nullif(trim(coalesce(p_updates->>'assigned_group', '')), '') else assigned_group end,
    estimate_points = case when p_updates ? 'estimate_points' then nullif(p_updates->>'estimate_points', '')::integer else estimate_points end,
    estimate_hours = case when p_updates ? 'estimate_hours' then nullif(p_updates->>'estimate_hours', '')::numeric else estimate_hours end,
    completed_at = case when v_status = 'done' and completed_at is null then now() when v_status <> 'done' then null else completed_at end,
    updated_at = now()
  where id = p_task_id
  returning * into v_task;

  return v_task;
end;
$$;

create or replace function public.get_task_detail(p_task_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_task jsonb;
begin
  if not public.task_action_allowed(auth.uid(), p_task_id, 'view_task') then raise exception 'TASK_NOT_FOUND' using errcode = 'PT404'; end if;
  select to_jsonb(t) || jsonb_build_object('assignee_name', assignee.full_name, 'assignee_avatar', assignee.avatar_url, 'reviewer_name', reviewer.full_name, 'reviewer_avatar', reviewer.avatar_url, 'creator_name', creator.full_name)
  into v_task
  from public.tasks t
  left join public.profiles assignee on assignee.id = t.assignee_id
  left join public.profiles reviewer on reviewer.id = t.reviewer_id
  left join public.profiles creator on creator.id = t.created_by
  where t.id = p_task_id and t.deleted_at is null;
  return jsonb_build_object(
    'task', v_task, 'labels', '[]'::jsonb,
    'comments', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.task_comments c where c.task_id = p_task_id and c.deleted_at is null), '[]'::jsonb),
    'activity', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from public.task_activity a where a.task_id = p_task_id), '[]'::jsonb),
    'relations', '[]'::jsonb,
    'subtasks', coalesce((select jsonb_agg(to_jsonb(st) order by st.created_at) from public.tasks st where st.parent_task_id = p_task_id and st.deleted_at is null), '[]'::jsonb),
    'attachments', '[]'::jsonb,
    'watchers', coalesce((select jsonb_agg(jsonb_build_object('user_id', w.user_id, 'full_name', p.full_name, 'avatar_url', p.avatar_url)) from public.task_watchers w left join public.profiles p on p.id = w.user_id where w.task_id = p_task_id), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.create_task(uuid, text, text, date, text, uuid, text, uuid, text, integer, numeric) from public, anon;
revoke execute on function public.update_task(uuid, jsonb) from public, anon;
revoke execute on function public.get_task_detail(uuid) from public, anon;
grant execute on function public.create_task(uuid, text, text, date, text, uuid, text, uuid, text, integer, numeric) to authenticated;
grant execute on function public.update_task(uuid, jsonb) to authenticated;
grant execute on function public.get_task_detail(uuid) to authenticated;
notify pgrst, 'reload schema';
