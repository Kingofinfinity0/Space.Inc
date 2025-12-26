-- Add user_id column to meeting_participants table
ALTER TABLE meeting_participants ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
