-- Migration: Add rate history fields to group_option_rates table
-- Date: 2025-01-XX
-- Description: Adds fields to store historical snapshot of plan option and contribution data when rates are created

-- Add employer contribution type (can come from group_plan_options or group_plans)
ALTER TABLE group_option_rates 
ADD COLUMN IF NOT EXISTS employer_contribution_type VARCHAR(50) CHECK (employer_contribution_type IN ('Dollar', 'Percentage', 'Dollar Amount'));

-- Add class contribution amounts (from group_plan_options)
ALTER TABLE group_option_rates 
ADD COLUMN IF NOT EXISTS class_1_contribution_amount DECIMAL(12, 2);

ALTER TABLE group_option_rates 
ADD COLUMN IF NOT EXISTS class_2_contribution_amount DECIMAL(12, 2);

ALTER TABLE group_option_rates 
ADD COLUMN IF NOT EXISTS class_3_contribution_amount DECIMAL(12, 2);

-- Add employer contribution values (from group_plans for Age Banded plans)
ALTER TABLE group_option_rates 
ADD COLUMN IF NOT EXISTS employer_employee_contribution_value DECIMAL(12, 2);

ALTER TABLE group_option_rates 
ADD COLUMN IF NOT EXISTS employer_spouse_contribution_value DECIMAL(12, 2);

ALTER TABLE group_option_rates 
ADD COLUMN IF NOT EXISTS employer_child_contribution_value DECIMAL(12, 2);

-- Add comments
COMMENT ON COLUMN group_option_rates.employer_contribution_type IS 'Employer Contribution Type snapshot at time of rate creation (from group_plan_options or group_plans)';
COMMENT ON COLUMN group_option_rates.class_1_contribution_amount IS 'Class 1 Contribution Amount snapshot at time of rate creation (from group_plan_options)';
COMMENT ON COLUMN group_option_rates.class_2_contribution_amount IS 'Class 2 Contribution Amount snapshot at time of rate creation (from group_plan_options)';
COMMENT ON COLUMN group_option_rates.class_3_contribution_amount IS 'Class 3 Contribution Amount snapshot at time of rate creation (from group_plan_options)';
COMMENT ON COLUMN group_option_rates.employer_employee_contribution_value IS 'Employer Employee Contribution Value snapshot at time of rate creation (from group_plans for Age Banded plans)';
COMMENT ON COLUMN group_option_rates.employer_spouse_contribution_value IS 'Employer Spouse Contribution Value snapshot at time of rate creation (from group_plans for Age Banded plans)';
COMMENT ON COLUMN group_option_rates.employer_child_contribution_value IS 'Employer Child Contribution Value snapshot at time of rate creation (from group_plans for Age Banded plans)';
