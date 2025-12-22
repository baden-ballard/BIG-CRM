-- Add notes column to participants table
-- This allows storing notes about each participant

ALTER TABLE participants 
ADD COLUMN IF NOT EXISTS notes TEXT;
