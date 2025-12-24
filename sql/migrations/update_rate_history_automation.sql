-- Migration: Update rate history automation to populate new fields and create history on plan option/plan updates
-- Date: 2025-01-XX
-- Description: Updates automation to create rate history records with all relevant fields when plan options or plans are updated

-- Function to populate rate history fields from plan option and plan data
CREATE OR REPLACE FUNCTION populate_rate_history_fields()
RETURNS TRIGGER AS $$
DECLARE
    plan_option_record RECORD;
    plan_record RECORD;
    normalized_contribution_type VARCHAR(50);
BEGIN
    -- Get plan option data
    SELECT * INTO plan_option_record
    FROM group_plan_options
    WHERE id = NEW.group_plan_option_id;
    
    -- Get plan data
    SELECT * INTO plan_record
    FROM group_plans
    WHERE id = plan_option_record.group_plan_id;
    
    -- Populate employer contribution type (prefer plan option, fallback to plan)
    IF plan_option_record.employer_contribution_type IS NOT NULL THEN
        normalized_contribution_type := plan_option_record.employer_contribution_type;
    ELSIF plan_record.employer_contribution_type IS NOT NULL THEN
        -- Normalize 'Dollar Amount' to 'Dollar' for consistency
        IF plan_record.employer_contribution_type = 'Dollar Amount' THEN
            normalized_contribution_type := 'Dollar';
        ELSE
            normalized_contribution_type := plan_record.employer_contribution_type;
        END IF;
    END IF;
    
    -- Populate fields from plan option
    NEW.employer_contribution_type := normalized_contribution_type;
    NEW.class_1_contribution_amount := plan_option_record.class_1_contribution_amount;
    NEW.class_2_contribution_amount := plan_option_record.class_2_contribution_amount;
    NEW.class_3_contribution_amount := plan_option_record.class_3_contribution_amount;
    
    -- Populate fields from plan (for Age Banded plans)
    NEW.employer_employee_contribution_value := plan_record.employer_contribution_value;
    NEW.employer_spouse_contribution_value := plan_record.employer_spouse_contribution_value;
    NEW.employer_child_contribution_value := plan_record.employer_child_contribution_value;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Updated function to handle group option rate dates AND populate history fields
CREATE OR REPLACE FUNCTION handle_group_option_rate_dates()
RETURNS TRIGGER AS $$
DECLARE
    plan_effective_date DATE;
    has_previous_rates BOOLEAN;
    new_start_date DATE;
    plan_option_record RECORD;
    plan_record RECORD;
    normalized_contribution_type VARCHAR(50);
BEGIN
    -- If this is a new rate (INSERT)
    IF TG_OP = 'INSERT' THEN
        -- Get the plan's effective date
        SELECT gp.effective_date INTO plan_effective_date
        FROM group_plans gp
        JOIN group_plan_options gpo ON gpo.group_plan_id = gp.id
        WHERE gpo.id = NEW.group_plan_option_id;
        
        -- Get plan option data for populating history fields
        SELECT * INTO plan_option_record
        FROM group_plan_options
        WHERE id = NEW.group_plan_option_id;
        
        -- Get plan data for populating history fields
        SELECT * INTO plan_record
        FROM group_plans
        WHERE id = plan_option_record.group_plan_id;
        
        -- Populate employer contribution type (prefer plan option, fallback to plan)
        IF plan_option_record.employer_contribution_type IS NOT NULL THEN
            normalized_contribution_type := plan_option_record.employer_contribution_type;
        ELSIF plan_record.employer_contribution_type IS NOT NULL THEN
            -- Normalize 'Dollar Amount' to 'Dollar' for consistency
            IF plan_record.employer_contribution_type = 'Dollar Amount' THEN
                normalized_contribution_type := 'Dollar';
            ELSE
                normalized_contribution_type := plan_record.employer_contribution_type;
            END IF;
        END IF;
        
        -- Populate rate history fields
        NEW.employer_contribution_type := normalized_contribution_type;
        NEW.class_1_contribution_amount := plan_option_record.class_1_contribution_amount;
        NEW.class_2_contribution_amount := plan_option_record.class_2_contribution_amount;
        NEW.class_3_contribution_amount := plan_option_record.class_3_contribution_amount;
        NEW.employer_employee_contribution_value := plan_record.employer_contribution_value;
        NEW.employer_spouse_contribution_value := plan_record.employer_spouse_contribution_value;
        NEW.employer_child_contribution_value := plan_record.employer_child_contribution_value;
        
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

-- Function to create new rate history record when plan option fields are updated
CREATE OR REPLACE FUNCTION create_rate_history_on_plan_option_update()
RETURNS TRIGGER AS $$
DECLARE
    current_rate_id UUID;
    current_rate RECORD;
    new_start_date DATE;
    plan_record RECORD;
    normalized_contribution_type VARCHAR(50);
BEGIN
    -- Check if any relevant fields have changed
    IF (
        OLD.employer_contribution_type IS DISTINCT FROM NEW.employer_contribution_type OR
        OLD.class_1_contribution_amount IS DISTINCT FROM NEW.class_1_contribution_amount OR
        OLD.class_2_contribution_amount IS DISTINCT FROM NEW.class_2_contribution_amount OR
        OLD.class_3_contribution_amount IS DISTINCT FROM NEW.class_3_contribution_amount
    ) THEN
        -- Find the current active rate (end_date IS NULL or end_date >= CURRENT_DATE)
        SELECT id INTO current_rate_id
        FROM group_option_rates
        WHERE group_plan_option_id = NEW.id
          AND (end_date IS NULL OR end_date >= CURRENT_DATE)
        ORDER BY start_date DESC
        LIMIT 1;
        
        -- If there's an active rate, create a new one
        IF current_rate_id IS NOT NULL THEN
            -- Get the current rate details
            SELECT * INTO current_rate
            FROM group_option_rates
            WHERE id = current_rate_id;
            
            -- Get plan data
            SELECT * INTO plan_record
            FROM group_plans
            WHERE id = NEW.group_plan_id;
            
            -- Set new start date to today
            new_start_date := CURRENT_DATE;
            
            -- Close the previous rate (set end_date to day before new rate)
            UPDATE group_option_rates
            SET end_date = new_start_date - INTERVAL '1 day',
                updated_at = NOW()
            WHERE id = current_rate_id;
            
            -- Populate employer contribution type
            IF NEW.employer_contribution_type IS NOT NULL THEN
                normalized_contribution_type := NEW.employer_contribution_type;
            ELSIF plan_record.employer_contribution_type IS NOT NULL THEN
                IF plan_record.employer_contribution_type = 'Dollar Amount' THEN
                    normalized_contribution_type := 'Dollar';
                ELSE
                    normalized_contribution_type := plan_record.employer_contribution_type;
                END IF;
            END IF;
            
            -- Create new rate history record with updated values
            INSERT INTO group_option_rates (
                group_plan_option_id,
                rate,
                start_date,
                end_date,
                employer_contribution_type,
                class_1_contribution_amount,
                class_2_contribution_amount,
                class_3_contribution_amount,
                employer_employee_contribution_value,
                employer_spouse_contribution_value,
                employer_child_contribution_value
            ) VALUES (
                NEW.id,
                current_rate.rate, -- Keep the same rate
                new_start_date,
                NULL, -- New active rate
                normalized_contribution_type,
                NEW.class_1_contribution_amount,
                NEW.class_2_contribution_amount,
                NEW.class_3_contribution_amount,
                plan_record.employer_contribution_value,
                plan_record.employer_spouse_contribution_value,
                plan_record.employer_child_contribution_value
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to create new rate history record when Age Banded plan fields are updated
CREATE OR REPLACE FUNCTION create_rate_history_on_age_banded_plan_update()
RETURNS TRIGGER AS $$
DECLARE
    plan_option_record RECORD;
    current_rate_id UUID;
    current_rate RECORD;
    new_start_date DATE;
    normalized_contribution_type VARCHAR(50);
    rate_created BOOLEAN := FALSE;
BEGIN
    -- Only process if plan type is 'Age Banded'
    IF NEW.plan_type = 'Age Banded' THEN
        -- Check if any relevant fields have changed
        IF (
            OLD.employer_contribution_type IS DISTINCT FROM NEW.employer_contribution_type OR
            OLD.employer_contribution_value IS DISTINCT FROM NEW.employer_contribution_value OR
            OLD.employer_spouse_contribution_value IS DISTINCT FROM NEW.employer_spouse_contribution_value OR
            OLD.employer_child_contribution_value IS DISTINCT FROM NEW.employer_child_contribution_value
        ) THEN
            -- Loop through all plan options for this plan
            FOR plan_option_record IN
                SELECT * FROM group_plan_options
                WHERE group_plan_id = NEW.id
            LOOP
                -- Find the current active rate for this option
                SELECT id INTO current_rate_id
                FROM group_option_rates
                WHERE group_plan_option_id = plan_option_record.id
                  AND (end_date IS NULL OR end_date >= CURRENT_DATE)
                ORDER BY start_date DESC
                LIMIT 1;
                
                -- If there's an active rate, create a new one
                IF current_rate_id IS NOT NULL THEN
                    -- Get the current rate details
                    SELECT * INTO current_rate
                    FROM group_option_rates
                    WHERE id = current_rate_id;
                    
                    -- Set new start date to today
                    new_start_date := CURRENT_DATE;
                    
                    -- Close the previous rate (set end_date to day before new rate)
                    UPDATE group_option_rates
                    SET end_date = new_start_date - INTERVAL '1 day',
                        updated_at = NOW()
                    WHERE id = current_rate_id;
                    
                    -- Populate employer contribution type
                    IF plan_option_record.employer_contribution_type IS NOT NULL THEN
                        normalized_contribution_type := plan_option_record.employer_contribution_type;
                    ELSIF NEW.employer_contribution_type IS NOT NULL THEN
                        IF NEW.employer_contribution_type = 'Dollar Amount' THEN
                            normalized_contribution_type := 'Dollar';
                        ELSE
                            normalized_contribution_type := NEW.employer_contribution_type;
                        END IF;
                    END IF;
                    
                    -- Create new rate history record with updated values
                    INSERT INTO group_option_rates (
                        group_plan_option_id,
                        rate,
                        start_date,
                        end_date,
                        employer_contribution_type,
                        class_1_contribution_amount,
                        class_2_contribution_amount,
                        class_3_contribution_amount,
                        employer_employee_contribution_value,
                        employer_spouse_contribution_value,
                        employer_child_contribution_value
                    ) VALUES (
                        plan_option_record.id,
                        current_rate.rate, -- Keep the same rate
                        new_start_date,
                        NULL, -- New active rate
                        normalized_contribution_type,
                        plan_option_record.class_1_contribution_amount,
                        plan_option_record.class_2_contribution_amount,
                        plan_option_record.class_3_contribution_amount,
                        NEW.employer_contribution_value,
                        NEW.employer_spouse_contribution_value,
                        NEW.employer_child_contribution_value
                    );
                    
                    rate_created := TRUE;
                END IF;
            END LOOP;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Update the trigger to also populate history fields
DROP TRIGGER IF EXISTS handle_group_option_rate_dates_trigger ON group_option_rates;
CREATE TRIGGER handle_group_option_rate_dates_trigger
    BEFORE INSERT ON group_option_rates
    FOR EACH ROW EXECUTE FUNCTION handle_group_option_rate_dates();

-- Create trigger for plan option updates
DROP TRIGGER IF EXISTS create_rate_history_on_plan_option_update_trigger ON group_plan_options;
CREATE TRIGGER create_rate_history_on_plan_option_update_trigger
    AFTER UPDATE ON group_plan_options
    FOR EACH ROW EXECUTE FUNCTION create_rate_history_on_plan_option_update();

-- Create trigger for Age Banded plan updates
DROP TRIGGER IF EXISTS create_rate_history_on_age_banded_plan_update_trigger ON group_plans;
CREATE TRIGGER create_rate_history_on_age_banded_plan_update_trigger
    AFTER UPDATE ON group_plans
    FOR EACH ROW EXECUTE FUNCTION create_rate_history_on_age_banded_plan_update();

