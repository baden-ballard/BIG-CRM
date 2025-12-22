-- Add Age Banded employer contribution fields to group_plans table
-- This adds fields for spouse and child contribution values when contribution type is Age Banded

ALTER TABLE group_plans
ADD COLUMN IF NOT EXISTS employer_spouse_contribution_value DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS employer_child_contribution_value DECIMAL(12, 2);

-- Add comment to clarify usage
COMMENT ON COLUMN group_plans.employer_contribution_value IS 'Employer Employee Contribution Value (used when employer_contribution_type is Age Banded)';
COMMENT ON COLUMN group_plans.employer_spouse_contribution_value IS 'Employer Spouse Contribution Value (used when employer_contribution_type is Age Banded)';
COMMENT ON COLUMN group_plans.employer_child_contribution_value IS 'Employer Child Contribution Value (used when employer_contribution_type is Age Banded)';
