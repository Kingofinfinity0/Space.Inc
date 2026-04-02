-- Ensure meeting_notes has a trigger for updated_at if not already present
-- or handle it in the RPC (which we do).

-- Verify RLS for profiles needed by the notepad
-- Users need to see basic profile info of other attendees to show names in the team feed.
create policy "Public profiles are viewable by everyone in the organization"
on public.profiles for select
to authenticated
using (
  exists (
    select 1 from public.profiles p2
    where p2.id = auth.uid()
    and p2.organization_id = profiles.organization_id
  )
);
