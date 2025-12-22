-- Add dependent_id field to participant_group_plans to track which dependent a plan record belongs to
-- This allows us to show separate sections for Employee, Spouse, and Child rates

ALTER TABLE participant_group_plans
ADD COLUMN IF NOT EXISTS dependent_id UUID REFERENCES dependents(id) ON DELETE CASCADE;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_participant_group_plans_dependent ON participant_group_plans(dependent_id);

COMMENT ON COLUMN participant_group_plans.dependent_id IS 'If set, this plan record is for a dependent. NULL means it is for the main participant (employee).';
