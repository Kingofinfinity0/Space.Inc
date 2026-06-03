-- Client portfolio logic
-- Defines the client work model, health calculation, portfolio listing, and
-- safe relationship actions used by the Clients page.

create table if not exists public.client_account_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  lead_consultant_id uuid references public.profiles(id) on delete set null,
  work_model text not null default 'project'
    check (work_model in ('retainer', 'project', 'paused', 'offboarded')),
  monthly_value numeric(12, 2) not null default 0,
  contract_started_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (space_id)
);

create index if not exists idx_client_account_profiles_org
on public.client_account_profiles (organization_id, work_model);

drop trigger if exists update_client_account_profiles_timestamp on public.client_account_profiles;

create trigger update_client_account_profiles_timestamp
before update on public.client_account_profiles
for each row execute function public.trigger_update_timestamp();

alter table public.client_account_profiles enable row level security;

drop policy if exists client_account_profiles_select_staff on public.client_account_profiles;
create policy client_account_profiles_select_staff
on public.client_account_profiles
for select
to authenticated
using (
  organization_id = public.get_my_org_id_secure()
  and public.rls_is_staff_or_above()
);

drop policy if exists client_account_profiles_write_staff on public.client_account_profiles;
create policy client_account_profiles_write_staff
on public.client_account_profiles
for all
to authenticated
using (
  organization_id = public.get_my_org_id_secure()
  and public.rls_is_staff_or_above()
)
with check (
  organization_id = public.get_my_org_id_secure()
  and public.rls_is_staff_or_above()
);

create or replace function public.client_portfolio_authorized(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.org_memberships om
    where om.organization_id = p_organization_id
      and om.user_id = auth.uid()
      and coalesce(om.status, 'active') = 'active'
      and coalesce(om.role, om.base_role) in ('owner', 'admin', 'staff')
  ) or exists (
    select 1
    from public.profiles p
    where p.organization_id = p_organization_id
      and p.id = auth.uid()
      and coalesce(p.is_active, true) = true
      and p.role::text in ('owner', 'admin', 'staff')
  );
$$;

create or replace function public.calculate_client_health(p_space_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_created_at timestamptz;
  v_last_activity timestamptz;
  v_days_since_activity numeric;
  v_message_count integer := 0;
  v_recent_message_count integer := 0;
  v_file_count integer := 0;
  v_task_count integer := 0;
  v_completed_task_count integer := 0;
  v_open_task_count integer := 0;
  v_overdue_task_count integer := 0;
  v_login_score integer := 10;
  v_task_score integer := 70;
  v_response_score integer := 10;
  v_file_score integer := 10;
  v_issue_pressure integer := 0;
  v_score integer := 0;
  v_label text := 'unknown';
begin
  select s.organization_id, s.created_at
  into v_org_id, v_created_at
  from public.spaces s
  where s.id = p_space_id
    and s.deleted_at is null;

  if v_org_id is null then
    return jsonb_build_object(
      'score', null,
      'label', 'unknown',
      'factors', '[]'::jsonb
    );
  end if;

  if not public.client_portfolio_authorized(v_org_id) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  select count(*), count(*) filter (where created_at >= now() - interval '30 days')
  into v_message_count, v_recent_message_count
  from public.messages
  where space_id = p_space_id
    and deleted_at is null;

  select count(*)
  into v_file_count
  from public.files
  where space_id = p_space_id
    and deleted_at is null;

  select
    count(*),
    count(*) filter (
      where completed_at is not null
        or lower(coalesce(status, '')) in ('done', 'complete', 'completed')
    ),
    count(*) filter (
      where completed_at is null
        and lower(coalesce(status, '')) not in ('done', 'complete', 'completed', 'canceled', 'cancelled')
    ),
    count(*) filter (
      where completed_at is null
        and lower(coalesce(status, '')) not in ('done', 'complete', 'completed', 'canceled', 'cancelled')
        and due_date is not null
        and due_date < current_date
    )
  into v_task_count, v_completed_task_count, v_open_task_count, v_overdue_task_count
  from public.tasks
  where space_id = p_space_id
    and deleted_at is null;

  select max(activity_at)
  into v_last_activity
  from (
    select max(created_at) as activity_at
    from public.messages
    where space_id = p_space_id
      and deleted_at is null

    union all

    select max(created_at) as activity_at
    from public.files
    where space_id = p_space_id
      and deleted_at is null

    union all

    select max(created_at) as activity_at
    from public.meetings
    where space_id = p_space_id
      and deleted_at is null

    union all

    select max(created_at) as activity_at
    from public.tasks
    where space_id = p_space_id
      and deleted_at is null

    union all

    select max(joined_at) as activity_at
    from public.space_members
    where space_id = p_space_id

    union all

    select max(joined_at) as activity_at
    from public.space_memberships
    where space_id = p_space_id
      and coalesce(is_active, true) = true
  ) activity;

  v_days_since_activity :=
    extract(epoch from (now() - coalesce(v_last_activity, v_created_at, now()))) / 86400.0;

  v_login_score := case
    when v_days_since_activity <= 7 then 100
    when v_days_since_activity <= 14 then 80
    when v_days_since_activity <= 30 then 60
    when v_days_since_activity <= 60 then 35
    else 10
  end;

  if v_task_count > 0 then
    v_task_score := round((v_completed_task_count::numeric / v_task_count::numeric) * 100)::integer;
  end if;

  v_response_score := case
    when v_recent_message_count >= 10 then 100
    when v_recent_message_count >= 5 then 75
    when v_recent_message_count >= 1 then 50
    else 10
  end;

  v_file_score := case
    when v_file_count >= 5 then 100
    when v_file_count >= 3 then 75
    when v_file_count >= 1 then 45
    else 10
  end;

  v_issue_pressure :=
    least(100, (v_overdue_task_count * 25) + (greatest(v_open_task_count - v_overdue_task_count, 0) * 10));

  v_score := greatest(0, least(100, round(
      (v_login_score * 0.30)
    + (v_task_score * 0.25)
    + (v_response_score * 0.20)
    + (v_file_score * 0.15)
    + ((100 - v_issue_pressure) * 0.10)
  )::integer));

  v_label := case
    when v_score >= 80 then 'healthy'
    when v_score >= 60 then 'warning'
    when v_score >= 40 then 'at-risk'
    else 'critical'
  end;

  return jsonb_build_object(
    'score', v_score,
    'label', v_label,
    'last_activity_at', v_last_activity,
    'factors', jsonb_build_array(
      jsonb_build_object('key', 'login_activity', 'label', 'Login Activity', 'weight', 30, 'value', v_login_score),
      jsonb_build_object('key', 'task_completion', 'label', 'Task Completion', 'weight', 25, 'value', v_task_score),
      jsonb_build_object('key', 'response_engagement', 'label', 'Response Engagement', 'weight', 20, 'value', v_response_score),
      jsonb_build_object('key', 'space_file_activity', 'label', 'Space File Activity', 'weight', 15, 'value', v_file_score),
      jsonb_build_object('key', 'issues_outstanding', 'label', 'Issues Outstanding', 'weight', -10, 'value', v_issue_pressure)
    )
  );
end;
$$;

create or replace function public.get_client_portfolio(p_organization_id uuid default null)
returns table (
  id uuid,
  organization_id uuid,
  org_id uuid,
  client_id text,
  full_name text,
  avatar_url text,
  lifecycle_stage text,
  onboarding_score integer,
  health_score integer,
  health_label text,
  last_activity_at timestamptz,
  message_count integer,
  file_count integer,
  meeting_count integer,
  is_active boolean,
  created_at timestamptz,
  joined_at timestamptz,
  company_name text,
  contact_email text,
  lead_consultant_name text,
  lead_consultant_email text,
  model_type text,
  active_spaces integer,
  commitment_rate numeric,
  monthly_retainer numeric,
  health_factors jsonb,
  audit_events jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  v_org_id := coalesce(p_organization_id, public.get_my_org_id_secure());

  if v_org_id is null or not public.client_portfolio_authorized(v_org_id) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  return query
  with spaces_base as (
    select
      s.*,
      cap.work_model,
      cap.monthly_value,
      cap.contract_started_at,
      coalesce(cap.lead_consultant_id, s.assigned_staff_id) as lead_id,
      public.calculate_client_health(s.id) as health
    from public.spaces s
    left join public.client_account_profiles cap on cap.space_id = s.id
    where s.organization_id = v_org_id
      and s.deleted_at is null
  ),
  counted as (
    select
      sb.*,
      (
        select count(*)::integer
        from public.messages m
        where m.space_id = sb.id
          and m.deleted_at is null
      ) as calc_message_count,
      (
        select count(*)::integer
        from public.files f
        where f.space_id = sb.id
          and f.deleted_at is null
      ) as calc_file_count,
      (
        select count(*)::integer
        from public.meetings mt
        where mt.space_id = sb.id
          and mt.deleted_at is null
      ) as calc_meeting_count
    from spaces_base sb
  )
  select
    c.id,
    c.organization_id,
    c.organization_id as org_id,
    coalesce(c.contact_email, c.contact_name, c.id::text) as client_id,
    coalesce(c.company_name, c.name, c.contact_name, 'Unnamed client') as full_name,
    null::text as avatar_url,
    case
      when coalesce(c.work_model, lower(c.status::text)) = 'offboarded' or lower(c.status::text) = 'closed' then 'churned'
      when coalesce(c.work_model, lower(c.status::text)) = 'paused' or lower(c.status::text) = 'archived' then 'at_risk'
      when ((c.health->>'score')::integer) >= 80 then 'engaged'
      when ((c.health->>'score')::integer) < 50 then 'at_risk'
      when coalesce(c.onboarding_complete, false) then 'activated'
      else 'invited'
    end as lifecycle_stage,
    coalesce((c.health->>'score')::integer, 0) as onboarding_score,
    (c.health->>'score')::integer as health_score,
    c.health->>'label' as health_label,
    coalesce((c.health->>'last_activity_at')::timestamptz, c.created_at) as last_activity_at,
    c.calc_message_count as message_count,
    c.calc_file_count as file_count,
    c.calc_meeting_count as meeting_count,
    (
      lower(c.status::text) = 'active'
      and coalesce(c.work_model, 'project') not in ('paused', 'offboarded')
    ) as is_active,
    c.created_at,
    c.created_at as joined_at,
    coalesce(c.company_name, c.name) as company_name,
    c.contact_email,
    coalesce(lead.full_name, 'Unassigned') as lead_consultant_name,
    lead.email as lead_consultant_email,
    case
      when c.work_model is not null then c.work_model
      when lower(c.status::text) = 'closed' then 'offboarded'
      when lower(c.status::text) = 'archived' then 'paused'
      else 'project'
    end as model_type,
    1::integer as active_spaces,
    coalesce(c.monthly_value, 0)::numeric as commitment_rate,
    coalesce(c.monthly_value, 0)::numeric as monthly_retainer,
    coalesce(c.health->'factors', '[]'::jsonb) as health_factors,
    (
      jsonb_build_array(
        jsonb_build_object(
          'title', coalesce(c.company_name, c.name, 'Client') || ' joined',
          'body', 'Client profile and workspace access were created from the invitation flow.',
          'category', 'client',
          'created_at', c.created_at,
          'actor_name', 'Agency Admin'
        ),
        jsonb_build_object(
          'title', case
            when lower(c.status::text) = 'closed' or coalesce(c.work_model, '') = 'offboarded'
              then 'Formal offboarding finalized'
            when lower(c.status::text) = 'archived' or coalesce(c.work_model, '') = 'paused'
              then 'Client relationship paused'
            else 'Client relationship active'
          end,
          'body', case
            when lower(c.status::text) = 'closed' or coalesce(c.work_model, '') = 'offboarded'
              then 'Account officially designated as offboarded. Active integrations severed and contract closed.'
            when lower(c.status::text) = 'archived' or coalesce(c.work_model, '') = 'paused'
              then 'Client account is paused and excluded from active monthly portfolio calculations.'
            else 'Client account remains open for active workspace operations.'
          end,
          'category', 'administrative',
          'created_at', coalesce(c.updated_at, c.created_at),
          'actor_name', 'Agency Admin'
        )
      )
      ||
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'title', initcap(replace(al.action, '_', ' ')),
            'body', coalesce(al.metadata->>'description', al.metadata::text),
            'category', coalesce(al.metadata->>'category', 'administrative'),
            'created_at', al.created_at,
            'actor_name', coalesce(actor.full_name, actor.email, 'Agency Admin')
          )
          order by al.created_at desc
        )
        from public.audit_logs al
        left join public.profiles actor on actor.id = al.actor_id
        where al.organization_id = c.organization_id
          and al.resource_id = c.id
      ), '[]'::jsonb)
    ) as audit_events
  from counted c
  left join public.profiles lead on lead.id = c.lead_id
  order by c.created_at desc;
end;
$$;

create or replace function public.set_client_work_model(
  p_space_id uuid,
  p_model_type text,
  p_monthly_value numeric default null,
  p_contract_started_at date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_model text;
begin
  v_model := lower(trim(p_model_type));

  if v_model not in ('retainer', 'project', 'paused', 'offboarded') then
    raise exception 'INVALID_MODEL_TYPE' using errcode = '22023';
  end if;

  select organization_id
  into v_org_id
  from public.spaces
  where id = p_space_id
    and deleted_at is null;

  if v_org_id is null or not public.client_portfolio_authorized(v_org_id) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  insert into public.client_account_profiles (
    organization_id,
    space_id,
    work_model,
    monthly_value,
    contract_started_at
  )
  values (
    v_org_id,
    p_space_id,
    v_model,
    coalesce(p_monthly_value, 0),
    p_contract_started_at
  )
  on conflict (space_id) do update set
    work_model = excluded.work_model,
    monthly_value = coalesce(p_monthly_value, public.client_account_profiles.monthly_value, 0),
    contract_started_at = coalesce(p_contract_started_at, public.client_account_profiles.contract_started_at),
    updated_at = now();

  insert into public.audit_logs (
    organization_id,
    actor_id,
    action,
    resource_type,
    resource_id,
    metadata
  )
  values (
    v_org_id,
    auth.uid(),
    'client_model_changed',
    'space',
    p_space_id,
    jsonb_build_object('model_type', v_model, 'monthly_value', p_monthly_value)
  );

  return (
    select coalesce(jsonb_agg(to_jsonb(portfolio)), '[]'::jsonb)
    from public.get_client_portfolio(v_org_id) portfolio
    where portfolio.id = p_space_id
  );
end;
$$;

create or replace function public.archive_client_relationship(p_space_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select organization_id
  into v_org_id
  from public.spaces
  where id = p_space_id
    and deleted_at is null;

  if v_org_id is null or not public.client_portfolio_authorized(v_org_id) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  update public.spaces
  set status = 'archived',
      updated_at = now()
  where id = p_space_id;

  insert into public.client_account_profiles (
    organization_id,
    space_id,
    work_model
  )
  values (v_org_id, p_space_id, 'paused')
  on conflict (space_id) do update set
    work_model = 'paused',
    updated_at = now();

  insert into public.audit_logs (
    organization_id,
    actor_id,
    action,
    resource_type,
    resource_id,
    metadata
  )
  values (
    v_org_id,
    auth.uid(),
    'client_relationship_paused',
    'space',
    p_space_id,
    jsonb_build_object('category', 'administrative', 'description', 'Client relationship archived and marked as paused.')
  );

  return (
    select coalesce(jsonb_agg(to_jsonb(portfolio)), '[]'::jsonb)
    from public.get_client_portfolio(v_org_id) portfolio
    where portfolio.id = p_space_id
  );
end;
$$;

revoke all on table public.client_account_profiles from public, anon;
grant select, insert, update on table public.client_account_profiles to authenticated;

revoke execute on function public.client_portfolio_authorized(uuid) from public, anon;
revoke execute on function public.calculate_client_health(uuid) from public, anon;
revoke execute on function public.get_client_portfolio(uuid) from public, anon;
revoke execute on function public.set_client_work_model(uuid, text, numeric, date) from public, anon;
revoke execute on function public.archive_client_relationship(uuid) from public, anon;

grant execute on function public.calculate_client_health(uuid) to authenticated;
grant execute on function public.get_client_portfolio(uuid) to authenticated;
grant execute on function public.set_client_work_model(uuid, text, numeric, date) to authenticated;
grant execute on function public.archive_client_relationship(uuid) to authenticated;

notify pgrst, 'reload schema';
