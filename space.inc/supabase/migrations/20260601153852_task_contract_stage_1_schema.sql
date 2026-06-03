alter table public.space_memberships
  add column if not exists user_id uuid,
  add column if not exists organization_id uuid,
  add column if not exists capabilities jsonb not null default '{}'::jsonb,
  add column if not exists status text not null default 'active',
  add column if not exists context_role text;

update public.space_memberships
set user_id = profile_id
where user_id is null and profile_id is not null;

update public.space_memberships sm
set organization_id = coalesce(sm.organization_id, sm.org_id, s.organization_id)
from public.spaces s
where sm.space_id = s.id
  and sm.organization_id is null;

update public.space_memberships
set context_role = case
  when role::text in ('owner', 'admin', 'staff', 'member') then 'staff'
  else 'client'
end
where context_role is null;

alter table public.tasks
  add column if not exists reviewer_id uuid references public.profiles(id),
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id),
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id),
  add column if not exists start_date date,
  add column if not exists task_number integer,
  add column if not exists parent_task_id uuid references public.tasks(id),
  add column if not exists estimate_points integer,
  add column if not exists estimate_hours numeric,
  add column if not exists assigned_group text;

create table if not exists public.task_statuses (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  status_key text not null,
  name text not null,
  category text not null check (category in ('todo', 'active', 'review', 'done', 'canceled')),
  color text not null default '#6E6E80',
  position integer not null default 0,
  is_default boolean not null default false,
  is_terminal boolean not null default false,
  is_actionable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (space_id, status_key)
);

alter table public.task_statuses enable row level security;

insert into public.task_statuses (space_id, status_key, name, category, color, position, is_default, is_terminal, is_actionable)
select s.id, v.status_key, v.name, v.category, v.color, v.position, v.is_default, v.is_terminal, v.is_actionable
from public.spaces s
cross join (values
  ('in_progress', 'In Progress', 'active', '#2563EB', 10, false, false, true),
  ('todo', 'To Do', 'todo', '#6B7280', 20, true, false, true),
  ('pending', 'Pending', 'todo', '#F59E0B', 30, false, false, true),
  ('review', 'Review', 'review', '#7C3AED', 40, false, false, true),
  ('done', 'Done', 'done', '#16A34A', 50, false, true, false),
  ('canceled', 'Canceled', 'canceled', '#DC2626', 60, false, true, false)
) as v(status_key, name, category, color, position, is_default, is_terminal, is_actionable)
on conflict (space_id, status_key) do nothing;

create table if not exists public.task_watchers (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

alter table public.task_watchers enable row level security;
create index if not exists idx_task_watchers_user on public.task_watchers (user_id, created_at desc);

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  content text not null,
  parent_comment_id uuid references public.task_comments(id) on delete cascade,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

alter table public.task_comments
  add column if not exists parent_comment_id uuid references public.task_comments(id) on delete cascade,
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;

alter table public.task_comments enable row level security;
create index if not exists idx_task_comments_task on public.task_comments (task_id, created_at);
