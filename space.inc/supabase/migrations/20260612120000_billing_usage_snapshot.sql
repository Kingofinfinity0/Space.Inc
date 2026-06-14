create or replace function public.get_billing_usage_snapshot(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_org public.organizations%rowtype;
  v_metadata jsonb;
  v_limits jsonb;
  v_plan text;
  v_limit_text text;
  v_storage_used_bytes bigint := 0;
  v_storage_limit_bytes bigint;
  v_spaces_used bigint := 0;
  v_spaces_limit integer;
  v_team_members_used bigint := 0;
  v_team_members_limit integer;
  v_gb_bytes numeric := 1073741824;
begin
  if v_caller is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'PT401';
  end if;

  select *
  into v_org
  from public.organizations
  where id = p_organization_id;

  if not found then
    raise exception 'ORGANIZATION_NOT_FOUND' using errcode = 'PT404';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_caller
      and p.organization_id = p_organization_id
      and p.role::text in ('owner', 'admin')
  )
  and not exists (
    select 1
    from public.org_memberships om
    where om.user_id = v_caller
      and om.organization_id = p_organization_id
      and coalesce(om.status, 'active') = 'active'
      and lower(coalesce(om.role, om.base_role, '')) in ('owner', 'admin')
  ) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'PT403';
  end if;

  v_metadata := coalesce(v_org.metadata, '{}'::jsonb);
  v_limits := coalesce(v_metadata->'limits', '{}'::jsonb);
  v_plan := lower(replace(coalesce(nullif(v_org.plan_tier, ''), v_metadata->>'plan_tier', 'solo'), '-', '_'));

  select coalesce(sum(coalesce(f.file_size_bytes, f.file_size, 0)), 0)
  into v_storage_used_bytes
  from public.files f
  where f.organization_id = p_organization_id
    and f.deleted_at is null
    and coalesce(f.status::text, '') <> 'deleted';

  select count(*)
  into v_spaces_used
  from public.spaces s
  where s.organization_id = p_organization_id
    and s.deleted_at is null
    and coalesce(lower(s.status::text), 'active') not in ('archived', 'closed');

  select count(distinct team.user_id)
  into v_team_members_used
  from (
    select p.id as user_id
    from public.profiles p
    where p.organization_id = p_organization_id
      and coalesce(p.is_active, true) = true
      and p.role::text in ('owner', 'admin', 'staff')

    union

    select om.user_id
    from public.org_memberships om
    join public.profiles p on p.id = om.user_id
    where om.organization_id = p_organization_id
      and coalesce(om.status, 'active') = 'active'
      and coalesce(p.is_active, true) = true
      and lower(coalesce(om.role, om.base_role, p.role::text)) in ('owner', 'admin', 'staff')
  ) team;

  v_limit_text := coalesce(v_limits->>'storage_bytes', v_metadata->>'storage_limit_bytes');
  if v_limit_text ~ '^[0-9]+$' then
    v_storage_limit_bytes := v_limit_text::bigint;
  else
    v_limit_text := coalesce(v_limits->>'storage_gb', v_metadata->>'storage_limit_gb');
    if v_limit_text ~ '^[0-9]+(\.[0-9]+)?$' then
      v_storage_limit_bytes := ceil(v_limit_text::numeric * v_gb_bytes)::bigint;
    end if;
  end if;

  if v_storage_limit_bytes is null then
    v_storage_limit_bytes := case v_plan
      when 'starter' then 5 * v_gb_bytes
      when 'solo' then 5 * v_gb_bytes
      when 'growth' then 20 * v_gb_bytes
      when 'scale' then 100 * v_gb_bytes
      when 'pro' then 250 * v_gb_bytes
      when 'pro_agency' then 250 * v_gb_bytes
      else greatest(5 * v_gb_bytes, ceil(greatest(v_storage_used_bytes, 1)::numeric / v_gb_bytes) * v_gb_bytes)
    end::bigint;
  end if;

  v_limit_text := coalesce(v_limits->>'spaces', v_metadata->>'space_limit', v_metadata->>'max_spaces');
  if v_limit_text ~ '^[0-9]+$' then
    v_spaces_limit := v_limit_text::integer;
  else
    v_spaces_limit := case v_plan
      when 'starter' then 3
      when 'solo' then 3
      when 'growth' then 10
      when 'scale' then 30
      when 'pro' then 50
      when 'pro_agency' then 50
      else greatest(3, v_spaces_used::integer)
    end;
  end if;

  v_limit_text := coalesce(
    v_limits->>'team_members',
    v_limits->>'staff_seats',
    v_metadata->>'team_members_limit',
    v_metadata->>'staff_seats',
    v_metadata->>'seat_limit',
    v_metadata->>'max_seats'
  );
  if v_limit_text ~ '^[0-9]+$' then
    v_team_members_limit := v_limit_text::integer;
  else
    v_team_members_limit := case v_plan
      when 'starter' then 1
      when 'solo' then 1
      when 'growth' then 3
      when 'scale' then 10
      when 'pro' then 20
      when 'pro_agency' then 20
      else greatest(1, v_team_members_used::integer)
    end;
  end if;

  return jsonb_build_object(
    'storageUsedBytes', v_storage_used_bytes,
    'storageLimitBytes', greatest(v_storage_limit_bytes, 1),
    'spacesUsed', v_spaces_used,
    'spacesLimit', greatest(v_spaces_limit, 1),
    'teamMembersUsed', v_team_members_used,
    'teamMembersLimit', greatest(v_team_members_limit, 1),
    'planTier', v_plan
  );
end;
$$;

comment on function public.get_billing_usage_snapshot(uuid)
is 'Returns organization billing usage ratios for storage, spaces, and active team members.';

revoke all on function public.get_billing_usage_snapshot(uuid) from public, anon;
grant execute on function public.get_billing_usage_snapshot(uuid) to authenticated;
