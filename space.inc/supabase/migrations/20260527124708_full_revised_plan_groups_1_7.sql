-- Full revised plan implementation: Groups 1 through 7.
-- Adds the database contract required by the frontend and Edge Functions while
-- preserving all names from the implementation plan.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

do $$
begin
  create type public.member_type as enum ('staff', 'client');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.member_role as enum ('owner', 'admin', 'manager', 'member', 'viewer');
exception when duplicate_object then null;
end $$;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  recipient_id uuid references public.profiles(id) on delete cascade,
  type text not null default 'system',
  title text,
  message text not null,
  read boolean not null default false,
  action_url text,
  delivery_status text default 'delivered',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.notifications
  add column if not exists recipient_id uuid references public.profiles(id),
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists title text,
  add column if not exists action_url text,
  add column if not exists delivery_status text default 'delivered';

alter table public.notifications enable row level security;

drop policy if exists notifications_select_by_recipient on public.notifications;
create policy notifications_select_by_recipient
on public.notifications
for select
to authenticated
using (coalesce(recipient_id, user_id) = auth.uid());

drop policy if exists notifications_update_by_recipient_v2 on public.notifications;
create policy notifications_update_by_recipient_v2
on public.notifications
for update
to authenticated
using (coalesce(recipient_id, user_id) = auth.uid())
with check (coalesce(recipient_id, user_id) = auth.uid());

do $$
begin
  alter table public.notifications drop constraint if exists notifications_type_check;
  alter table public.notifications drop constraint if exists notifications_type_check_v2;
end $$;

create table if not exists public.org_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'client',
  base_role text,
  status text not null default 'active',
  joined_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.space_members (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_type public.member_type not null default 'client',
  role public.member_role not null default 'member',
  invited_by uuid references public.profiles(id),
  joined_at timestamptz not null default now(),
  unique (space_id, user_id)
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  email extensions.citext not null,
  member_type public.member_type not null default 'client',
  role public.member_role not null default 'member',
  token_hash text,
  status text not null default 'pending',
  invited_by uuid references public.profiles(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.invitation_events (
  id bigserial primary key,
  invitation_id uuid references public.invitations(id) on delete cascade,
  event_type text not null,
  actor_id uuid references public.profiles(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.space_share_links (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null unique references public.spaces(id) on delete cascade,
  token_hash text not null,
  default_member_type public.member_type not null default 'client',
  default_role public.member_role not null default 'member',
  allowed_email_domain text,
  max_uses integer,
  use_count integer not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  rotated_at timestamptz
);

alter table public.org_memberships enable row level security;
alter table public.space_members enable row level security;
alter table public.invitations enable row level security;
alter table public.invitation_events enable row level security;
alter table public.space_share_links enable row level security;

create index if not exists idx_notifications_recipient_unread
on public.notifications (recipient_id, read, created_at desc);

create or replace function public.notify_user(
  p_org_id uuid,
  p_space_id uuid,
  p_recipient_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_payload jsonb default '{}'::jsonb,
  p_action_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_recipient_id is null then
    return;
  end if;

  insert into public.notifications (
    organization_id, space_id, recipient_id, user_id,
    type, title, message, read, action_url, delivery_status, payload
  ) values (
    p_org_id, p_space_id, p_recipient_id, p_recipient_id,
    p_type, p_title, p_message, false, p_action_url, 'delivered',
    coalesce(p_payload, '{}'::jsonb)
  );
exception when others then
  raise warning 'notify_user failed for %: %', p_recipient_id, sqlerrm;
end;
$$;

create or replace function public.notify_users(
  p_org_id uuid,
  p_space_id uuid,
  p_recipient_ids uuid[],
  p_type text,
  p_title text,
  p_message text,
  p_payload jsonb default '{}'::jsonb,
  p_action_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient uuid;
begin
  foreach v_recipient in array coalesce(p_recipient_ids, array[]::uuid[]) loop
    perform public.notify_user(
      p_org_id, p_space_id, v_recipient, p_type, p_title,
      p_message, p_payload, p_action_url
    );
  end loop;
end;
$$;

create or replace function public.get_org_admin_ids(p_org_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct user_id), array[]::uuid[])
  from (
    select om.user_id
    from public.org_memberships om
    where om.organization_id = p_org_id
      and coalesce(om.status, 'active') = 'active'
      and coalesce(om.role, om.base_role) in ('owner', 'admin')
    union
    select p.id
    from public.profiles p
    where p.organization_id = p_org_id
      and coalesce(p.is_active, true) = true
      and p.role::text in ('owner', 'admin')
  ) admins;
$$;

create or replace function public.rls_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.org_memberships om
    where om.user_id = auth.uid()
      and coalesce(om.status, 'active') = 'active'
      and coalesce(om.role, om.base_role) in ('owner', 'admin')
  ) or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.is_active, true) = true
      and p.role::text in ('owner', 'admin')
  );
$$;

create or replace function public.rls_is_staff_or_above()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.org_memberships om
    where om.user_id = auth.uid()
      and coalesce(om.status, 'active') = 'active'
      and coalesce(om.role, om.base_role) in ('owner', 'admin', 'staff')
  ) or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.is_active, true) = true
      and p.role::text in ('owner', 'admin', 'staff')
  );
$$;

create or replace function public.rls_is_org_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_my_org_id_secure() is not null;
$$;

create or replace function public.rls_in_space(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.space_memberships sm
    where sm.space_id = p_space_id
      and sm.profile_id = auth.uid()
      and coalesce(sm.is_active, true) = true
      and coalesce(sm.status, 'active') = 'active'
  ) or exists (
    select 1
    from public.space_members sm
    where sm.space_id = p_space_id
      and sm.user_id = auth.uid()
  ) or exists (
    select 1
    from public.spaces s
    join public.org_memberships om on om.organization_id = s.organization_id
    where s.id = p_space_id
      and om.user_id = auth.uid()
      and coalesce(om.status, 'active') = 'active'
      and coalesce(om.role, om.base_role) in ('owner', 'admin')
  );
$$;

create or replace function public.can_access_meeting(p_meeting_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.meetings m
    where m.id = p_meeting_id
      and m.organization_id = public.get_my_org_id_secure()
      and public.rls_in_space(m.space_id)
  );
$$;

create or replace function public.can_access_task(p_task_id uuid)
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
      and t.organization_id = public.get_my_org_id_secure()
      and (t.space_id is null or public.rls_in_space(t.space_id))
  );
$$;

-- Group 1: Space lifecycle.
alter table public.spaces
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references public.profiles(id),
  add column if not exists closure_reason text,
  add column if not exists closed_reason text;

alter table public.spaces
  alter column status drop default;

alter table public.spaces
  alter column status type text using lower(status::text);

alter table public.spaces
  alter column status set default 'active';

update public.spaces
set status = case
  when lower(status) in ('active', 'onboarding') then 'active'
  when lower(status) in ('archived', 'paused') then 'archived'
  when lower(status) = 'closed' then 'closed'
  else 'active'
end
where status is not null;

alter table public.spaces
  drop constraint if exists spaces_status_check;

alter table public.spaces
  add constraint spaces_status_check
  check (status in ('active', 'archived', 'closed'));

create or replace function public.trg_notify_space_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name text;
  v_admin_ids uuid[];
  v_member_ids uuid[];
begin
  select coalesce(full_name, split_part(email, '@', 1), 'Someone')
  into v_actor_name
  from public.profiles
  where id = coalesce(NEW.created_by, NEW.closed_by, auth.uid());

  v_admin_ids := public.get_org_admin_ids(NEW.organization_id);

  select coalesce(array_agg(distinct sm.profile_id), array[]::uuid[])
  into v_member_ids
  from public.space_memberships sm
  where sm.space_id = NEW.id
    and coalesce(sm.is_active, true) = true
    and coalesce(sm.status, 'active') = 'active';

  if TG_OP = 'INSERT' then
    perform public.notify_users(
      NEW.organization_id, NEW.id, v_admin_ids, 'space_created', 'Space created',
      coalesce(v_actor_name, 'Someone') || ' created a new space: ' || NEW.name,
      jsonb_build_object('space_id', NEW.id, 'space_name', NEW.name)
    );
    return NEW;
  end if;

  if TG_OP = 'UPDATE' and OLD.deleted_at is null and NEW.deleted_at is not null then
    perform public.notify_users(
      NEW.organization_id, NEW.id, v_admin_ids, 'space_deleted', 'Space deleted',
      coalesce(v_actor_name, 'Someone') || ' permanently deleted ' || NEW.name,
      jsonb_build_object('space_id', NEW.id, 'space_name', NEW.name)
    );
  elsif TG_OP = 'UPDATE' and OLD.status is distinct from NEW.status and NEW.status = 'archived' then
    perform public.notify_users(
      NEW.organization_id, NEW.id, v_member_ids || v_admin_ids, 'space_archived', 'Space archived',
      coalesce(v_actor_name, 'Someone') || ' has archived ' || NEW.name,
      jsonb_build_object('space_id', NEW.id, 'space_name', NEW.name)
    );
  elsif TG_OP = 'UPDATE' and OLD.status is distinct from NEW.status and NEW.status = 'closed' then
    perform public.notify_users(
      NEW.organization_id, NEW.id, v_member_ids || v_admin_ids, 'space_closed', 'Space closed',
      NEW.name || ' has been closed. The engagement has formally ended.',
      jsonb_build_object('space_id', NEW.id, 'space_name', NEW.name, 'closure_reason', NEW.closure_reason)
    );
  elsif TG_OP = 'UPDATE' and OLD.status = 'archived' and NEW.status = 'active' then
    perform public.notify_users(
      NEW.organization_id, NEW.id, v_member_ids, 'space_restored', 'Space restored',
      NEW.name || ' has been restored and is now active',
      jsonb_build_object('space_id', NEW.id, 'space_name', NEW.name)
    );
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_notify_space_lifecycle on public.spaces;
create trigger trg_notify_space_lifecycle
after insert or update on public.spaces
for each row execute function public.trg_notify_space_lifecycle();

create or replace function public.trg_notify_org_member_joined()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_role text;
  v_org_id uuid;
  v_admin_ids uuid[];
begin
  v_org_id := NEW.organization_id;
  v_role := coalesce(NEW.role, NEW.base_role, 'client');

  select coalesce(full_name, split_part(email, '@', 1), 'Someone')
  into v_name
  from public.profiles
  where id = NEW.user_id;

  v_admin_ids := public.get_org_admin_ids(v_org_id);

  if v_role in ('owner', 'admin', 'staff') then
    perform public.notify_users(
      v_org_id, null, v_admin_ids, 'org_member_joined', 'Team member joined',
      coalesce(v_name, 'Someone') || ' has joined the organization as ' || initcap(v_role),
      jsonb_build_object('user_id', NEW.user_id, 'role', v_role)
    );
  elsif v_role = 'client' then
    perform public.notify_users(
      v_org_id, null, v_admin_ids, 'client_joined_org', 'Client joined',
      coalesce(v_name, 'Someone') || ' has joined as a client',
      jsonb_build_object('user_id', NEW.user_id, 'role', v_role)
    );
  end if;

  return NEW;
end;
$$;

do $$
begin
  if to_regclass('public.org_memberships') is not null then
    drop trigger if exists trg_notify_org_member_joined on public.org_memberships;
    create trigger trg_notify_org_member_joined
    after insert on public.org_memberships
    for each row execute function public.trg_notify_org_member_joined();
  end if;
end $$;

create or replace function public.close_space(p_space_id uuid, p_closure_reason text)
returns public.spaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space public.spaces;
begin
  if not public.has_space_role(auth.uid(), p_space_id, array['owner','admin']::public.member_role[]) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'PT403';
  end if;

  update public.spaces
  set status = 'closed',
      closed_at = now(),
      closed_by = auth.uid(),
      closure_reason = p_closure_reason,
      closed_reason = coalesce(p_closure_reason, closed_reason),
      updated_at = now()
  where id = p_space_id
    and deleted_at is null
  returning * into v_space;

  if not found then
    raise exception 'SPACE_NOT_FOUND' using errcode = 'PT404';
  end if;

  return v_space;
end;
$$;

create or replace function public.restore_space(p_space_id uuid)
returns public.spaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space public.spaces;
begin
  if not public.has_space_role(auth.uid(), p_space_id, array['owner','admin']::public.member_role[]) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'PT403';
  end if;

  update public.spaces
  set status = 'active',
      updated_at = now()
  where id = p_space_id
    and status = 'archived'
    and deleted_at is null
  returning * into v_space;

  if not found then
    raise exception 'SPACE_NOT_RESTORABLE' using errcode = 'PT400';
  end if;

  return v_space;
end;
$$;

create or replace function public.update_space_status(p_space_id uuid, p_status text)
returns public.spaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space public.spaces;
  v_status text := lower(trim(p_status));
begin
  if v_status = 'closed' then
    return public.close_space(p_space_id, null);
  elsif v_status = 'active' then
    return public.restore_space(p_space_id);
  elsif v_status <> 'archived' then
    raise exception 'INVALID_SPACE_STATUS' using errcode = 'PT400';
  end if;

  if not public.has_space_role(auth.uid(), p_space_id, array['owner','admin']::public.member_role[]) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'PT403';
  end if;

  update public.spaces
  set status = v_status,
      updated_at = now()
  where id = p_space_id
    and deleted_at is null
  returning * into v_space;

  if not found then
    raise exception 'SPACE_NOT_FOUND' using errcode = 'PT404';
  end if;

  return v_space;
end;
$$;

create or replace function public.delete_space_soft(p_space_id uuid)
returns public.spaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space public.spaces;
begin
  if not public.has_space_role(auth.uid(), p_space_id, array['owner','admin']::public.member_role[]) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'PT403';
  end if;

  update public.spaces
  set deleted_at = now(),
      updated_at = now()
  where id = p_space_id
    and deleted_at is null
  returning * into v_space;

  if not found then
    raise exception 'SPACE_NOT_FOUND' using errcode = 'PT404';
  end if;

  return v_space;
end;
$$;

-- Group 2: Membership and presence.
alter table public.space_memberships
  add column if not exists user_id uuid references public.profiles(id),
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists last_seen_at timestamptz,
  add column if not exists is_online boolean default false;

update public.space_memberships sm
set user_id = coalesce(user_id, profile_id)
where user_id is null;

update public.space_memberships sm
set organization_id = s.organization_id
from public.spaces s
where s.id = sm.space_id
  and sm.organization_id is null;

create index if not exists idx_space_memberships_presence
on public.space_memberships (space_id, is_active, last_seen_at desc);

create or replace function public.trg_notify_space_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_space_name text;
  v_member_name text;
  v_admin_staff_ids uuid[];
begin
  select s.organization_id, s.name
  into v_org_id, v_space_name
  from public.spaces s
  where s.id = coalesce(NEW.space_id, OLD.space_id);

  select coalesce(full_name, split_part(email, '@', 1), 'Someone')
  into v_member_name
  from public.profiles
  where id = coalesce(NEW.profile_id, OLD.profile_id);

  select coalesce(array_agg(distinct sm.profile_id), array[]::uuid[])
  into v_admin_staff_ids
  from public.space_memberships sm
  where sm.space_id = coalesce(NEW.space_id, OLD.space_id)
    and coalesce(sm.is_active, true) = true
    and sm.role::text in ('owner', 'admin', 'staff');

  if TG_OP = 'INSERT' then
    perform public.notify_user(
      v_org_id, NEW.space_id, NEW.profile_id, 'space_member_added',
      'Added to space', 'You have been added to ' || v_space_name,
      jsonb_build_object('space_id', NEW.space_id)
    );
    perform public.notify_users(
      v_org_id, NEW.space_id, array_remove(v_admin_staff_ids, NEW.profile_id),
      'space_member_joined', 'Someone joined space',
      coalesce(v_member_name, 'Someone') || ' has joined your ' || v_space_name || ' space',
      jsonb_build_object('space_id', NEW.space_id, 'member_id', NEW.profile_id)
    );
  elsif TG_OP = 'UPDATE' and coalesce(OLD.is_active, true) = true and coalesce(NEW.is_active, true) = false then
    perform public.notify_user(
      v_org_id, NEW.space_id, NEW.profile_id, 'space_member_removed',
      'Removed from space', 'You have been removed from ' || v_space_name,
      jsonb_build_object('space_id', NEW.space_id)
    );
    perform public.notify_users(
      v_org_id, NEW.space_id, array_remove(v_admin_staff_ids, NEW.profile_id),
      'space_member_removed_admin', 'Member removed',
      coalesce(v_member_name, 'Someone') || ' has been removed from ' || v_space_name,
      jsonb_build_object('space_id', NEW.space_id, 'member_id', NEW.profile_id)
    );
  elsif TG_OP = 'UPDATE' and OLD.role is distinct from NEW.role then
    perform public.notify_user(
      v_org_id, NEW.space_id, NEW.profile_id, 'space_role_changed',
      'Role changed', 'Your role in ' || v_space_name || ' changed to ' || NEW.role::text,
      jsonb_build_object('space_id', NEW.space_id, 'role', NEW.role::text)
    );
  end if;

  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_notify_space_membership on public.space_memberships;
create trigger trg_notify_space_membership
after insert or update of is_active, role, status on public.space_memberships
for each row execute function public.trg_notify_space_membership();

create or replace function public.trg_notify_invitation_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_space_name text;
  v_inviter uuid;
  v_accepted_by uuid;
  v_name text;
  v_admin_ids uuid[];
begin
  if coalesce(OLD.status, '') = 'accepted' or NEW.status <> 'accepted' then
    return NEW;
  end if;

  select s.organization_id, s.name
  into v_org_id, v_space_name
  from public.spaces s
  where s.id = NEW.space_id;

  v_inviter := NEW.invited_by;
  v_accepted_by := nullif(to_jsonb(NEW)->>'accepted_by', '')::uuid;

  select coalesce(full_name, split_part(email, '@', 1), NEW.email::text, 'Someone')
  into v_name
  from public.profiles
  where id = v_accepted_by;

  if v_name is null then
    v_name := NEW.email::text;
  end if;

  select coalesce(array_agg(distinct sm.profile_id), array[]::uuid[])
  into v_admin_ids
  from public.space_memberships sm
  where sm.space_id = NEW.space_id
    and coalesce(sm.is_active, true) = true
    and sm.role::text in ('owner', 'admin', 'staff');

  perform public.notify_users(
    v_org_id, NEW.space_id, array_append(v_admin_ids, v_inviter),
    'invitation_accepted', 'Invitation accepted',
    coalesce(v_name, 'Someone') || ' accepted your invitation to ' || v_space_name,
    jsonb_build_object('space_id', NEW.space_id, 'invitation_id', NEW.id)
  );

  return NEW;
end;
$$;

do $$
begin
  if to_regclass('public.invitations') is not null then
    drop trigger if exists trg_notify_invitation_accepted on public.invitations;
    create trigger trg_notify_invitation_accepted
    after update of status on public.invitations
    for each row execute function public.trg_notify_invitation_accepted();
  end if;
end $$;

create or replace function public.trg_notify_invitation_expired()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
  v_count integer := 0;
begin
  for v_invite in
    update public.invitations i
    set status = 'expired'
    from public.spaces s
    where s.id = i.space_id
      and i.status = 'pending'
      and i.expires_at < now()
    returning i.id, i.space_id, i.email, i.invited_by, s.organization_id, s.name as space_name
  loop
    v_count := v_count + 1;
    perform public.notify_user(
      v_invite.organization_id, v_invite.space_id, v_invite.invited_by,
      'invitation_expired', 'Invitation expired',
      'Your invitation to ' || v_invite.email::text || ' for ' || v_invite.space_name || ' has expired',
      jsonb_build_object('space_id', v_invite.space_id, 'invitation_id', v_invite.id)
    );
  end loop;

  return v_count;
end;
$$;

create or replace function public.ping_presence(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.rls_in_space(p_space_id) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'PT403';
  end if;

  update public.space_memberships
  set last_seen_at = now(),
      is_online = true,
      user_id = coalesce(user_id, auth.uid())
  where space_id = p_space_id
    and profile_id = auth.uid()
    and coalesce(is_active, true) = true;
end;
$$;

create or replace function public.get_space_member_presence(p_space_id uuid)
returns table (
  member_id uuid,
  user_id uuid,
  full_name text,
  email text,
  avatar_url text,
  role text,
  is_online boolean,
  last_seen_at timestamptz,
  presence_state text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.rls_in_space(p_space_id) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'PT403';
  end if;

  return query
  select
    sm.id,
    sm.profile_id,
    p.full_name,
    p.email,
    p.avatar_url,
    sm.role::text,
    (coalesce(sm.is_online, false) and sm.last_seen_at > now() - interval '2 minutes') as is_online,
    sm.last_seen_at,
    case
      when sm.last_seen_at is null then 'offline'
      when sm.last_seen_at > now() - interval '2 minutes' then 'online'
      when sm.last_seen_at > now() - interval '10 minutes' then 'away'
      else 'offline'
    end as presence_state
  from public.space_memberships sm
  join public.profiles p on p.id = sm.profile_id
  where sm.space_id = p_space_id
    and coalesce(sm.is_active, true) = true
  order by
    case sm.role::text when 'owner' then 0 when 'admin' then 1 when 'staff' then 2 else 3 end,
    p.full_name nulls last,
    p.email;
end;
$$;

create or replace function public.remove_space_member(p_space_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_space_role(auth.uid(), p_space_id, array['owner','admin']::public.member_role[]) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'PT403';
  end if;

  update public.space_memberships
  set is_active = false,
      status = 'suspended'
  where space_id = p_space_id
    and profile_id = p_user_id
    and coalesce(is_active, true) = true;

  update public.space_members
  set role = role
  where space_id = p_space_id
    and user_id = p_user_id;
end;
$$;

-- Group 3: Linear-style task system.
alter table public.tasks
  add column if not exists task_number integer,
  add column if not exists parent_task_id uuid references public.tasks(id) on delete cascade,
  add column if not exists estimate_points integer,
  add column if not exists estimate_hours numeric(5,2),
  add column if not exists assigned_group text,
  add column if not exists sprint_id uuid;

create table if not exists public.task_labels (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  name text not null,
  color text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create unique index if not exists task_labels_space_lower_name_key
on public.task_labels (space_id, lower(name));

create table if not exists public.task_label_assignments (
  task_id uuid references public.tasks(id) on delete cascade,
  label_id uuid references public.task_labels(id) on delete cascade,
  primary key (task_id, label_id)
);

create table if not exists public.task_relations (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade,
  related_task_id uuid references public.tasks(id) on delete cascade,
  relation_type text not null check (relation_type in ('blocks', 'blocked_by', 'related_to', 'duplicate_of')),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  unique (task_id, related_task_id, relation_type)
);

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade,
  author_id uuid references public.profiles(id),
  content text not null,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  action text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz default now()
);

create table if not exists public.task_saved_filters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  space_id uuid references public.spaces(id) on delete cascade,
  name text not null,
  filters jsonb not null,
  created_at timestamptz default now(),
  unique (user_id, space_id, name)
);

create table if not exists public.task_sprints (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  name text not null,
  starts_at date not null,
  ends_at date not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table if not exists public.task_sprint_assignments (
  sprint_id uuid references public.task_sprints(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  primary key (sprint_id, task_id)
);

create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade,
  file_id uuid references public.files(id) on delete cascade,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  unique (task_id, file_id)
);

alter table public.task_labels enable row level security;
alter table public.task_label_assignments enable row level security;
alter table public.task_relations enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_activity enable row level security;
alter table public.task_saved_filters enable row level security;
alter table public.task_sprints enable row level security;
alter table public.task_sprint_assignments enable row level security;
alter table public.task_attachments enable row level security;

drop policy if exists task_labels_space_members_select on public.task_labels;
create policy task_labels_space_members_select on public.task_labels
for select to authenticated using (public.rls_in_space(space_id));

drop policy if exists task_comments_space_members_select on public.task_comments;
create policy task_comments_space_members_select on public.task_comments
for select to authenticated using (
  exists (select 1 from public.tasks t where t.id = task_comments.task_id and public.rls_in_space(t.space_id))
);

drop policy if exists task_activity_space_members_select on public.task_activity;
create policy task_activity_space_members_select on public.task_activity
for select to authenticated using (
  exists (select 1 from public.tasks t where t.id = task_activity.task_id and public.rls_in_space(t.space_id))
);

create index if not exists idx_tasks_space_number on public.tasks(space_id, task_number);
create index if not exists idx_tasks_assignee_status on public.tasks(assignee_id, status);
create index if not exists idx_task_comments_task_created on public.task_comments(task_id, created_at);
create index if not exists idx_task_activity_task_created on public.task_activity(task_id, created_at desc);

create or replace function public.generate_task_number(p_space_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  select coalesce(max(task_number), 0) + 1
  into v_next
  from public.tasks
  where space_id = p_space_id;

  return v_next;
end;
$$;

create or replace function public.log_task_activity(
  p_task_id uuid,
  p_action text,
  p_old jsonb default null,
  p_new jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.task_activity (task_id, actor_id, action, old_value, new_value)
  values (p_task_id, auth.uid(), p_action, p_old, p_new);
end;
$$;

create or replace function public.trg_task_number_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.task_number is null and NEW.space_id is not null then
    NEW.task_number := public.generate_task_number(NEW.space_id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_task_number_on_insert on public.tasks;
create trigger trg_task_number_on_insert
before insert on public.tasks
for each row execute function public.trg_task_number_on_insert();

create or replace function public.trg_log_task_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    perform public.log_task_activity(NEW.id, 'created', null, to_jsonb(NEW));
  elsif TG_OP = 'UPDATE' and (
    OLD.title is distinct from NEW.title or
    OLD.description is distinct from NEW.description or
    OLD.status is distinct from NEW.status or
    OLD.priority is distinct from NEW.priority or
    OLD.assignee_id is distinct from NEW.assignee_id or
    OLD.due_date is distinct from NEW.due_date or
    OLD.estimate_points is distinct from NEW.estimate_points or
    OLD.estimate_hours is distinct from NEW.estimate_hours
  ) then
    perform public.log_task_activity(NEW.id, 'updated', to_jsonb(OLD), to_jsonb(NEW));
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_log_task_changes on public.tasks;
create trigger trg_log_task_changes
after insert or update on public.tasks
for each row execute function public.trg_log_task_changes();

create or replace function public.trg_notify_task_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_name text;
  v_org_id uuid;
begin
  select s.name, s.organization_id
  into v_space_name, v_org_id
  from public.spaces s
  where s.id = NEW.space_id;

  if TG_OP = 'INSERT' and NEW.assignee_id is not null then
    perform public.notify_user(
      v_org_id, NEW.space_id, NEW.assignee_id, 'task_assigned', 'Task assigned',
      'You were assigned ' || NEW.title,
      jsonb_build_object('task_id', NEW.id, 'space_id', NEW.space_id)
    );
  elsif TG_OP = 'UPDATE' and OLD.assignee_id is distinct from NEW.assignee_id and NEW.assignee_id is not null then
    perform public.notify_user(
      v_org_id, NEW.space_id, NEW.assignee_id, 'task_reassigned', 'Task reassigned',
      'You were assigned ' || NEW.title,
      jsonb_build_object('task_id', NEW.id, 'space_id', NEW.space_id)
    );
  elsif TG_OP = 'UPDATE' and OLD.status is distinct from NEW.status and NEW.status = 'done' then
    perform public.notify_user(
      v_org_id, NEW.space_id, coalesce(NEW.created_by, NEW.assignee_id), 'task_completed', 'Task completed',
      NEW.title || ' was completed',
      jsonb_build_object('task_id', NEW.id, 'space_id', NEW.space_id)
    );
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_notify_task_events on public.tasks;
create trigger trg_notify_task_events
after insert or update of assignee_id, status on public.tasks
for each row execute function public.trg_notify_task_events();

create or replace function public.get_overdue_tasks()
returns setof public.tasks
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select *
  from public.tasks t
  where t.due_date < current_date
    and coalesce(t.status, '') <> 'done'
    and t.completed_at is null;
end;
$$;

create or replace function public.notify_overdue_tasks()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.tasks;
  v_count integer := 0;
begin
  for v_task in select * from public.get_overdue_tasks() loop
    if v_task.assignee_id is not null and not exists (
      select 1
      from public.notifications n
      where coalesce(n.recipient_id, n.user_id) = v_task.assignee_id
        and n.type = 'task_overdue'
        and n.payload->>'task_id' = v_task.id::text
        and n.created_at > now() - interval '1 day'
    ) then
      perform public.notify_user(
        v_task.organization_id, v_task.space_id, v_task.assignee_id,
        'task_overdue', 'Task overdue',
        v_task.title || ' is overdue',
        jsonb_build_object('task_id', v_task.id, 'space_id', v_task.space_id)
      );
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

create or replace function public.create_subtask(
  p_parent_id uuid,
  p_title text,
  p_assignee_id uuid default null
)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent public.tasks;
  v_task public.tasks;
begin
  select * into v_parent from public.tasks where id = p_parent_id;
  if not found or not public.can_access_task(p_parent_id) then
    raise exception 'TASK_NOT_FOUND' using errcode = 'PT404';
  end if;

  insert into public.tasks (
    organization_id, space_id, parent_task_id, title, assignee_id, status, priority, created_by
  ) values (
    v_parent.organization_id, v_parent.space_id, p_parent_id, p_title, p_assignee_id, 'todo', 'medium', auth.uid()
  )
  returning * into v_task;

  perform public.log_task_activity(v_parent.id, 'subtask_created', null, to_jsonb(v_task));
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
declare
  v_task public.tasks;
begin
  if not public.can_access_task(p_task_id) then
    raise exception 'TASK_NOT_FOUND' using errcode = 'PT404';
  end if;

  select * into v_task from public.tasks where id = p_task_id;

  return jsonb_build_object(
    'task', to_jsonb(v_task),
    'labels', coalesce((select jsonb_agg(to_jsonb(l)) from public.task_label_assignments la join public.task_labels l on l.id = la.label_id where la.task_id = p_task_id), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.task_comments c where c.task_id = p_task_id and c.deleted_at is null), '[]'::jsonb),
    'activity', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from public.task_activity a where a.task_id = p_task_id), '[]'::jsonb),
    'relations', coalesce((select jsonb_agg(to_jsonb(r)) from public.task_relations r where r.task_id = p_task_id), '[]'::jsonb),
    'attachments', coalesce((select jsonb_agg(to_jsonb(ta)) from public.task_attachments ta where ta.task_id = p_task_id), '[]'::jsonb)
  );
end;
$$;

create or replace function public.add_task_comment(p_task_id uuid, p_content text)
returns public.task_comments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comment public.task_comments;
begin
  if not public.can_access_task(p_task_id) then
    raise exception 'TASK_NOT_FOUND' using errcode = 'PT404';
  end if;

  insert into public.task_comments (task_id, author_id, content)
  values (p_task_id, auth.uid(), p_content)
  returning * into v_comment;

  perform public.log_task_activity(p_task_id, 'commented', null, to_jsonb(v_comment));
  return v_comment;
end;
$$;

create or replace function public.edit_task_comment(p_comment_id uuid, p_content text)
returns public.task_comments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comment public.task_comments;
begin
  update public.task_comments
  set content = p_content,
      edited_at = now()
  where id = p_comment_id
    and author_id = auth.uid()
    and deleted_at is null
  returning * into v_comment;

  if not found then
    raise exception 'COMMENT_NOT_FOUND' using errcode = 'PT404';
  end if;

  perform public.log_task_activity(v_comment.task_id, 'comment_edited', null, to_jsonb(v_comment));
  return v_comment;
end;
$$;

create or replace function public.delete_task_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task_id uuid;
begin
  update public.task_comments
  set deleted_at = now()
  where id = p_comment_id
    and author_id = auth.uid()
    and deleted_at is null
  returning task_id into v_task_id;

  if not found then
    raise exception 'COMMENT_NOT_FOUND' using errcode = 'PT404';
  end if;

  perform public.log_task_activity(v_task_id, 'comment_deleted', null, jsonb_build_object('comment_id', p_comment_id));
end;
$$;

create or replace function public.set_task_labels(p_task_id uuid, p_label_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_access_task(p_task_id) then
    raise exception 'TASK_NOT_FOUND' using errcode = 'PT404';
  end if;

  delete from public.task_label_assignments where task_id = p_task_id;

  insert into public.task_label_assignments (task_id, label_id)
  select p_task_id, unnest(coalesce(p_label_ids, array[]::uuid[]))
  on conflict do nothing;

  perform public.log_task_activity(p_task_id, 'labels_changed', null, jsonb_build_object('label_ids', p_label_ids));
end;
$$;

create or replace function public.create_task_label(p_space_id uuid, p_name text, p_color text)
returns public.task_labels
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label public.task_labels;
begin
  if not public.has_space_role(auth.uid(), p_space_id, array['owner','admin','manager']::public.member_role[]) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'PT403';
  end if;

  insert into public.task_labels (space_id, name, color, created_by)
  values (p_space_id, p_name, p_color, auth.uid())
  on conflict (space_id, (lower(name))) do update set color = excluded.color
  returning * into v_label;

  return v_label;
end;
$$;

create or replace function public.set_task_relation(p_task_id uuid, p_related_id uuid, p_type text)
returns public.task_relations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_relation public.task_relations;
  v_space_id uuid;
  v_related_space_id uuid;
begin
  if p_type not in ('blocks', 'blocked_by', 'related_to', 'duplicate_of') then
    raise exception 'INVALID_RELATION_TYPE' using errcode = 'PT400';
  end if;

  select space_id into v_space_id from public.tasks where id = p_task_id;
  select space_id into v_related_space_id from public.tasks where id = p_related_id;

  if v_space_id is distinct from v_related_space_id or not public.rls_in_space(v_space_id) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'PT403';
  end if;

  insert into public.task_relations (task_id, related_task_id, relation_type, created_by)
  values (p_task_id, p_related_id, p_type, auth.uid())
  on conflict (task_id, related_task_id, relation_type) do update set relation_type = excluded.relation_type
  returning * into v_relation;

  perform public.log_task_activity(p_task_id, 'relation_changed', null, to_jsonb(v_relation));
  return v_relation;
end;
$$;

create or replace function public.get_my_tasks(p_filters jsonb default '{}'::jsonb)
returns setof public.tasks
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select t.*
  from public.tasks t
  where t.assignee_id = auth.uid()
    and t.organization_id = public.get_my_org_id_secure()
    and (p_filters->>'status' is null or t.status = p_filters->>'status')
    and (p_filters->>'priority' is null or t.priority = p_filters->>'priority')
  order by t.due_date nulls last, t.created_at desc;
end;
$$;

create or replace function public.bulk_update_tasks(p_task_ids uuid[], p_updates jsonb)
returns setof public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task_id uuid;
  v_task public.tasks;
begin
  foreach v_task_id in array coalesce(p_task_ids, array[]::uuid[]) loop
    v_task := public.update_task(v_task_id, p_updates);
    return next v_task;
  end loop;
end;
$$;

create or replace function public.create_sprint(p_space_id uuid, p_name text, p_start date, p_end date)
returns public.task_sprints
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sprint public.task_sprints;
begin
  if not public.has_space_role(auth.uid(), p_space_id, array['owner','admin','manager']::public.member_role[]) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'PT403';
  end if;

  insert into public.task_sprints (space_id, name, starts_at, ends_at, created_by)
  values (p_space_id, p_name, p_start, p_end, auth.uid())
  returning * into v_sprint;

  return v_sprint;
end;
$$;

create or replace function public.assign_tasks_to_sprint(p_sprint_id uuid, p_task_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
begin
  select space_id into v_space_id from public.task_sprints where id = p_sprint_id;
  if not found or not public.has_space_role(auth.uid(), v_space_id, array['owner','admin','manager']::public.member_role[]) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'PT403';
  end if;

  insert into public.task_sprint_assignments (sprint_id, task_id)
  select p_sprint_id, unnest(coalesce(p_task_ids, array[]::uuid[]))
  on conflict do nothing;

  update public.tasks
  set sprint_id = p_sprint_id
  where id = any(coalesce(p_task_ids, array[]::uuid[]))
    and space_id = v_space_id;
end;
$$;

create or replace function public.get_sprint_board(p_sprint_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
begin
  select space_id into v_space_id from public.task_sprints where id = p_sprint_id;
  if not found or not public.rls_in_space(v_space_id) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'PT403';
  end if;

  return (
    select jsonb_object_agg(status, tasks)
    from (
      select t.status, jsonb_agg(to_jsonb(t) order by t.created_at desc) as tasks
      from public.tasks t
      join public.task_sprint_assignments tsa on tsa.task_id = t.id
      where tsa.sprint_id = p_sprint_id
      group by t.status
    ) grouped
  );
end;
$$;

create or replace function public.save_task_filter(p_space_id uuid, p_name text, p_filters jsonb)
returns public.task_saved_filters
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filter public.task_saved_filters;
begin
  if not public.rls_in_space(p_space_id) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'PT403';
  end if;

  insert into public.task_saved_filters (user_id, space_id, name, filters)
  values (auth.uid(), p_space_id, p_name, p_filters)
  on conflict (user_id, space_id, name) do update set filters = excluded.filters
  returning * into v_filter;

  return v_filter;
end;
$$;

create or replace function public.create_task(
  p_space_id uuid,
  p_title text,
  p_description text default null,
  p_due_date date default null,
  p_priority text default 'medium',
  p_assignee_id uuid default null,
  p_status text default 'todo'
)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_task public.tasks;
begin
  v_org_id := public.get_my_org_id_secure();

  if not public.rls_in_space(p_space_id) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'PT403';
  end if;

  if not public.resolve_space_permission(auth.uid(), p_space_id, 'Task creation') then
    raise exception 'PERMISSION_DENIED' using errcode = 'PT403';
  end if;

  insert into public.tasks (
    organization_id, space_id, title, description, due_date,
    priority, assignee_id, status, created_by
  ) values (
    v_org_id, p_space_id, p_title, p_description, p_due_date,
    p_priority, p_assignee_id, p_status, auth.uid()
  )
  returning * into v_task;

  return v_task;
end;
$$;

create or replace function public.update_task(p_task_id uuid, p_updates jsonb)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.tasks;
begin
  if not public.can_access_task(p_task_id) then
    raise exception 'TASK_NOT_FOUND' using errcode = 'PT404';
  end if;

  update public.tasks
  set title = coalesce(p_updates->>'title', title),
      description = case when p_updates ? 'description' then p_updates->>'description' else description end,
      status = coalesce(p_updates->>'status', status),
      priority = coalesce(p_updates->>'priority', priority),
      due_date = case when p_updates ? 'due_date' then nullif(p_updates->>'due_date', '')::date else due_date end,
      assignee_id = case when p_updates ? 'assignee_id' then nullif(p_updates->>'assignee_id', '')::uuid else assignee_id end,
      assigned_group = case when p_updates ? 'assigned_group' then nullif(p_updates->>'assigned_group', '') else assigned_group end,
      estimate_points = case when p_updates ? 'estimate_points' then nullif(p_updates->>'estimate_points', '')::integer else estimate_points end,
      estimate_hours = case when p_updates ? 'estimate_hours' then nullif(p_updates->>'estimate_hours', '')::numeric(5,2) else estimate_hours end,
      completed_at = case
        when p_updates->>'status' = 'done' then now()
        when p_updates ? 'status' and p_updates->>'status' <> 'done' then null
        else completed_at
      end,
      updated_at = now()
  where id = p_task_id
  returning * into v_task;

  if not found then
    raise exception 'TASK_NOT_FOUND' using errcode = 'PT404';
  end if;

  return v_task;
end;
$$;

create or replace function public.list_tasks(
  p_space_id uuid default null,
  p_priority text default null,
  p_search text default null,
  p_filters jsonb default '{}'::jsonb
)
returns table (
  id uuid,
  organization_id uuid,
  space_id uuid,
  assignee_id uuid,
  title text,
  due_date date,
  status text,
  created_at timestamptz,
  description text,
  priority text,
  completed_at timestamptz,
  created_by uuid,
  updated_at timestamptz,
  task_number integer,
  task_key text,
  parent_task_id uuid,
  estimate_points integer,
  estimate_hours numeric,
  assigned_group text,
  labels jsonb,
  subtask_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select
    t.id,
    t.organization_id,
    t.space_id,
    t.assignee_id,
    t.title,
    t.due_date,
    t.status,
    t.created_at,
    t.description,
    t.priority,
    t.completed_at,
    t.created_by,
    t.updated_at,
    t.task_number,
    'SPA-' || coalesce(t.task_number, 0)::text as task_key,
    t.parent_task_id,
    t.estimate_points,
    t.estimate_hours,
    t.assigned_group,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name, 'color', l.color))
      from public.task_label_assignments la
      join public.task_labels l on l.id = la.label_id
      where la.task_id = t.id
    ), '[]'::jsonb) as labels,
    (select count(*) from public.tasks st where st.parent_task_id = t.id) as subtask_count
  from public.tasks t
  where t.organization_id = public.get_my_org_id_secure()
    and (p_space_id is null or t.space_id = p_space_id)
    and (p_space_id is null or public.rls_in_space(p_space_id))
    and (p_priority is null or t.priority = p_priority)
    and (p_search is null or t.title ilike '%' || p_search || '%' or t.description ilike '%' || p_search || '%')
    and (p_filters->>'status' is null or t.status = p_filters->>'status')
    and (p_filters->>'assignee_id' is null or t.assignee_id = (p_filters->>'assignee_id')::uuid)
  order by t.created_at desc;
end;
$$;

-- Group 4: Meetings and recordings.
alter table public.recordings
  add column if not exists storage_path text,
  add column if not exists file_size_bytes bigint,
  add column if not exists created_by uuid references public.profiles(id);

alter table public.recordings
  alter column daily_recording_id drop not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meeting-recordings', 'meeting-recordings', false, 10737418240, array['video/mp4', 'video/webm'])
on conflict (id) do nothing;

create or replace function public.trg_notify_meeting_participant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meeting public.meetings;
  v_name text;
  v_role text;
  v_color text;
  v_recipients uuid[];
begin
  select * into v_meeting from public.meetings where id = NEW.meeting_id;
  if not found or v_meeting.space_id is null then
    return NEW;
  end if;

  select coalesce(full_name, split_part(email, '@', 1), 'Someone'), role::text
  into v_name, v_role
  from public.profiles
  where id = coalesce(NEW.profile_id, NEW.user_id);

  v_color := case when v_role = 'client' then 'green' else 'blue' end;

  select coalesce(array_agg(distinct sm.profile_id), array[]::uuid[])
  into v_recipients
  from public.space_memberships sm
  where sm.space_id = v_meeting.space_id
    and coalesce(sm.is_active, true) = true;

  perform public.notify_users(
    v_meeting.organization_id, v_meeting.space_id, array_remove(v_recipients, coalesce(NEW.profile_id, NEW.user_id)),
    'meeting_participant_joined', 'Meeting joined',
    coalesce(v_name, 'Someone') || ' joined the meeting',
    jsonb_build_object('meeting_id', NEW.meeting_id, 'role', v_role, 'highlight', v_color)
  );

  return NEW;
end;
$$;

drop trigger if exists trg_notify_meeting_participant on public.meeting_participants;
create trigger trg_notify_meeting_participant
after insert on public.meeting_participants
for each row execute function public.trg_notify_meeting_participant();

create or replace function public.trg_notify_recording_ready()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meeting public.meetings;
  v_recipients uuid[];
begin
  if coalesce(NEW.status, '') <> 'ready' then
    return NEW;
  end if;

  select * into v_meeting from public.meetings where id = NEW.meeting_id;
  if not found then
    return NEW;
  end if;

  select coalesce(array_agg(distinct profile_id), array[]::uuid[])
  into v_recipients
  from public.meeting_participants
  where meeting_id = NEW.meeting_id
    and profile_id is not null;

  v_recipients := array_append(v_recipients, v_meeting.created_by);

  perform public.notify_users(
    v_meeting.organization_id, v_meeting.space_id, v_recipients,
    'recording_ready', 'Recording ready',
    'Recording for ' || v_meeting.title || ' is ready to view',
    jsonb_build_object('meeting_id', NEW.meeting_id, 'recording_id', NEW.id)
  );

  return NEW;
end;
$$;

drop trigger if exists trg_notify_recording_ready on public.recordings;
create trigger trg_notify_recording_ready
after insert or update of status on public.recordings
for each row execute function public.trg_notify_recording_ready();

create or replace function public.notify_meetings_starting_soon()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meeting public.meetings;
  v_recipients uuid[];
  v_count integer := 0;
begin
  for v_meeting in
    select *
    from public.meetings
    where status in ('scheduled', 'active')
      and starts_at between now() + interval '14 minutes' and now() + interval '16 minutes'
      and deleted_at is null
  loop
    if exists (
      select 1
      from public.notifications n
      where n.type = 'meeting_starting_soon'
        and n.payload->>'meeting_id' = v_meeting.id::text
        and n.payload->>'reminder' = '15m'
    ) then
      continue;
    end if;

    select coalesce(array_agg(distinct sm.profile_id), array[]::uuid[])
    into v_recipients
    from public.space_memberships sm
    where sm.space_id = v_meeting.space_id
      and coalesce(sm.is_active, true) = true
      and sm.profile_id is not null;

    perform public.notify_users(
      v_meeting.organization_id, v_meeting.space_id, v_recipients,
      'meeting_starting_soon', 'Meeting starts soon',
      'Meeting ' || v_meeting.title || ' starts in 15 minutes',
      jsonb_build_object('meeting_id', v_meeting.id, 'reminder', '15m')
    );
    v_count := v_count + coalesce(array_length(v_recipients, 1), 0);
  end loop;

  return v_count;
end;
$$;

create or replace function public.save_meeting_recording(
  p_meeting_id uuid,
  p_storage_path text,
  p_duration_seconds integer,
  p_file_size_bytes bigint
)
returns public.recordings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recording public.recordings;
begin
  if not public.can_access_meeting(p_meeting_id) and auth.role() <> 'service_role' then
    raise exception 'NOT_AUTHORIZED' using errcode = 'PT403';
  end if;

  insert into public.recordings (
    meeting_id, storage_path, file_path, duration_seconds,
    file_size, file_size_bytes, status, created_by
  ) values (
    p_meeting_id, p_storage_path, p_storage_path, p_duration_seconds,
    p_file_size_bytes, p_file_size_bytes, 'ready', auth.uid()
  )
  on conflict (id) do update
    set storage_path = excluded.storage_path,
        file_path = excluded.file_path,
        duration_seconds = excluded.duration_seconds,
        file_size = excluded.file_size,
        file_size_bytes = excluded.file_size_bytes,
        status = 'ready',
        updated_at = now()
  returning * into v_recording;

  update public.meetings
  set has_recording = true,
      recording_id = v_recording.id,
      updated_at = now()
  where id = p_meeting_id;

  return v_recording;
end;
$$;

create or replace function public.request_recording_download(p_meeting_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_meeting public.meetings;
begin
  if not public.can_access_meeting(p_meeting_id) and auth.role() <> 'service_role' then
    raise exception 'NOT_AUTHORIZED' using errcode = 'PT403';
  end if;

  select * into v_meeting from public.meetings where id = p_meeting_id;
  if not found then
    raise exception 'MEETING_NOT_FOUND' using errcode = 'PT404';
  end if;

  return jsonb_build_object(
    'meeting_id', v_meeting.id,
    'organization_id', v_meeting.organization_id,
    'space_id', v_meeting.space_id,
    'daily_room_name', v_meeting.daily_room_name,
    'ended_at', v_meeting.ended_at,
    'status', v_meeting.status
  );
end;
$$;

create or replace function public.get_meeting_recordings(p_meeting_id uuid)
returns table (
  id uuid,
  meeting_id uuid,
  storage_path text,
  file_path text,
  duration_seconds integer,
  file_size_bytes bigint,
  status text,
  signed_url text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.can_access_meeting(p_meeting_id) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'PT403';
  end if;

  return query
  select
    r.id,
    r.meeting_id,
    coalesce(r.storage_path, r.file_path),
    r.file_path,
    r.duration_seconds,
    coalesce(r.file_size_bytes, r.file_size),
    r.status,
    null::text as signed_url,
    r.created_at
  from public.recordings r
  where r.meeting_id = p_meeting_id
  order by r.created_at desc;
end;
$$;

-- Group 5: Files quota checks.
create or replace function public.check_storage_quota_with_notify(
  p_org_id uuid,
  p_file_size_bytes bigint,
  p_uploader_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used bigint;
  v_limit bigint;
  v_max_file bigint;
  v_percent numeric;
  v_admins uuid[];
  v_filename text;
begin
  select coalesce(sum(file_size), 0)
  into v_used
  from public.files
  where organization_id = p_org_id
    and deleted_at is null
    and status <> 'deleted';

  select coalesce((metadata->>'storage_limit_bytes')::bigint, 5368709120)
  into v_limit
  from public.organizations
  where id = p_org_id;

  select coalesce(max_file_size_mb, 100) * 1024 * 1024
  into v_max_file
  from public.org_team_policies
  where organization_id = p_org_id;

  if v_max_file is null then
    v_max_file := 100 * 1024 * 1024;
  end if;

  if p_file_size_bytes is not null and p_file_size_bytes > v_max_file then
    perform public.notify_user(
      p_org_id, null, p_uploader_id, 'file_too_large', 'File too large',
      '[Filename] exceeds the maximum file size of ' || (v_max_file / 1024 / 1024)::text || ' MB.',
      jsonb_build_object('limit_bytes', v_max_file)
    );
    raise exception '[Filename] exceeds the maximum file size of %. MB.', (v_max_file / 1024 / 1024) using errcode = 'PT413';
  end if;

  if p_file_size_bytes is not null and v_used + p_file_size_bytes > v_limit then
    perform public.notify_user(
      p_org_id, null, p_uploader_id, 'storage_limit_reached', 'Storage limit reached',
      'Upload failed. Storage limit reached. Contact your administrator.',
      jsonb_build_object('used_bytes', v_used, 'limit_bytes', v_limit)
    );
    raise exception 'Upload failed. Storage limit reached. Contact your administrator.' using errcode = 'PT413';
  end if;

  v_percent := case when v_limit > 0 then ((v_used + coalesce(p_file_size_bytes, 0))::numeric / v_limit::numeric) * 100 else 0 end;

  if v_percent >= 80 then
    v_admins := public.get_org_admin_ids(p_org_id);
    perform public.notify_users(
      p_org_id, null, array_append(v_admins, p_uploader_id),
      'storage_quota_warning', 'Storage warning',
      'Your organization is using ' || round(v_percent, 1)::text || '% of storage. Consider upgrading.',
      jsonb_build_object('used_percent', v_percent, 'used_bytes', v_used, 'limit_bytes', v_limit)
    );
  end if;

  return jsonb_build_object('ok', true, 'used_percent', v_percent, 'limit_bytes', v_limit);
end;
$$;

create or replace function public.request_upload_voucher(
  p_space_id uuid,
  p_filename text,
  p_content_type text,
  p_file_size bigint default null,
  p_checksum text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_file_id uuid;
  v_storage_path text;
  v_user_role text;
  v_quota jsonb;
begin
  v_org_id := public.get_my_org_id_secure();

  if p_space_id is not null and not public.rls_in_space(p_space_id) then
    raise exception 'SPACE_NOT_FOUND' using errcode = 'PT404';
  end if;

  if not public.resolve_space_permission(auth.uid(), p_space_id, 'File uploads') then
    raise exception 'PERMISSION_DENIED: upload not allowed in this space' using errcode = 'PT403';
  end if;

  v_quota := public.check_storage_quota_with_notify(v_org_id, p_file_size, auth.uid());

  select role::text into v_user_role from public.profiles where id = auth.uid();

  v_file_id := gen_random_uuid();
  v_storage_path := v_org_id::text || '/' || coalesce(p_space_id::text, 'global') || '/' || v_file_id::text || '/' || p_filename;

  insert into public.files (
    id, organization_id, space_id, name, display_name,
    mime_type, file_size, checksum, storage_path, status, uploaded_by, owner_role
  ) values (
    v_file_id, v_org_id, p_space_id, p_filename, p_filename,
    p_content_type, p_file_size, p_checksum, v_storage_path, 'pending', auth.uid(), v_user_role
  );

  return jsonb_build_object(
    'file_id', v_file_id,
    'storage_path', v_storage_path,
    'quota', v_quota
  );
end;
$$;

-- Group 6: Permissions and org team policies.
create table if not exists public.space_member_permissions (
  id uuid primary key default gen_random_uuid(),
  space_id uuid references public.spaces(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  permission_key text not null,
  is_enabled boolean default true,
  set_by uuid references public.profiles(id),
  set_at timestamptz default now(),
  unique (space_id, user_id, permission_key)
);

create table if not exists public.org_team_policies (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  max_spaces_per_member integer default null,
  messaging_enabled boolean default true,
  meetings_enabled boolean default true,
  file_uploads_enabled boolean default true,
  max_file_size_mb integer default 100,
  custom_roles_enabled boolean default false,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz default now()
);

create table if not exists public.custom_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  base_permissions jsonb not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create unique index if not exists custom_roles_org_lower_name_key
on public.custom_roles (organization_id, lower(name));

create table if not exists public.org_bans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  email text,
  reason text,
  banned_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  unique (organization_id, user_id),
  unique (organization_id, email)
);

create table if not exists public.space_bans (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  email text,
  reason text,
  banned_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  unique (space_id, user_id),
  unique (space_id, email)
);

alter table public.profiles
  add column if not exists custom_role_id uuid references public.custom_roles(id);

alter table public.space_member_permissions enable row level security;
alter table public.org_team_policies enable row level security;
alter table public.custom_roles enable row level security;
alter table public.org_bans enable row level security;
alter table public.space_bans enable row level security;

drop policy if exists space_member_permissions_select on public.space_member_permissions;
create policy space_member_permissions_select on public.space_member_permissions
for select to authenticated using (public.rls_in_space(space_id));

drop policy if exists org_team_policies_select on public.org_team_policies;
create policy org_team_policies_select on public.org_team_policies
for select to authenticated using (organization_id = public.get_my_org_id_secure());

drop policy if exists custom_roles_select on public.custom_roles;
create policy custom_roles_select on public.custom_roles
for select to authenticated using (organization_id = public.get_my_org_id_secure());

drop policy if exists org_bans_admin_select on public.org_bans;
create policy org_bans_admin_select on public.org_bans
for select to authenticated using (organization_id = public.get_my_org_id_secure() and public.rls_is_admin());

drop policy if exists space_bans_admin_select on public.space_bans;
create policy space_bans_admin_select on public.space_bans
for select to authenticated using (public.rls_in_space(space_id) and public.has_space_role(space_id, array['owner','admin','staff']));

create or replace function public.resolve_space_permission(
  p_user_id uuid,
  p_space_id uuid,
  p_permission_key text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_role text;
  v_explicit boolean;
  v_policy public.org_team_policies;
begin
  select s.organization_id into v_org_id from public.spaces s where s.id = p_space_id;
  if v_org_id is null then
    return false;
  end if;

  select sm.role::text
  into v_role
  from public.space_memberships sm
  where sm.space_id = p_space_id
    and sm.profile_id = p_user_id
    and coalesce(sm.is_active, true) = true
  limit 1;

  if v_role is null then
    select p.role::text into v_role
    from public.profiles p
    where p.id = p_user_id and p.organization_id = v_org_id;
  end if;

  if v_role in ('owner', 'admin', 'staff') then
    return true;
  end if;

  select is_enabled into v_explicit
  from public.space_member_permissions
  where user_id = p_user_id
    and space_id = p_space_id
    and permission_key = p_permission_key;

  if v_explicit is not null then
    return v_explicit;
  end if;

  select * into v_policy
  from public.org_team_policies
  where organization_id = v_org_id;

  if p_permission_key = 'Chat messaging' then
    return coalesce(v_policy.messaging_enabled, true);
  elsif p_permission_key = 'File uploads' then
    return coalesce(v_policy.file_uploads_enabled, true);
  elsif p_permission_key = 'File viewing' then
    return true;
  elsif p_permission_key = 'Meeting creation' then
    return coalesce(v_policy.meetings_enabled, true);
  elsif p_permission_key = 'Meeting recording viewing' then
    return coalesce(v_policy.meetings_enabled, true);
  elsif p_permission_key = 'Task creation' then
    return true;
  elsif p_permission_key = 'Task viewing' then
    return true;
  end if;

  return true;
end;
$$;

create or replace function public.trg_notify_permission_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_space_name text;
begin
  select organization_id, name into v_org_id, v_space_name
  from public.spaces
  where id = NEW.space_id;

  perform public.notify_user(
    v_org_id, NEW.space_id, NEW.user_id, 'permission_changed', 'Permission changed',
    'Your ' || NEW.permission_key || ' permission in ' || v_space_name || ' was ' || case when NEW.is_enabled then 'enabled' else 'disabled' end,
    jsonb_build_object('space_id', NEW.space_id, 'permission_key', NEW.permission_key, 'is_enabled', NEW.is_enabled)
  );

  return NEW;
end;
$$;

drop trigger if exists trg_notify_permission_changed on public.space_member_permissions;
create trigger trg_notify_permission_changed
after insert or update of is_enabled on public.space_member_permissions
for each row execute function public.trg_notify_permission_changed();

create or replace function public.get_effective_space_permissions(p_user_id uuid, p_space_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_keys text[] := array[
    'Chat messaging',
    'File uploads',
    'File viewing',
    'Meeting creation',
    'Meeting recording viewing',
    'Task creation',
    'Task viewing'
  ];
  v_key text;
  v_result jsonb := '{}'::jsonb;
begin
  foreach v_key in array v_keys loop
    v_result := v_result || jsonb_build_object(v_key, public.resolve_space_permission(p_user_id, p_space_id, v_key));
  end loop;
  return v_result;
end;
$$;

create or replace function public.set_space_member_permission(
  p_space_id uuid,
  p_user_id uuid,
  p_key text,
  p_enabled boolean
)
returns public.space_member_permissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_permission public.space_member_permissions;
begin
  if not public.has_space_role(auth.uid(), p_space_id, array['owner','admin','manager']::public.member_role[]) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'PT403';
  end if;

  insert into public.space_member_permissions (space_id, user_id, permission_key, is_enabled, set_by, set_at)
  values (p_space_id, p_user_id, p_key, p_enabled, auth.uid(), now())
  on conflict (space_id, user_id, permission_key)
  do update set is_enabled = excluded.is_enabled, set_by = excluded.set_by, set_at = now()
  returning * into v_permission;

  return v_permission;
end;
$$;

create or replace function public.bulk_set_space_permissions(
  p_space_id uuid,
  p_user_id uuid,
  p_permissions jsonb
)
returns setof public.space_member_permissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pair record;
  v_permission public.space_member_permissions;
begin
  if not public.has_space_role(auth.uid(), p_space_id, array['owner','admin','manager']::public.member_role[]) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'PT403';
  end if;

  for v_pair in select * from jsonb_each_text(p_permissions) loop
    v_permission := public.set_space_member_permission(p_space_id, p_user_id, v_pair.key, v_pair.value::boolean);
    return next v_permission;
  end loop;
end;
$$;

create or replace function public.get_space_permissions_matrix(p_space_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_space_role(auth.uid(), p_space_id, array['owner','admin','manager']::public.member_role[]) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'PT403';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'user_id', sm.profile_id,
        'full_name', p.full_name,
        'email', p.email,
        'role', sm.role::text,
        'permissions', public.get_effective_space_permissions(sm.profile_id, p_space_id),
        'locked_by_policy', false
      )
      order by p.full_name
    )
    from public.space_memberships sm
    join public.profiles p on p.id = sm.profile_id
    where sm.space_id = p_space_id
      and coalesce(sm.is_active, true) = true
      and sm.role::text not in ('owner', 'admin', 'staff')
  ), '[]'::jsonb);
end;
$$;

create or replace function public.update_org_team_policies(p_updates jsonb)
returns public.org_team_policies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid := public.get_my_org_id_secure();
  v_policy public.org_team_policies;
begin
  if not public.rls_is_admin() then
    raise exception 'NOT_AUTHORIZED' using errcode = 'PT403';
  end if;

  insert into public.org_team_policies (
    organization_id, max_spaces_per_member, messaging_enabled, meetings_enabled,
    file_uploads_enabled, max_file_size_mb, custom_roles_enabled, updated_by, updated_at
  ) values (
    v_org_id,
    nullif(p_updates->>'max_spaces_per_member', '')::integer,
    coalesce((p_updates->>'messaging_enabled')::boolean, true),
    coalesce((p_updates->>'meetings_enabled')::boolean, true),
    coalesce((p_updates->>'file_uploads_enabled')::boolean, true),
    coalesce(nullif(p_updates->>'max_file_size_mb', '')::integer, 100),
    coalesce((p_updates->>'custom_roles_enabled')::boolean, false),
    auth.uid(),
    now()
  )
  on conflict (organization_id) do update set
    max_spaces_per_member = coalesce(nullif(p_updates->>'max_spaces_per_member', '')::integer, org_team_policies.max_spaces_per_member),
    messaging_enabled = coalesce((p_updates->>'messaging_enabled')::boolean, org_team_policies.messaging_enabled),
    meetings_enabled = coalesce((p_updates->>'meetings_enabled')::boolean, org_team_policies.meetings_enabled),
    file_uploads_enabled = coalesce((p_updates->>'file_uploads_enabled')::boolean, org_team_policies.file_uploads_enabled),
    max_file_size_mb = coalesce(nullif(p_updates->>'max_file_size_mb', '')::integer, org_team_policies.max_file_size_mb),
    custom_roles_enabled = coalesce((p_updates->>'custom_roles_enabled')::boolean, org_team_policies.custom_roles_enabled),
    updated_by = auth.uid(),
    updated_at = now()
  returning * into v_policy;

  return v_policy;
end;
$$;

create or replace function public.get_org_team_policies()
returns public.org_team_policies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid := public.get_my_org_id_secure();
  v_policy public.org_team_policies;
begin
  insert into public.org_team_policies (organization_id)
  values (v_org_id)
  on conflict (organization_id) do nothing;

  select * into v_policy
  from public.org_team_policies
  where organization_id = v_org_id;

  return v_policy;
end;
$$;

create or replace function public.create_custom_role(p_name text, p_base_permissions jsonb)
returns public.custom_roles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid := public.get_my_org_id_secure();
  v_enabled boolean;
  v_role public.custom_roles;
begin
  if not public.rls_is_admin() then
    raise exception 'NOT_AUTHORIZED' using errcode = 'PT403';
  end if;

  select custom_roles_enabled into v_enabled
  from public.org_team_policies
  where organization_id = v_org_id;

  if not coalesce(v_enabled, false) then
    raise exception 'CUSTOM_ROLES_DISABLED' using errcode = 'PT403';
  end if;

  insert into public.custom_roles (organization_id, name, base_permissions, created_by)
  values (v_org_id, p_name, p_base_permissions, auth.uid())
  returning * into v_role;

  return v_role;
end;
$$;

create or replace function public.refresh_effective_permissions()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  return;
end;
$$;

create or replace function public.assign_custom_role(p_user_id uuid, p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.rls_is_admin() then
    raise exception 'NOT_AUTHORIZED' using errcode = 'PT403';
  end if;

  update public.profiles
  set custom_role_id = p_role_id,
      updated_at = now()
  where id = p_user_id
    and organization_id = public.get_my_org_id_secure();

  perform public.refresh_effective_permissions();
end;
$$;

create or replace function public.get_team_member_workload(p_user_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org_id uuid := public.get_my_org_id_secure();
begin
  return jsonb_build_object(
    'spaces', (
      select count(*)
      from public.space_memberships sm
      join public.spaces s on s.id = sm.space_id
      where s.organization_id = v_org_id
        and coalesce(sm.is_active, true) = true
        and (p_user_id is null or sm.profile_id = p_user_id)
    ),
    'active_tasks', (
      select count(*)
      from public.tasks t
      where t.organization_id = v_org_id
        and t.status <> 'done'
        and (p_user_id is null or t.assignee_id = p_user_id)
    ),
    'meetings', (
      select count(*)
      from public.meetings m
      where m.organization_id = v_org_id
        and m.starts_at >= now()
        and (p_user_id is null or m.created_by = p_user_id)
    )
  );
end;
$$;

-- Group 7: Slack-style messaging.
create table if not exists public.space_channels (
  id uuid primary key default gen_random_uuid(),
  space_id uuid references public.spaces(id) on delete cascade,
  name text not null,
  description text,
  is_private boolean default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create unique index if not exists space_channels_space_lower_name_key
on public.space_channels (space_id, lower(name));

alter table public.messages
  add column if not exists thread_root_id uuid references public.messages(id),
  add column if not exists reply_count integer default 0,
  add column if not exists channel_id uuid references public.space_channels(id),
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;

alter table public.messages
  drop constraint if exists messages_channel_check;

create table if not exists public.message_reactions (
  message_id uuid references public.messages(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz default now(),
  primary key (message_id, user_id, emoji)
);

create table if not exists public.pinned_messages (
  id uuid primary key default gen_random_uuid(),
  space_id uuid references public.spaces(id),
  channel_id uuid references public.space_channels(id),
  message_id uuid references public.messages(id),
  pinned_by uuid references public.profiles(id),
  pinned_at timestamptz default now(),
  unique (channel_id, message_id)
);

create table if not exists public.message_reads (
  message_id uuid references public.messages(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  read_at timestamptz default now(),
  primary key (message_id, user_id)
);

create table if not exists public.message_drafts (
  user_id uuid references public.profiles(id),
  channel_id uuid references public.space_channels(id),
  content text,
  updated_at timestamptz default now(),
  primary key (user_id, channel_id)
);

create table if not exists public.direct_message_threads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  participant_ids uuid[] not null,
  created_at timestamptz default now()
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.direct_message_threads(id) on delete cascade,
  sender_id uuid references public.profiles(id),
  content text not null,
  created_at timestamptz default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create table if not exists public.message_bookmarks (
  message_id uuid references public.messages(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (message_id, user_id)
);

alter table public.space_channels enable row level security;
alter table public.message_reactions enable row level security;
alter table public.pinned_messages enable row level security;
alter table public.message_reads enable row level security;
alter table public.message_drafts enable row level security;
alter table public.direct_message_threads enable row level security;
alter table public.direct_messages enable row level security;
alter table public.message_bookmarks enable row level security;

drop policy if exists internal_channel_staff_only on public.messages;
create policy internal_channel_staff_only
on public.messages
as restrictive
for select
to authenticated
using (
  channel != 'internal'
  or public.rls_is_staff_or_above()
);

drop policy if exists space_channels_select on public.space_channels;
create policy space_channels_select on public.space_channels
for select to authenticated using (public.rls_in_space(space_id));

drop policy if exists message_reactions_select on public.message_reactions;
create policy message_reactions_select on public.message_reactions
for select to authenticated using (
  exists (select 1 from public.messages m where m.id = message_reactions.message_id and public.rls_in_space(m.space_id))
);

drop policy if exists pinned_messages_select on public.pinned_messages;
create policy pinned_messages_select on public.pinned_messages
for select to authenticated using (public.rls_in_space(space_id));

drop policy if exists message_reads_own on public.message_reads;
create policy message_reads_own on public.message_reads
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists message_drafts_own on public.message_drafts;
create policy message_drafts_own on public.message_drafts
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_messages_channel_created on public.messages(channel_id, created_at desc);
create index if not exists idx_messages_thread_created on public.messages(thread_root_id, created_at);

create or replace function public.create_space_channel(p_space_id uuid, p_name text, p_description text default null)
returns public.space_channels
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel public.space_channels;
begin
  if not public.has_space_role(auth.uid(), p_space_id, array['owner','admin','manager']::public.member_role[]) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'PT403';
  end if;

  insert into public.space_channels (space_id, name, description, created_by)
  values (p_space_id, p_name, p_description, auth.uid())
  on conflict (space_id, (lower(name))) do update set description = excluded.description
  returning * into v_channel;

  return v_channel;
end;
$$;

create or replace function public.get_channel_messages(p_channel_id uuid, p_limit integer default 50, p_before timestamptz default null)
returns table (
  id uuid,
  space_id uuid,
  organization_id uuid,
  sender_id uuid,
  sender_type text,
  sender_name text,
  sender_avatar text,
  content text,
  channel text,
  channel_id uuid,
  thread_root_id uuid,
  reply_count integer,
  extension text,
  payload jsonb,
  created_at timestamptz,
  edited_at timestamptz,
  deleted_at timestamptz,
  reactions jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
begin
  select space_id into v_space_id from public.space_channels where id = p_channel_id;
  if not public.rls_in_space(v_space_id) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'PT403';
  end if;

  return query
  select
    m.id, m.space_id, m.organization_id, m.sender_id, m.sender_type,
    p.full_name, p.avatar_url, m.content, m.channel, m.channel_id,
    m.thread_root_id, m.reply_count, m.extension, m.payload,
    m.created_at, m.edited_at, m.deleted_at,
    coalesce((
      select jsonb_agg(jsonb_build_object('emoji', r.emoji, 'count', r.count, 'users', r.users))
      from (
        select mr.emoji, count(*) as count, jsonb_agg(jsonb_build_object('user_id', mr.user_id, 'name', rp.full_name)) as users
        from public.message_reactions mr
        left join public.profiles rp on rp.id = mr.user_id
        where mr.message_id = m.id
        group by mr.emoji
      ) r
    ), '[]'::jsonb)
  from public.messages m
  left join public.profiles p on p.id = m.sender_id
  where m.channel_id = p_channel_id
    and m.thread_root_id is null
    and (p_before is null or m.created_at < p_before)
    and m.deleted_at is null
  order by m.created_at desc
  limit coalesce(p_limit, 50);
end;
$$;

create or replace function public.reply_to_message(p_root_message_id uuid, p_content text)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_root public.messages;
  v_reply public.messages;
  v_sender_type text;
begin
  select * into v_root from public.messages where id = p_root_message_id;
  if not found or not public.rls_in_space(v_root.space_id) then
    raise exception 'MESSAGE_NOT_FOUND' using errcode = 'PT404';
  end if;

  select case when role::text in ('owner','admin','staff') then 'staff' else 'client' end
  into v_sender_type
  from public.profiles
  where id = auth.uid();

  insert into public.messages (
    organization_id, space_id, sender_id, sender_type, content,
    channel, channel_id, thread_root_id, extension, payload
  ) values (
    v_root.organization_id, v_root.space_id, auth.uid(), coalesce(v_sender_type, 'client'), p_content,
    v_root.channel, v_root.channel_id, p_root_message_id, 'chat', '{}'::jsonb
  )
  returning * into v_reply;

  update public.messages
  set reply_count = coalesce(reply_count, 0) + 1
  where id = p_root_message_id;

  return v_reply;
end;
$$;

create or replace function public.get_thread_replies(p_root_message_id uuid)
returns setof public.messages
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
begin
  select space_id into v_space_id from public.messages where id = p_root_message_id;
  if not public.rls_in_space(v_space_id) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'PT403';
  end if;

  return query
  select *
  from public.messages
  where thread_root_id = p_root_message_id
    and deleted_at is null
  order by created_at;
end;
$$;

create or replace function public.toggle_reaction(p_message_id uuid, p_emoji text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
  v_exists boolean;
begin
  select space_id into v_space_id from public.messages where id = p_message_id;
  if not public.rls_in_space(v_space_id) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'PT403';
  end if;

  delete from public.message_reactions
  where message_id = p_message_id
    and user_id = auth.uid()
    and emoji = p_emoji
  returning true into v_exists;

  if not coalesce(v_exists, false) then
    insert into public.message_reactions (message_id, user_id, emoji)
    values (p_message_id, auth.uid(), p_emoji);
  end if;

  return jsonb_build_object('active', not coalesce(v_exists, false));
end;
$$;

create or replace function public.pin_message(p_message_id uuid, p_channel_id uuid)
returns public.pinned_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
  v_pin public.pinned_messages;
begin
  select space_id into v_space_id from public.space_channels where id = p_channel_id;
  if not public.has_space_role(auth.uid(), v_space_id, array['owner','admin','manager']::public.member_role[]) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'PT403';
  end if;

  insert into public.pinned_messages (space_id, channel_id, message_id, pinned_by)
  values (v_space_id, p_channel_id, p_message_id, auth.uid())
  on conflict (channel_id, message_id) do update set pinned_at = now(), pinned_by = auth.uid()
  returning * into v_pin;

  return v_pin;
end;
$$;

create or replace function public.get_pinned_messages(p_channel_id uuid)
returns setof public.pinned_messages
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
begin
  select space_id into v_space_id from public.space_channels where id = p_channel_id;
  if not public.rls_in_space(v_space_id) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'PT403';
  end if;

  return query
  select *
  from public.pinned_messages
  where channel_id = p_channel_id
  order by pinned_at desc;
end;
$$;

create or replace function public.mark_messages_read(p_channel_id uuid, p_up_to_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_up_to timestamptz;
  v_space_id uuid;
begin
  select space_id into v_space_id from public.space_channels where id = p_channel_id;
  if not public.rls_in_space(v_space_id) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'PT403';
  end if;

  select created_at into v_up_to from public.messages where id = p_up_to_message_id;

  insert into public.message_reads (message_id, user_id, read_at)
  select id, auth.uid(), now()
  from public.messages
  where channel_id = p_channel_id
    and created_at <= coalesce(v_up_to, now())
  on conflict (message_id, user_id) do update set read_at = excluded.read_at;
end;
$$;

create or replace function public.get_unread_counts(p_space_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.rls_in_space(p_space_id) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'PT403';
  end if;

  return coalesce((
    select jsonb_object_agg(sc.id, counts.unread_count)
    from public.space_channels sc
    left join lateral (
      select count(*) as unread_count
      from public.messages m
      where m.channel_id = sc.id
        and m.sender_id <> auth.uid()
        and not exists (
          select 1 from public.message_reads mr
          where mr.message_id = m.id and mr.user_id = auth.uid()
        )
    ) counts on true
    where sc.space_id = p_space_id
  ), '{}'::jsonb);
end;
$$;

create or replace function public.save_draft(p_channel_id uuid, p_content text)
returns public.message_drafts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft public.message_drafts;
begin
  insert into public.message_drafts (user_id, channel_id, content, updated_at)
  values (auth.uid(), p_channel_id, p_content, now())
  on conflict (user_id, channel_id) do update set content = excluded.content, updated_at = now()
  returning * into v_draft;

  return v_draft;
end;
$$;

create or replace function public.get_draft(p_channel_id uuid)
returns public.message_drafts
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_draft public.message_drafts;
begin
  select * into v_draft
  from public.message_drafts
  where user_id = auth.uid()
    and channel_id = p_channel_id;

  return v_draft;
end;
$$;

create or replace function public.search_messages(p_query text, p_space_id uuid default null)
returns setof public.messages
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select *
  from public.messages m
  where (p_space_id is null or m.space_id = p_space_id)
    and public.rls_in_space(m.space_id)
    and m.deleted_at is null
    and m.content ilike '%' || p_query || '%'
  order by m.created_at desc
  limit 100;
end;
$$;

create or replace function public.create_dm_thread(p_recipient_id uuid)
returns public.direct_message_threads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid := public.get_my_org_id_secure();
  v_participants uuid[] := array(select unnest(array[auth.uid(), p_recipient_id]::uuid[]) order by 1);
  v_thread public.direct_message_threads;
begin
  if p_recipient_id = auth.uid() then
    raise exception 'INVALID_RECIPIENT' using errcode = 'PT400';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = p_recipient_id and p.organization_id = v_org_id
  ) then
    raise exception 'RECIPIENT_NOT_FOUND' using errcode = 'PT404';
  end if;

  select * into v_thread
  from public.direct_message_threads
  where organization_id = v_org_id
    and participant_ids = v_participants
  limit 1;

  if found then
    return v_thread;
  end if;

  insert into public.direct_message_threads (organization_id, participant_ids)
  values (v_org_id, v_participants)
  returning * into v_thread;

  return v_thread;
end;
$$;

create or replace function public.send_dm(p_thread_id uuid, p_content text)
returns public.direct_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread public.direct_message_threads;
  v_message public.direct_messages;
  v_recipient uuid;
begin
  select * into v_thread
  from public.direct_message_threads
  where id = p_thread_id
    and organization_id = public.get_my_org_id_secure()
    and auth.uid() = any(participant_ids);

  if not found then
    raise exception 'THREAD_NOT_FOUND' using errcode = 'PT404';
  end if;

  insert into public.direct_messages (thread_id, sender_id, content)
  values (p_thread_id, auth.uid(), p_content)
  returning * into v_message;

  select participant_id into v_recipient
  from unnest(v_thread.participant_ids) as participants(participant_id)
  where participant_id <> auth.uid()
  limit 1;

  perform public.notify_user(
    v_thread.organization_id, null, v_recipient, 'direct_message', 'New direct message',
    p_content,
    jsonb_build_object('thread_id', p_thread_id, 'message_id', v_message.id)
  );

  return v_message;
end;
$$;

create or replace function public.get_dm_threads()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', dmt.id,
        'participant_ids', dmt.participant_ids,
        'created_at', dmt.created_at,
        'last_message', (
          select to_jsonb(dm)
          from public.direct_messages dm
          where dm.thread_id = dmt.id
          order by dm.created_at desc
          limit 1
        )
      )
      order by dmt.created_at desc
    )
    from public.direct_message_threads dmt
    where dmt.organization_id = public.get_my_org_id_secure()
      and auth.uid() = any(dmt.participant_ids)
  ), '[]'::jsonb);
end;
$$;

create or replace function public.send_message(
  p_space_id uuid,
  p_content text,
  p_channel text default 'general',
  p_extension text default 'chat',
  p_payload jsonb default '{}'::jsonb,
  p_idempotency_key text default null
)
returns public.domain_result
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_message public.messages;
  v_sender_type text;
  v_result public.domain_result;
  v_channel_id uuid;
  v_mention text;
  v_mentioned_id uuid;
begin
  v_org_id := public.get_my_org_id_secure();

  if not public.rls_in_space(p_space_id) then
    v_result := row(false, 'NOT_AUTHORIZED', null::jsonb);
    return v_result;
  end if;

  if not public.resolve_space_permission(v_user_id, p_space_id, 'Chat messaging') then
    v_result := row(false, 'PERMISSION_DENIED', null::jsonb);
    return v_result;
  end if;

  select case when role::text in ('owner','admin','staff') then 'staff' else 'client' end
  into v_sender_type
  from public.profiles
  where id = v_user_id;

  select id into v_channel_id
  from public.space_channels
  where space_id = p_space_id
    and lower(name) = lower(case when p_channel = 'internal' then 'internal' else 'general' end)
  limit 1;

  if v_channel_id is null then
    insert into public.space_channels (space_id, name, description, is_private, created_by)
    values (
      p_space_id,
      case when p_channel = 'internal' then 'internal' else 'general' end,
      case when p_channel = 'internal' then 'Internal staff notes' else 'General discussion' end,
      p_channel = 'internal',
      v_user_id
    )
    on conflict (space_id, (lower(name))) do update set description = excluded.description
    returning id into v_channel_id;
  end if;

  insert into public.messages (
    organization_id, space_id, sender_id, sender_type, content,
    channel, channel_id, extension, payload, created_at
  ) values (
    v_org_id, p_space_id, v_user_id, coalesce(v_sender_type, 'client'), p_content,
    p_channel, v_channel_id, p_extension, coalesce(p_payload, '{}'::jsonb), now()
  )
  returning * into v_message;

  for v_mention in
    select distinct lower(replace(matches.match[1], '@', ''))
    from regexp_matches(p_content, '(@[A-Za-z0-9._-]+)', 'g') as matches(match)
  loop
    select p.id into v_mentioned_id
    from public.profiles p
    where p.organization_id = v_org_id
      and (
        lower(split_part(p.email, '@', 1)) = v_mention
        or lower(replace(coalesce(p.full_name, ''), ' ', '.')) = v_mention
      )
    limit 1;

    if v_mentioned_id is not null then
      perform public.notify_user(
        v_org_id, p_space_id, v_mentioned_id, 'mention', 'You were mentioned',
        p_content,
        jsonb_build_object('message_id', v_message.id, 'space_id', p_space_id)
      );
    end if;
  end loop;

  v_result := row(true, null::text, to_jsonb(v_message));
  return v_result;
end;
$$;

create or replace function public.get_space_messages(
  p_space_id uuid,
  p_limit integer default 50,
  p_before_created_at timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.rls_in_space(p_space_id) then
    return jsonb_build_object('success', false, 'error_code', 'NOT_AUTHORIZED');
  end if;

  return jsonb_build_object(
    'success', true,
    'data', coalesce((
      select jsonb_agg(to_jsonb(msg) order by msg.created_at)
      from (
        select
          m.id,
          m.space_id,
          m.organization_id,
          m.sender_id,
          m.sender_type,
          p.full_name as sender_name,
          p.avatar_url as sender_avatar,
          m.content,
          m.channel,
          m.channel_id,
          m.thread_root_id,
          m.reply_count,
          m.extension,
          m.payload,
          m.created_at,
          m.edited_at,
          m.deleted_at
        from public.messages m
        left join public.profiles p on p.id = m.sender_id
        where m.space_id = p_space_id
          and m.thread_root_id is null
          and m.deleted_at is null
          and (p_before_created_at is null or m.created_at < p_before_created_at)
        order by m.created_at desc
        limit coalesce(p_limit, 50)
      ) msg
    ), '[]'::jsonb)
  );
end;
$$;

do $cron$
begin
  if to_regnamespace('cron') is not null and to_regprocedure('cron.schedule(text,text,text)') is not null then
    begin
      execute $sql$select cron.unschedule('space_invitation_expiry_notifications')$sql$;
    exception when others then
      null;
    end;
    begin
      execute $sql$select cron.unschedule('space_meeting_starting_soon_notifications')$sql$;
    exception when others then
      null;
    end;
    begin
      execute $sql$select cron.unschedule('space_overdue_task_notifications')$sql$;
    exception when others then
      null;
    end;

    execute $sql$select cron.schedule('space_invitation_expiry_notifications', '*/15 * * * *', 'select public.trg_notify_invitation_expired();')$sql$;
    execute $sql$select cron.schedule('space_meeting_starting_soon_notifications', '*/5 * * * *', 'select public.notify_meetings_starting_soon();')$sql$;
    execute $sql$select cron.schedule('space_overdue_task_notifications', '0 * * * *', 'select public.notify_overdue_tasks();')$sql$;
  end if;
exception when insufficient_privilege or undefined_schema or undefined_function then
  null;
end $cron$;
