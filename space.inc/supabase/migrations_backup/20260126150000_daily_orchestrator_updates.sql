-- Create enrollment_status enum if not exists
DO $$ BEGIN
    CREATE TYPE meeting_status AS ENUM ('scheduled', 'live', 'ended', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update meetings table
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS recording_id UUID REFERENCES recordings(id) ON DELETE SET NULL;

-- Ensure status column uses the enum or check constraint
-- Handle existing text column if necessary
DO $$ BEGIN
    ALTER TABLE meetings ALTER COLUMN status TYPE TEXT;
    ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_status_check;
    ALTER TABLE meetings ADD CONSTRAINT meetings_status_check CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled'));
EXCEPTION
    WHEN others THEN null;
END $$;

-- Update meeting_participants table
ALTER TABLE meeting_participants
ADD COLUMN IF NOT EXISTS participant_id TEXT, -- Daily's participant ID
ADD COLUMN IF NOT EXISTS participant_name TEXT,
ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS left_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_meetings_organization_id ON meetings(organization_id);
CREATE INDEX IF NOT EXISTS idx_meetings_space_id ON meetings(space_id);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting_id ON meeting_participants(meeting_id);
