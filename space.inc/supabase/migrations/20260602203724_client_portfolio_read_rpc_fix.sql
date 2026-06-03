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
  v_org_id uuid := coalesce(p_organization_id, public.get_my_org_id_secure());
begin
  if v_org_id is null or not public.client_portfolio_authorized(v_org_id) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  return query
  with lifecycle as (
    select
      clv.*,
      cap.work_model,
      cap.monthly_value,
      public.calculate_client_health(clv.space_id) as health
    from public.client_lifecycle_view clv
    left join public.client_account_profiles cap on cap.space_id = clv.space_id
    where clv.organization_id = v_org_id
  )
  select
    coalesce(l.space_id, l.client_id) as id,
    l.organization_id,
    l.organization_id as org_id,
    l.client_id::text,
    coalesce(l.space_name, l.full_name, l.email, 'Unnamed client') as full_name,
    null::text as avatar_url,
    case
      when coalesce(l.work_model, lower(l.space_status)) = 'offboarded' then 'churned'
      when coalesce(l.work_model, lower(l.space_status)) = 'paused' then 'at_risk'
      when (l.health->>'score')::integer >= 80 then 'engaged'
      when (l.health->>'score')::integer < 50 then 'at_risk'
      else coalesce(l.lifecycle_stage, 'invited')
    end as lifecycle_stage,
    coalesce((l.health->>'score')::integer, 0) as onboarding_score,
    (l.health->>'score')::integer as health_score,
    coalesce(l.health->>'label', 'unknown') as health_label,
    coalesce((l.health->>'last_activity_at')::timestamptz, l.last_message_at, l.last_seen_at, l.joined_at) as last_activity_at,
    case when l.space_id is null then 0 else (
      select count(*)::integer from public.messages m
      where m.space_id = l.space_id and m.deleted_at is null
    ) end as message_count,
    coalesce(l.file_count, 0)::integer as file_count,
    case when l.space_id is null then 0 else (
      select count(*)::integer from public.meetings mt
      where mt.space_id = l.space_id and mt.deleted_at is null
    ) end as meeting_count,
    (coalesce(l.is_active, true) and coalesce(l.work_model, 'project') not in ('paused', 'offboarded')) as is_active,
    l.joined_at as created_at,
    l.joined_at,
    coalesce(l.space_name, l.full_name, l.email, 'Unnamed client') as company_name,
    l.email as contact_email,
    'Unassigned'::text as lead_consultant_name,
    null::text as lead_consultant_email,
    case
      when l.work_model is not null then l.work_model
      when lower(l.space_status) = 'closed' then 'offboarded'
      when lower(l.space_status) = 'archived' then 'paused'
      else 'project'
    end as model_type,
    case when coalesce(l.is_active, true) then 1 else 0 end as active_spaces,
    coalesce(l.monthly_value, 0)::numeric as commitment_rate,
    coalesce(l.monthly_value, 0)::numeric as monthly_retainer,
    coalesce(l.health->'factors', '[]'::jsonb) as health_factors,
    jsonb_build_array(
      jsonb_build_object('title', coalesce(l.space_name, l.full_name, 'Client') || ' joined', 'body', 'Client profile and workspace access were created from the invitation flow.', 'category', 'client', 'created_at', l.joined_at, 'actor_name', 'Agency Admin'),
      jsonb_build_object('title', case when coalesce(l.is_active, true) then 'Client relationship active' else 'Formal offboarding finalized' end, 'body', case when coalesce(l.is_active, true) then 'Client account remains open for active workspace operations.' else 'Account officially designated as offboarded. Active integrations severed and contract closed.' end, 'category', 'administrative', 'created_at', coalesce(l.last_seen_at, l.joined_at), 'actor_name', 'Agency Admin')
    ) as audit_events
  from lifecycle l
  order by l.joined_at desc nulls last;
end;
$$;

notify pgrst, 'reload schema';
