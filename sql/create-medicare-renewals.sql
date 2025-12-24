-- Medicare Renewals System
-- Creates tables and automation for Medicare plan renewals

-- ============================================
-- TABLES
-- ============================================

-- Medicare Renewals Table
CREATE TABLE IF NOT EXISTS medicare_renewals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    renewal_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Renewal Medicare Plans Junction Table (Many-to-Many: Renewals ↔ Medicare Plans)
CREATE TABLE IF NOT EXISTS renewal_medicare_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    renewal_id UUID NOT NULL REFERENCES medicare_renewals(id) ON DELETE CASCADE,
    medicare_plan_id UUID NOT NULL REFERENCES medicare_plans(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(renewal_id, medicare_plan_id)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_medicare_renewals_date ON medicare_renewals(renewal_date);
CREATE INDEX IF NOT EXISTS idx_renewal_medicare_plans_renewal ON renewal_medicare_plans(renewal_id);
CREATE INDEX IF NOT EXISTS idx_renewal_medicare_plans_plan ON renewal_medicare_plans(medicare_plan_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update updated_at timestamp
CREATE TRIGGER update_medicare_renewals_updated_at 
    BEFORE UPDATE ON medicare_renewals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- AUTOMATION FUNCTION
-- ============================================

-- Main function to process Medicare renewal automation
-- This function:
-- 1. Finds all active participants enrolled in the selected Medicare plans
-- 2. Finds the Medicare child rate that matches the renewal date for each plan
-- 3. Ends active participant_medicare_plan_rates records (sets end_date to day before renewal date)
-- 4. Creates new participant_medicare_plan_rates records with the new rate
-- 5. Updates participant_medicare_plans records to connect participants to the new rates
CREATE OR REPLACE FUNCTION process_medicare_renewal_automation(p_renewal_id UUID)
RETURNS void AS $$
DECLARE
    v_renewal RECORD;
    v_renewal_date DATE;
    v_day_before_renewal DATE;
    v_plan RECORD;
    v_participant_plan RECORD;
    v_medicare_plan RECORD;
    v_medicare_child_rate_id UUID;
    v_participant RECORD;
    v_existing_record_id UUID;
    v_existing_end_date DATE;
BEGIN
    -- Get renewal details
    SELECT mr.id, mr.renewal_date
    INTO v_renewal
    FROM medicare_renewals mr
    WHERE mr.id = p_renewal_id;
    
    IF v_renewal.id IS NULL THEN
        RAISE EXCEPTION 'Medicare renewal not found: %', p_renewal_id;
    END IF;
    
    v_renewal_date := v_renewal.renewal_date;
    v_day_before_renewal := v_renewal_date - 1;
    
    -- Process each Medicare plan in the renewal
    FOR v_plan IN
        SELECT rmp.medicare_plan_id
        FROM renewal_medicare_plans rmp
        WHERE rmp.renewal_id = p_renewal_id
    LOOP
        -- Get Medicare plan details
        SELECT mp.*
        INTO v_medicare_plan
        FROM medicare_plans mp
        WHERE mp.id = v_plan.medicare_plan_id;
        
        IF v_medicare_plan.id IS NULL THEN
            CONTINUE; -- Skip if plan not found
        END IF;
        
        -- Find the Medicare child rate that matches the renewal date
        SELECT mcr.id
        INTO v_medicare_child_rate_id
        FROM medicare_child_rates mcr
        WHERE mcr.medicare_plan_id = v_plan.medicare_plan_id
            AND mcr.start_date <= v_renewal_date
            AND (mcr.end_date IS NULL OR mcr.end_date >= v_renewal_date)
        ORDER BY mcr.start_date DESC
        LIMIT 1;
        
        IF v_medicare_child_rate_id IS NULL THEN
            RAISE WARNING 'No Medicare child rate found for plan % on renewal date %', 
                v_plan.medicare_plan_id, v_renewal_date;
            CONTINUE; -- Skip this plan if no rate found
        END IF;
        
        -- Process each participant enrolled in this Medicare plan
        -- Find all active participants enrolled in this plan
        -- A participant is considered active if:
        -- 1. They have a participant_medicare_plans record for this plan
        -- 2. The participant is not terminated (termination_date is NULL or >= renewal_date)
        -- We will attach all active participants to the ONE active rate found above (v_medicare_child_rate_id)
        FOR v_participant_plan IN
            SELECT 
                pmp.id,
                pmp.participant_id,
                pmp.medicare_plan_id,
                pmp.medicare_child_rate_id as current_rate_id,
                p.id as participant_id_check,
                p.dob as participant_dob
            FROM participant_medicare_plans pmp
            INNER JOIN participants p ON p.id = pmp.participant_id
            WHERE pmp.medicare_plan_id = v_plan.medicare_plan_id
                -- Check if participant is active on renewal date
                AND (p.termination_date IS NULL OR p.termination_date >= v_renewal_date)
        LOOP
            -- End all active participant_medicare_plan_rates records for this participant_medicare_plan
            UPDATE participant_medicare_plan_rates
            SET end_date = v_day_before_renewal
            WHERE participant_medicare_plan_id = v_participant_plan.id
                AND end_date IS NULL;
            
            -- Check if a rate record already exists for this renewal date
            -- This prevents creating duplicate records if the renewal is run multiple times
            SELECT id, end_date
            INTO v_existing_record_id, v_existing_end_date
            FROM participant_medicare_plan_rates
            WHERE participant_medicare_plan_id = v_participant_plan.id
                AND medicare_child_rate_id = v_medicare_child_rate_id
                AND start_date = v_renewal_date;
            
            -- Only create a new record if one doesn't already exist for this renewal date
            IF v_existing_record_id IS NULL THEN
                -- Create new participant_medicare_plan_rates record
                BEGIN
                    INSERT INTO participant_medicare_plan_rates (
                        participant_medicare_plan_id,
                        medicare_child_rate_id,
                        start_date,
                        end_date
                    ) VALUES (
                        v_participant_plan.id,
                        v_medicare_child_rate_id,
                        v_renewal_date,
                        NULL
                    );
                EXCEPTION
                    WHEN unique_violation THEN
                        -- A record with this exact rate already exists
                        -- Check if it's closed - if so, reactivate it; if active, update it
                        SELECT id, end_date
                        INTO v_existing_record_id, v_existing_end_date
                        FROM participant_medicare_plan_rates
                        WHERE participant_medicare_plan_id = v_participant_plan.id
                            AND medicare_child_rate_id = v_medicare_child_rate_id
                        LIMIT 1;
                        
                        IF v_existing_end_date IS NULL THEN
                            -- Active record exists - update it
                            UPDATE participant_medicare_plan_rates
                            SET 
                                start_date = v_renewal_date,
                                end_date = NULL
                            WHERE id = v_existing_record_id;
                        ELSE
                            -- Closed record exists - reactivate it for the renewal
                            UPDATE participant_medicare_plan_rates
                            SET 
                                start_date = v_renewal_date,
                                end_date = NULL
                            WHERE id = v_existing_record_id;
                        END IF;
                END;
            ELSE
                -- Rate record already exists for this renewal date - update it instead of creating duplicate
                UPDATE participant_medicare_plan_rates
                SET end_date = NULL
                WHERE id = v_existing_record_id;
            END IF;
            
            -- Update the participant_medicare_plans record to connect to the new rate
            UPDATE participant_medicare_plans
            SET medicare_child_rate_id = v_medicare_child_rate_id,
                updated_at = NOW()
            WHERE id = v_participant_plan.id;
            
        END LOOP; -- End participant_medicare_plan loop
        
    END LOOP; -- End plan loop
    
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to automatically run the automation when a Medicare renewal is created
CREATE OR REPLACE FUNCTION trigger_medicare_renewal_automation()
RETURNS TRIGGER AS $$
BEGIN
    -- Run the automation for the new renewal
    PERFORM process_medicare_renewal_automation(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on medicare_renewals table
DROP TRIGGER IF EXISTS medicare_renewal_automation_trigger ON medicare_renewals;
CREATE TRIGGER medicare_renewal_automation_trigger
    AFTER INSERT ON medicare_renewals
    FOR EACH ROW
    EXECUTE FUNCTION trigger_medicare_renewal_automation();

-- Add comments
COMMENT ON FUNCTION process_medicare_renewal_automation IS 'Processes Medicare renewal automation: ends active rates in participant_medicare_plan_rates and creates new rate records for all active participants';
COMMENT ON TABLE medicare_renewals IS 'Stores Medicare renewal records with renewal dates';
COMMENT ON TABLE renewal_medicare_plans IS 'Junction table linking Medicare renewals to Medicare plans';

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE medicare_renewals ENABLE ROW LEVEL SECURITY;
ALTER TABLE renewal_medicare_plans ENABLE ROW LEVEL SECURITY;

-- Allow all operations (adjust as needed for your security requirements)
CREATE POLICY "Allow all operations on medicare_renewals" 
    ON medicare_renewals FOR ALL 
    USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on renewal_medicare_plans" 
    ON renewal_medicare_plans FOR ALL 
    USING (true) WITH CHECK (true);

