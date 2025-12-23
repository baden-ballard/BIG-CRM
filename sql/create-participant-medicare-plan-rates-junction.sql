-- Create junction table for many-to-many relationship between participant_medicare_plans and medicare_child_rates
-- This allows one participant_medicare_plans record to be connected to multiple rates (history)
-- Similar to participant_group_plan_rates for group plans

CREATE TABLE IF NOT EXISTS participant_medicare_plan_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_medicare_plan_id UUID NOT NULL REFERENCES participant_medicare_plans(id) ON DELETE CASCADE,
  medicare_child_rate_id UUID NOT NULL REFERENCES medicare_child_rates(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(participant_medicare_plan_id, medicare_child_rate_id)
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_pmpr_participant_medicare_plan_id ON participant_medicare_plan_rates(participant_medicare_plan_id);
CREATE INDEX IF NOT EXISTS idx_pmpr_medicare_child_rate_id ON participant_medicare_plan_rates(medicare_child_rate_id);
CREATE INDEX IF NOT EXISTS idx_pmpr_start_date ON participant_medicare_plan_rates(start_date);
CREATE INDEX IF NOT EXISTS idx_pmpr_end_date ON participant_medicare_plan_rates(end_date);
CREATE INDEX IF NOT EXISTS idx_pmpr_created_at ON participant_medicare_plan_rates(created_at);

-- Add comments
COMMENT ON TABLE participant_medicare_plan_rates IS 'Junction table linking participant_medicare_plans to medicare_child_rates. Enables many-to-many relationship and preserves rate history.';
COMMENT ON COLUMN participant_medicare_plan_rates.participant_medicare_plan_id IS 'Reference to the participant_medicare_plans record';
COMMENT ON COLUMN participant_medicare_plan_rates.medicare_child_rate_id IS 'Reference to the medicare_child_rates record';
COMMENT ON COLUMN participant_medicare_plan_rates.start_date IS 'Start date for this rate assignment';
COMMENT ON COLUMN participant_medicare_plan_rates.end_date IS 'End date for this rate assignment (null if currently active)';
COMMENT ON COLUMN participant_medicare_plan_rates.created_at IS 'When this rate was connected to the participant plan (for history tracking)';

-- Enable RLS
ALTER TABLE participant_medicare_plan_rates ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Allow all operations" ON participant_medicare_plan_rates FOR ALL USING (true) WITH CHECK (true);

