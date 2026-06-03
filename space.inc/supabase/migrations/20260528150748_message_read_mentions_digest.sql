create table if not exists public.message_mentions (
  message_id uuid not null references public.messages(id) on delete cascade,
  mentioned_user_id uuid not null references public.profiles(id) on delete cascade,
  mention_token text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, mentioned_user_id)
);

alter table public.message_mentions enable row level security;

drop policy if exists message_mentions_select on public.message_mentions;
create policy message_mentions_select on public.message_mentions
for select to authenticated using (
  exists (
    select 1
    from public.messages m
    where m.id = message_mentions.message_id
      and public.rls_in_space(m.space_id)
  )
);

create index if not exists idx_message_mentions_user_created
on public.message_mentions(mentioned_user_id, created_at desc);

create index if not exists idx_message_reads_user_message
on public.message_reads(user_id, message_id);

create or replace function public.mark_message_read(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
begin
  select m.space_id into v_space_id
  from public.messages m
  where m.id = p_message_id;

  if v_space_id is null or not public.rls_in_space(v_space_id) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'PT403';
  end if;

  insert into public.message_reads (message_id, user_id, read_at)
  values (p_message_id, auth.uid(), now())
  on conflict (message_id, user_id) do update set read_at = excluded.read_at;
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

  insert into public.message_reads (message_id, user_id, read_at)
  values (v_message.id, v_user_id, now())
  on conflict (message_id, user_id) do update set read_at = excluded.read_at;

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
      and (
        exists (
          select 1
          from public.space_memberships sm
          where sm.space_id = p_space_id
            and sm.profile_id = p.id
            and coalesce(sm.is_active, true) = true
            and coalesce(sm.status, 'active') = 'active'
        )
        or exists (
          select 1
          from public.space_members sm
          where sm.space_id = p_space_id
            and sm.user_id = p.id
        )
        or exists (
          select 1
          from public.spaces s
          join public.org_memberships om on om.organization_id = s.organization_id
          where s.id = p_space_id
            and om.user_id = p.id
            and coalesce(om.status, 'active') = 'active'
            and coalesce(om.role, om.base_role) in ('owner', 'admin')
        )
      )
    limit 1;

    if v_mentioned_id is not null then
      insert into public.message_mentions (message_id, mentioned_user_id, mention_token)
      values (v_message.id, v_mentioned_id, v_mention)
      on conflict (message_id, mentioned_user_id) do nothing;

      if v_mentioned_id <> v_user_id then
        perform public.notify_user(
          v_org_id, p_space_id, v_mentioned_id, 'mention', 'You were mentioned',
          p_content,
          jsonb_build_object('message_id', v_message.id, 'space_id', p_space_id)
        );
      end if;
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
          m.deleted_at,
          exists (
            select 1
            from public.message_reads mr
            where mr.message_id = m.id
              and mr.user_id = auth.uid()
          ) as read_by_me,
          exists (
            select 1
            from public.message_mentions mm
            where mm.message_id = m.id
              and mm.mentioned_user_id = auth.uid()
          ) as is_mentioned,
          coalesce((
            select jsonb_agg(mm.mentioned_user_id)
            from public.message_mentions mm
            where mm.message_id = m.id
          ), '[]'::jsonb) as mentioned_user_ids
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

grant execute on function public.mark_message_read(uuid) to authenticated;
