-- Create recordings table
CREATE TABLE IF NOT EXISTS recordings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    daily_recording_id TEXT NOT NULL,
    file_path TEXT,
    file_size BIGINT,
    duration_seconds INTEGER,
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'error')),
    download_url TEXT,
    thumbnail_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
