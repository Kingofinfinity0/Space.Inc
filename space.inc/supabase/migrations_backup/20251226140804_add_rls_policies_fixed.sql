-- Enable RLS on recordings table
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;

-- Enable RLS on meeting_participants table
ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;

-- Recordings RLS policies
CREATE POLICY "Users can view recordings in their organization" ON recordings
    FOR SELECT USING (
        meeting_id IN (
            SELECT id FROM meetings 
            WHERE organization_id IN (
                SELECT organization_id FROM profiles 
                WHERE id = auth.uid()
            )
        )
    );

-- Meeting participants RLS policies
CREATE POLICY "Users can view participants in their meetings" ON meeting_participants
    FOR SELECT USING (
        meeting_id IN (
            SELECT id FROM meetings 
            WHERE organization_id IN (
                SELECT organization_id FROM profiles 
                WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can be added to meetings" ON meeting_participants
    FOR INSERT WITH CHECK (
        user_id = auth.uid() OR
        meeting_id IN (
            SELECT id FROM meetings 
            WHERE created_by = auth.uid()
        )
    );
