-- Add total_employee_responsible_amount column to participant_group_plans table
-- This stores the calculated total for Age Banded plans (sum of employee + spouse + children)
-- For non-Age Banded plans, this will be null

ALTER TABLE participant_group_plans
ADD COLUMN IF NOT EXISTS total_employee_responsible_amount DECIMAL(10, 2) NULL;

-- Add comment to explain the field
COMMENT ON COLUMN participant_group_plans.total_employee_responsible_amount IS 
'Total Employee Responsible Amount for Age Banded plans. Calculated as sum of all current rates employee responsible amounts (employee + spouse + children). NULL for non-Age Banded plans or when not yet calculated.';


