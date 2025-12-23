-- Add dependent count fields to participants table
-- These allow storing counts without creating individual dependent records

ALTER TABLE participants
ADD COLUMN IF NOT EXISTS number_of_spouses INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS number_of_children INTEGER DEFAULT 0;

-- Add comments
COMMENT ON COLUMN participants.number_of_spouses IS 'Number of spouses (count only, not individual records)';
COMMENT ON COLUMN participants.number_of_children IS 'Number of children (count only, not individual records)';

