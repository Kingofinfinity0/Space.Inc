create table if not exists public.task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  field_name text,
  old_value jsonb,
  new_value jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.task_activity enable row level security;

create index if not exists idx_task_activity_task_created
on public.task_activity (task_id, created_at desc);

create index if not exists idx_task_activity_actor_created
on public.task_activity (actor_id, created_at desc);

drop policy if exists task_activity_space_members_select on public.task_activity;
create policy task_activity_space_members_select
on public.task_activity
for select
to authenticated
using (public.task_action_allowed((select auth.uid()), task_id, 'view_task'));

revoke all on table public.task_activity from public, anon;
grant select on table public.task_activity to authenticated;

notify pgrst, 'reload schema';
