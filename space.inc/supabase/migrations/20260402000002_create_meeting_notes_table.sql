-- Create meeting_notes table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.meeting_notes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content text DEFAULT '',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_meeting_notes_meeting_id ON public.meeting_notes(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_user_id ON public.meeting_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_updated_at ON public.meeting_notes(updated_at);

-- Enable Row Level Security
ALTER TABLE public.meeting_notes ENABLE ROW LEVEL SECURITY;

-- Select policy: Space members can read notes for meetings in their spaces
CREATE POLICY "Users can view notes for meetings in their spaces"
ON public.meeting_notes FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.meetings m
        JOIN public.space_memberships sm ON m.space_id = sm.space_id
        WHERE m.id = meeting_notes.meeting_id
        AND sm.profile_id = auth.uid()
    )
);

-- Insert/Update policy: Users can only manage their own notes
CREATE POLICY "Users can manage their own meeting notes"
ON public.meeting_notes FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_notes;
