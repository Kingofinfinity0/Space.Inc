-- Keep notifications trigger-owned:
-- - direct table triggers insert notification rows
-- - clients can read/mark their own notifications
-- - internal fan-out helpers are not callable from the public API

drop trigger if exists tr_enqueue_message_notification on public.messages;
drop trigger if exists tr_enqueue_task_notification on public.tasks;
drop trigger if exists tr_enqueue_meeting_notification on public.meetings;

-- This legacy trigger also created in-app meeting notifications. The newer
-- trg_meeting_notify trigger owns that now, so keep only the reminder side effect.
create or replace function public.trg_notify_meeting_created()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
    if TG_OP != 'INSERT' then return NEW; end if;
    if NEW.status not in ('scheduled', 'live', 'active') then return NEW; end if;

    begin
      insert into public.background_jobs (
          organization_id,
          job_type,
          status,
          payload,
          idempotency_key,
          scheduled_at
      ) values (
          NEW.organization_id,
          'send_meeting_reminder',
          'pending',
          jsonb_build_object(
              'meeting_id',    NEW.id,
              'meeting_title', NEW.title,
              'space_id',      NEW.space_id,
              'starts_at',     NEW.starts_at
          ),
          'reminder_1h_' || NEW.id::text,
          NEW.starts_at - interval '1 hour'
      )
      on conflict (idempotency_key) do nothing;
    exception when others then
      raise warning 'trg_notify_meeting_created: reminder side effect failed: %', SQLERRM;
    end;

    return NEW;
end;
$function$;

drop policy if exists notifications_insert on public.notifications;

alter table if exists public.notifications enable row level security;

drop policy if exists notifications_insert_deny on public.notifications;
create policy notifications_insert_deny
on public.notifications
for insert
to public
with check (false);

do $$
declare
  v_signature text;
  v_internal_functions text[] := array[
    'public.notify_user(uuid,text,text,text,uuid,uuid,uuid,text,uuid,text,jsonb,text)',
    'public.notify_space_members(uuid,text,text,text,uuid,text,uuid,text,jsonb,text[],text,uuid)',
    'public.notify_space_members(uuid,uuid,text,text,text,text,uuid,boolean)',
    'public.user_wants_notification(uuid,text,uuid,text)',
    'public.purge_expired_notifications()'
  ];
begin
  foreach v_signature in array v_internal_functions loop
    if to_regprocedure(v_signature) is not null then
      execute format('revoke execute on function %s from public', v_signature);
      execute format('revoke execute on function %s from anon', v_signature);
      execute format('revoke execute on function %s from authenticated', v_signature);
    end if;
  end loop;
end $$;

do $$
declare
  v_signature text;
  v_app_functions text[] := array[
    'public.get_my_notifications(integer,integer,boolean)',
    'public.get_my_notifications(text,integer,integer)',
    'public.get_my_unread_notification_count()',
    'public.mark_notification_read(uuid)',
    'public.mark_all_notifications_read()',
    'public.mark_all_notifications_read(uuid)',
    'public.dismiss_notification(uuid)',
    'public.get_my_notification_preferences()',
    'public.upsert_notification_preferences(boolean,boolean,boolean,jsonb,jsonb,jsonb)',
    'public.toggle_notification_type(text,boolean)',
    'public.toggle_space_notifications(uuid,boolean)'
  ];
begin
  foreach v_signature in array v_app_functions loop
    if to_regprocedure(v_signature) is not null then
      execute format('revoke execute on function %s from public', v_signature);
      execute format('revoke execute on function %s from anon', v_signature);
      execute format('grant execute on function %s to authenticated', v_signature);
    end if;
  end loop;
end $$;
