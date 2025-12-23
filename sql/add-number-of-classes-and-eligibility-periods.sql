-- Add number_of_classes and additional eligibility period columns to groups table
-- Run this in Supabase SQL Editor

-- Add number_of_classes column with default value of 1
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS number_of_classes INTEGER DEFAULT 1;

-- Add check constraint for number_of_classes (must be 1, 2, or 3)
ALTER TABLE groups 
DROP CONSTRAINT IF EXISTS groups_number_of_classes_check;

ALTER TABLE groups 
ADD CONSTRAINT groups_number_of_classes_check 
CHECK (number_of_classes IN (1, 2, 3));

-- Add eligibility_period_class_2 column
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS eligibility_period_class_2 VARCHAR(255);

-- Add check constraint for eligibility_period_class_2
ALTER TABLE groups 
DROP CONSTRAINT IF EXISTS groups_eligibility_period_class_2_check;

ALTER TABLE groups 
ADD CONSTRAINT groups_eligibility_period_class_2_check 
CHECK (
  eligibility_period_class_2 IS NULL OR 
  eligibility_period_class_2 IN (
    'First of Month Following Date of Hire',
    'First of Month Following 30 Days',
    'First of the Month Following 60 Days'
  )
);

-- Add eligibility_period_class_3 column
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS eligibility_period_class_3 VARCHAR(255);

-- Add check constraint for eligibility_period_class_3
ALTER TABLE groups 
DROP CONSTRAINT IF EXISTS groups_eligibility_period_class_3_check;

ALTER TABLE groups 
ADD CONSTRAINT groups_eligibility_period_class_3_check 
CHECK (
  eligibility_period_class_3 IS NULL OR 
  eligibility_period_class_3 IN (
    'First of Month Following Date of Hire',
    'First of Month Following 30 Days',
    'First of the Month Following 60 Days'
  )
);

