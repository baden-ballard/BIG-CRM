-- Add eligibility_period column to groups table
-- Run this in Supabase SQL Editor

ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS eligibility_period VARCHAR(255);

-- Add check constraint for valid values (optional, but recommended)
ALTER TABLE groups 
DROP CONSTRAINT IF EXISTS groups_eligibility_period_check;

ALTER TABLE groups 
ADD CONSTRAINT groups_eligibility_period_check 
CHECK (
  eligibility_period IS NULL OR 
  eligibility_period IN (
    'First of Month Following Date of Hire',
    'First of Month Following 30 Days',
    'First of the Month Following 60 Days'
  )
);
