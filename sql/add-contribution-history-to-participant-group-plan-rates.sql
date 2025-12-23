-- Add contribution history fields to participant_group_plan_rates table
-- This allows tracking employer contribution changes over time for each participant

-- Add employer contribution fields
ALTER TABLE participant_group_plan_rates
  ADD COLUMN IF NOT EXISTS employer_contribution_type VARCHAR,
  ADD COLUMN IF NOT EXISTS employer_contribution_amount DECIMAL,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE;

-- Add comments
COMMENT ON COLUMN participant_group_plan_rates.employer_contribution_type IS 'Type of employer contribution: Percentage or Dollar Amount';
COMMENT ON COLUMN participant_group_plan_rates.employer_contribution_amount IS 'The employer contribution amount that applies to this record (based on participant/dependent relationship)';
COMMENT ON COLUMN participant_group_plan_rates.start_date IS 'Start date for this contribution rate';
COMMENT ON COLUMN participant_group_plan_rates.end_date IS 'End date for this contribution rate (null if currently active)';

-- Add index for date queries
CREATE INDEX IF NOT EXISTS idx_pgpr_start_date ON participant_group_plan_rates(start_date);
CREATE INDEX IF NOT EXISTS idx_pgpr_end_date ON participant_group_plan_rates(end_date);

