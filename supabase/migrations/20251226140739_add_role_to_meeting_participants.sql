-- Add role column to meeting_participants table
ALTER TABLE meeting_participants ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'participant' CHECK (role IN ('host', 'participant', 'observer'));
