-- Migration: Fix trigger to close ALL active rates when a new rate is added
-- Date: 2025-01-XX
-- Description: Updates handle_group_option_rate_dates() and handle_medicare_child_rate_dates() 
--              to close all active rates (end_date IS NULL) instead of just the most recent one
--              Note: Uses medicare_child_rates table (not medicare_rates)

-- Updated function to handle group option rate dates - closes ALL active rates
CREATE OR REPLACE FUNCTION handle_group_option_rate_dates()
RETURNS TRIGGER AS $$
DECLARE
    plan_effective_date DATE;
    has_previous_rates BOOLEAN;
    new_start_date DATE;
BEGIN
    -- If this is a new rate (INSERT)
    IF TG_OP = 'INSERT' THEN
        -- Get the plan's effective date
        SELECT gp.effective_date INTO plan_effective_date
        FROM group_plans gp
        JOIN group_plan_options gpo ON gpo.group_plan_id = gp.id
        WHERE gpo.id = NEW.group_plan_option_id;
        
        -- Check if there are any previous rates for this option
        SELECT EXISTS(
            SELECT 1
            FROM group_option_rates
            WHERE group_plan_option_id = NEW.group_plan_option_id
              AND id != NEW.id
        ) INTO has_previous_rates;
        
        -- If no previous rate exists, set start_date to plan effective date
        IF NOT has_previous_rates THEN
            NEW.start_date = COALESCE(NEW.start_date, plan_effective_date);
        ELSE
            -- Set start_date to today if not provided
            IF NEW.start_date IS NULL THEN
                NEW.start_date = CURRENT_DATE;
            END IF;
            
            -- Store the new start date for use in the UPDATE
            new_start_date := NEW.start_date;
            
            -- Close ALL active rates (where end_date IS NULL) for this option
            -- Set their end_date to day before new rate's start_date
            UPDATE group_option_rates
            SET end_date = new_start_date - INTERVAL '1 day',
                updated_at = NOW()
            WHERE group_plan_option_id = NEW.group_plan_option_id
              AND id != NEW.id
              AND end_date IS NULL;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Updated function to handle medicare child rate dates - closes ALL active rates
-- Note: Uses medicare_child_rates table (not medicare_rates)
CREATE OR REPLACE FUNCTION handle_medicare_child_rate_dates()
RETURNS TRIGGER AS $$
DECLARE
    has_previous_rates BOOLEAN;
    new_start_date DATE;
BEGIN
    -- If this is a new rate (INSERT)
    IF TG_OP = 'INSERT' THEN
        -- Check if there are any previous rates for this plan
        SELECT EXISTS(
            SELECT 1
            FROM medicare_child_rates
            WHERE medicare_plan_id = NEW.medicare_plan_id
              AND id != NEW.id
        ) INTO has_previous_rates;
        
        -- Set start_date to today if not provided
        IF NEW.start_date IS NULL THEN
            NEW.start_date = CURRENT_DATE;
        END IF;
        
        -- If there are previous rates, close ALL active rates
        IF has_previous_rates THEN
            -- Store the new start date for use in the UPDATE
            new_start_date := NEW.start_date;
            
            -- Close ALL active rates (where end_date IS NULL) for this plan
            -- Set their end_date to day before new rate's start_date
            UPDATE medicare_child_rates
            SET end_date = new_start_date - INTERVAL '1 day',
                updated_at = NOW()
            WHERE medicare_plan_id = NEW.medicare_plan_id
              AND id != NEW.id
              AND end_date IS NULL;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- The triggers should already exist, but we'll ensure they're properly set up
DROP TRIGGER IF EXISTS handle_group_option_rate_dates_trigger ON group_option_rates;
CREATE TRIGGER handle_group_option_rate_dates_trigger
    BEFORE INSERT ON group_option_rates
    FOR EACH ROW EXECUTE FUNCTION handle_group_option_rate_dates();

-- Drop old trigger on medicare_rates if it exists (for backward compatibility)
DROP TRIGGER IF EXISTS handle_medicare_rate_dates_trigger ON medicare_rates;

-- Create trigger on medicare_child_rates table
DROP TRIGGER IF EXISTS handle_medicare_child_rate_dates_trigger ON medicare_child_rates;
CREATE TRIGGER handle_medicare_child_rate_dates_trigger
    BEFORE INSERT ON medicare_child_rates
    FOR EACH ROW EXECUTE FUNCTION handle_medicare_child_rate_dates();

