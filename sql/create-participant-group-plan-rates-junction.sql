-- Create junction table for many-to-many relationship between participant_group_plans and group_option_rates
-- This allows one participant_group_plans record to be connected to multiple rates (history)

CREATE TABLE IF NOT EXISTS participant_group_plan_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_group_plan_id UUID NOT NULL REFERENCES participant_group_plans(id) ON DELETE CASCADE,
  group_option_rate_id UUID NOT NULL REFERENCES group_option_rates(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(participant_group_plan_id, group_option_rate_id)
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_pgpr_participant_group_plan_id ON participant_group_plan_rates(participant_group_plan_id);
CREATE INDEX IF NOT EXISTS idx_pgpr_group_option_rate_id ON participant_group_plan_rates(group_option_rate_id);
CREATE INDEX IF NOT EXISTS idx_pgpr_created_at ON participant_group_plan_rates(created_at);

-- Add comments
COMMENT ON TABLE participant_group_plan_rates IS 'Junction table linking participant_group_plans to group_option_rates. Enables many-to-many relationship and preserves rate history.';
COMMENT ON COLUMN participant_group_plan_rates.participant_group_plan_id IS 'Reference to the participant_group_plans record';
COMMENT ON COLUMN participant_group_plan_rates.group_option_rate_id IS 'Reference to the group_option_rates record';
COMMENT ON COLUMN participant_group_plan_rates.created_at IS 'When this rate was connected to the participant plan (for history tracking)';
