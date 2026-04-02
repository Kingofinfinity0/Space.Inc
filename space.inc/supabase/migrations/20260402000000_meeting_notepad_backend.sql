-- 1. Create meeting-recordings bucket
insert into storage.buckets (id, name, public)
values ('meeting-recordings', 'meeting-recordings', false)
on conflict (id) do nothing;

-- 2. Meeting Recordings RLS Policies
create policy "Meeting recordings are viewable by space members"
on storage.objects for select
to authenticated
using (
  bucket_id = 'meeting-recordings' AND
  (storage.foldername(name))[1] IN (
    select space_id::text
    from public.space_memberships
    where profile_id = auth.uid()
  )
);

-- 3. Meeting Notes RLS & Realtime
-- Enable Realtime on meeting_notes
alter publication supabase_realtime add table public.meeting_notes;

-- Ensure RLS is enabled
alter table public.meeting_notes enable row level security;

-- Select policy: Space members can read notes for meetings in their spaces
create policy "Users can view notes for meetings in their spaces"
on public.meeting_notes for select
to authenticated
using (
  exists (
    select 1 from public.meetings m
    join public.space_memberships sm on m.space_id = sm.space_id
    where m.id = meeting_notes.meeting_id
    and sm.profile_id = auth.uid()
  )
);

-- Insert/Update policy: Users can only manage their own notes
create policy "Users can manage their own meeting notes"
on public.meeting_notes for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- 4. RPCs
-- Upsert Meeting Note
create or replace function public.upsert_meeting_note(
  p_meeting_id uuid,
  p_content text
)
returns public.meeting_notes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note public.meeting_notes;
begin
  insert into public.meeting_notes (meeting_id, user_id, content, updated_at)
  values (p_meeting_id, auth.uid(), p_content, now())
  on conflict (meeting_id, user_id)
  -- Note: This requires a unique constraint on (meeting_id, user_id)
  do update set
    content = excluded.content,
    updated_at = now()
  returning * into v_note;

  return v_note;
end;
$$;

-- Update Meeting Recording
create or replace function public.update_meeting_recording(
  p_meeting_id uuid,
  p_recording_url text
)
returns public.meetings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meeting public.meetings;
begin
  update public.meetings
  set
    recording_url = p_recording_url,
    recording_status = 'ready',
    has_recording = true,
    updated_at = now()
  where id = p_meeting_id
  returning * into v_meeting;

  return v_meeting;
end;
$$;

-- 5. Add unique constraint to meeting_notes for upsert logic
alter table public.meeting_notes
add constraint meeting_notes_meeting_id_user_id_key unique (meeting_id, user_id);
