create or replace function public.archive_task(p_task_id uuid)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare v_task public.tasks;
begin
  if not public.task_action_allowed(auth.uid(), p_task_id, 'edit_task') then raise exception 'PERMISSION_DENIED' using errcode = 'PT403'; end if;
  update public.tasks set archived_at = now(), archived_by = auth.uid(), updated_at = now()
  where id = p_task_id and deleted_at is null
  returning * into v_task;
  if v_task.id is null then raise exception 'TASK_NOT_FOUND' using errcode = 'PT404'; end if;
  return v_task;
end;
$$;

create or replace function public.delete_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.task_action_allowed(auth.uid(), p_task_id, 'delete_task') then raise exception 'PERMISSION_DENIED' using errcode = 'PT403'; end if;
  update public.tasks set deleted_at = now(), deleted_by = auth.uid(), updated_at = now()
  where id = p_task_id and deleted_at is null;
end;
$$;

create or replace function public.add_task_comment(p_task_id uuid, p_content text, p_parent_comment_id uuid default null)
returns public.task_comments
language plpgsql
security definer
set search_path = public
as $$
declare v_comment public.task_comments;
begin
  if nullif(trim(coalesce(p_content, '')), '') is null then raise exception 'VAL_MISSING_FIELD' using errcode = 'PT400'; end if;
  if not public.task_action_allowed(auth.uid(), p_task_id, 'comment_task') then raise exception 'PERMISSION_DENIED' using errcode = 'PT403'; end if;
  if p_parent_comment_id is not null and not exists (select 1 from public.task_comments where id = p_parent_comment_id and task_id = p_task_id and deleted_at is null) then
    raise exception 'COMMENT_PARENT_INVALID' using errcode = 'PT400';
  end if;
  insert into public.task_comments (task_id, author_id, content, parent_comment_id)
  values (p_task_id, auth.uid(), trim(p_content), p_parent_comment_id)
  returning * into v_comment;
  insert into public.task_watchers (task_id, user_id) values (p_task_id, auth.uid()) on conflict do nothing;
  return v_comment;
end;
$$;

create or replace function public.request_task_review(p_task_id uuid, p_reviewer_id uuid)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare v_task public.tasks;
begin
  if not public.task_action_allowed(auth.uid(), p_task_id, 'edit_task') then raise exception 'PERMISSION_DENIED' using errcode = 'PT403'; end if;
  select * into v_task from public.tasks where id = p_task_id and deleted_at is null;
  if v_task.id is null then raise exception 'TASK_NOT_FOUND' using errcode = 'PT404'; end if;
  perform public.assert_task_assignee_valid(v_task.space_id, p_reviewer_id);
  update public.tasks set reviewer_id = p_reviewer_id, status = 'review', updated_at = now()
  where id = p_task_id
  returning * into v_task;
  return v_task;
end;
$$;

create or replace function public.complete_task_review(p_task_id uuid, p_approved boolean, p_comment text default null)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare v_task public.tasks; v_next_status text;
begin
  select * into v_task from public.tasks where id = p_task_id and deleted_at is null;
  if v_task.id is null then raise exception 'TASK_NOT_FOUND' using errcode = 'PT404'; end if;
  if v_task.reviewer_id is not null and v_task.reviewer_id <> auth.uid() and not public.task_action_allowed(auth.uid(), p_task_id, 'edit_task') then
    raise exception 'PERMISSION_DENIED' using errcode = 'PT403';
  end if;
  v_next_status := case when p_approved then 'done' else 'in_progress' end;
  update public.tasks set status = v_next_status, completed_at = case when p_approved then now() else null end, updated_at = now()
  where id = p_task_id
  returning * into v_task;
  if nullif(trim(coalesce(p_comment, '')), '') is not null then
    insert into public.task_comments (task_id, author_id, content) values (p_task_id, auth.uid(), trim(p_comment));
  end if;
  return v_task;
end;
$$;

revoke execute on function public.archive_task(uuid) from public, anon;
revoke execute on function public.delete_task(uuid) from public, anon;
revoke execute on function public.add_task_comment(uuid, text, uuid) from public, anon;
revoke execute on function public.request_task_review(uuid, uuid) from public, anon;
revoke execute on function public.complete_task_review(uuid, boolean, text) from public, anon;
grant execute on function public.archive_task(uuid) to authenticated;
grant execute on function public.delete_task(uuid) to authenticated;
grant execute on function public.add_task_comment(uuid, text, uuid) to authenticated;
grant execute on function public.request_task_review(uuid, uuid) to authenticated;
grant execute on function public.complete_task_review(uuid, boolean, text) to authenticated;
notify pgrst, 'reload schema';
