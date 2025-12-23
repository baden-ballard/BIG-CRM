-- Add termination_date field to participant_group_plans table
-- This allows tracking when a participant's enrollment in a group plan ends
-- This is separate from the group_plan's termination_date, which tracks when the plan itself ends

ALTER TABLE participant_group_plans
ADD COLUMN IF NOT EXISTS termination_date DATE NULL;

-- Add index for better query performance when filtering by termination date
CREATE INDEX IF NOT EXISTS idx_participant_group_plans_termination_date ON participant_group_plans(termination_date);

-- Add comment to explain the field
COMMENT ON COLUMN participant_group_plans.termination_date IS 
'Date when the participant''s enrollment in this group plan ended. NULL means the participant is still actively enrolled. This is separate from group_plans.termination_date which tracks when the plan itself ends.';

