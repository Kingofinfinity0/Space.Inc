-- Add description column to meetings table
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS description TEXT;
