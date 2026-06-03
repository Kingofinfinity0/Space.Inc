alter table public.task_statuses enable row level security;
alter table public.task_watchers enable row level security;
alter table public.task_comments enable row level security;

drop policy if exists task_statuses_space_members_select on public.task_statuses;
create policy task_statuses_space_members_select
on public.task_statuses
for select
to authenticated
using (public.space_task_action_allowed((select auth.uid()), space_id, 'view_task'));

drop policy if exists task_watchers_task_members_select on public.task_watchers;
create policy task_watchers_task_members_select
on public.task_watchers
for select
to authenticated
using (public.task_action_allowed((select auth.uid()), task_id, 'view_task'));

drop policy if exists task_watchers_self_insert on public.task_watchers;
create policy task_watchers_self_insert
on public.task_watchers
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and public.task_action_allowed((select auth.uid()), task_id, 'view_task')
);

drop policy if exists task_watchers_self_delete on public.task_watchers;
create policy task_watchers_self_delete
on public.task_watchers
for delete
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists task_comments_space_members_select on public.task_comments;
create policy task_comments_space_members_select
on public.task_comments
for select
to authenticated
using (public.task_action_allowed((select auth.uid()), task_id, 'view_task'));

notify pgrst, 'reload schema';
