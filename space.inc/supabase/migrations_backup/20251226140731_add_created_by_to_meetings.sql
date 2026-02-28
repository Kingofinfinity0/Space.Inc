-- Add created_by column to meetings table
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
