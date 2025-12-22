-- Add total_all_plans_employee_responsible_amount column to participant_group_plans table
-- This stores the calculated total sum for all plans (participant + all dependents) for Age Banded plans
-- This value is stored only on the employee plan record (where dependent_id is NULL)
-- For non-Age Banded plans, this will be null

ALTER TABLE participant_group_plans
ADD COLUMN IF NOT EXISTS total_all_plans_employee_responsible_amount DECIMAL(10, 2) NULL;

-- Add comment to explain the field
COMMENT ON COLUMN participant_group_plans.total_all_plans_employee_responsible_amount IS 
'Total Employee Responsible Amount for all plans (participant + spouse + children) for Age Banded plans. This is the sum of all active plan rates employee responsible amounts. Stored only on the employee plan record (dependent_id IS NULL). NULL for non-Age Banded plans, dependent plans, or when not yet calculated.';
