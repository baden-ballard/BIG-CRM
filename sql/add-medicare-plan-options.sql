-- Migration: Add Medicare Plan Options Structure
-- This migration adds plan options and option rates to Medicare plans, mirroring the group plans structure

-- Step 1: Add new columns to medicare_plans table
ALTER TABLE medicare_plans
ADD COLUMN IF NOT EXISTS effective_date DATE,
ADD COLUMN IF NOT EXISTS termination_date DATE,
ADD COLUMN IF NOT EXISTS plan_type VARCHAR(50) CHECK (plan_type IN ('Age Banded', 'Composite'));

-- Step 2: Create medicare_plan_options table
CREATE TABLE IF NOT EXISTS medicare_plan_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medicare_plan_id UUID NOT NULL REFERENCES medicare_plans(id) ON DELETE CASCADE,
    option VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Create medicare_option_rates table
CREATE TABLE IF NOT EXISTS medicare_option_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medicare_plan_option_id UUID NOT NULL REFERENCES medicare_plan_options(id) ON DELETE CASCADE,
    rate DECIMAL(12, 2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Update participant_medicare_plans table
ALTER TABLE participant_medicare_plans
ADD COLUMN IF NOT EXISTS medicare_plan_option_id UUID REFERENCES medicare_plan_options(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS medicare_option_rate_id UUID REFERENCES medicare_option_rates(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS rate_override DECIMAL(12, 2);

-- Step 5: Create indexes
CREATE INDEX IF NOT EXISTS idx_medicare_plan_options_plan ON medicare_plan_options(medicare_plan_id);
CREATE INDEX IF NOT EXISTS idx_medicare_option_rates_option ON medicare_option_rates(medicare_plan_option_id);
CREATE INDEX IF NOT EXISTS idx_medicare_option_rates_active ON medicare_option_rates(medicare_plan_option_id, end_date) WHERE end_date IS NULL;
CREATE INDEX IF NOT EXISTS idx_participant_medicare_plans_option ON participant_medicare_plans(medicare_plan_option_id);
CREATE INDEX IF NOT EXISTS idx_participant_medicare_plans_option_rate ON participant_medicare_plans(medicare_option_rate_id);

-- Step 6: Create function to handle medicare option rate date automation
CREATE OR REPLACE FUNCTION handle_medicare_option_rate_dates()
RETURNS TRIGGER AS $$
DECLARE
    plan_effective_date DATE;
    previous_rate_id UUID;
    previous_start_date DATE;
BEGIN
    -- If this is a new rate (INSERT)
    IF TG_OP = 'INSERT' THEN
        -- Get the plan's effective date
        SELECT mp.effective_date INTO plan_effective_date
        FROM medicare_plans mp
        JOIN medicare_plan_options mpo ON mpo.medicare_plan_id = mp.id
        WHERE mpo.id = NEW.medicare_plan_option_id;
        
        -- Check if this is the first rate for this option
        SELECT id, start_date INTO previous_rate_id, previous_start_date
        FROM medicare_option_rates
        WHERE medicare_plan_option_id = NEW.medicare_plan_option_id
          AND id != NEW.id
        ORDER BY start_date DESC
        LIMIT 1;
        
        -- If no previous rate exists, set start_date to plan effective date
        IF previous_rate_id IS NULL THEN
            NEW.start_date = COALESCE(NEW.start_date, plan_effective_date);
        ELSE
            -- Set start_date to today if not provided
            IF NEW.start_date IS NULL THEN
                NEW.start_date = CURRENT_DATE;
            END IF;
            
            -- Update previous rate's end_date to day before new rate's start_date
            UPDATE medicare_option_rates
            SET end_date = NEW.start_date - INTERVAL '1 day',
                updated_at = NOW()
            WHERE id = previous_rate_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 7: Create triggers for updated_at
CREATE TRIGGER update_medicare_plan_options_updated_at BEFORE UPDATE ON medicare_plan_options
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medicare_option_rates_updated_at BEFORE UPDATE ON medicare_option_rates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 8: Create trigger for rate date automation
CREATE TRIGGER handle_medicare_option_rate_dates_trigger
    BEFORE INSERT ON medicare_option_rates
    FOR EACH ROW EXECUTE FUNCTION handle_medicare_option_rate_dates();

-- Step 9: Enable RLS on new tables
ALTER TABLE medicare_plan_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicare_option_rates ENABLE ROW LEVEL SECURITY;

-- Step 10: Create RLS policies for new tables
CREATE POLICY "Allow all operations" ON medicare_plan_options FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON medicare_option_rates FOR ALL USING (true) WITH CHECK (true);

-- Step 11: Drop old medicare_rates table and related objects (if they exist)
-- Note: These may not exist if the table was never created or already dropped
DO $$
BEGIN
    -- Drop trigger if it exists
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_medicare_rate_dates_trigger') THEN
        DROP TRIGGER IF EXISTS handle_medicare_rate_dates_trigger ON medicare_rates;
    END IF;
    
    -- Drop table if it exists
    DROP TABLE IF EXISTS medicare_rates CASCADE;
    
    -- Drop function if it exists
    DROP FUNCTION IF EXISTS handle_medicare_rate_dates();
END $$;
