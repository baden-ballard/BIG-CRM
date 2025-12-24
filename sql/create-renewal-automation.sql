-- Renewal Automation
-- This automation runs when a renewal is created and:
-- 1. Finds all active participants for the group on plans that are renewing
-- 2. For each participant (and their dependents), finds the correct rate based on renewal date
-- 3. Ends active participant_group_plan_rates records (sets end_date to day before renewal date)
-- 4. Creates new participant_group_plan_rates records with the new rate

-- Helper function to calculate age as of a specific date
CREATE OR REPLACE FUNCTION calculate_age_as_of(dob DATE, as_of_date DATE)
RETURNS INTEGER AS $$
BEGIN
  IF dob IS NULL OR as_of_date IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN EXTRACT(YEAR FROM age(as_of_date, dob))::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper function to find matching age option for Age Banded plans
-- Returns the group_plan_option_id that matches the age
-- Round down if age is over highest option, round up if under lowest option
CREATE OR REPLACE FUNCTION find_matching_age_option(
  p_age INTEGER,
  p_group_plan_id UUID,
  p_renewal_date DATE
)
RETURNS UUID AS $$
DECLARE
  v_option_id UUID;
  v_option_age INTEGER;
  v_lowest_option_id UUID;
  v_highest_option_id UUID;
  v_lowest_age INTEGER := 999;
  v_highest_age INTEGER := -1;
BEGIN
  -- Get all options for this plan
  FOR v_option_id, v_option_age IN
    SELECT 
      gpo.id,
      CASE 
        WHEN gpo.option ~ '^[0-9]+$' THEN gpo.option::INTEGER
        ELSE NULL
      END
    FROM group_plan_options gpo
    WHERE gpo.group_plan_id = p_group_plan_id
      AND gpo.option ~ '^[0-9]+$'  -- Only numeric options (age bands)
  LOOP
    IF v_option_age IS NOT NULL THEN
      -- Track lowest and highest ages
      IF v_option_age < v_lowest_age THEN
        v_lowest_age := v_option_age;
        v_lowest_option_id := v_option_id;
      END IF;
      IF v_option_age > v_highest_age THEN
        v_highest_age := v_option_age;
        v_highest_option_id := v_option_id;
      END IF;
      
      -- Try exact match first
      IF v_option_age = p_age THEN
        RETURN v_option_id;
      END IF;
    END IF;
  END LOOP;
  
  -- If age is over highest option, round down to highest
  IF p_age > v_highest_age AND v_highest_option_id IS NOT NULL THEN
    RETURN v_highest_option_id;
  END IF;
  
  -- If age is under lowest option, round up to lowest
  IF p_age < v_lowest_age AND v_lowest_option_id IS NOT NULL THEN
    RETURN v_lowest_option_id;
  END IF;
  
  -- Find the highest age band that the person fits into (round down)
  FOR v_option_id, v_option_age IN
    SELECT 
      gpo.id,
      gpo.option::INTEGER
    FROM group_plan_options gpo
    WHERE gpo.group_plan_id = p_group_plan_id
      AND gpo.option ~ '^[0-9]+$'
      AND gpo.option::INTEGER <= p_age
    ORDER BY gpo.option::INTEGER DESC
    LIMIT 1
  LOOP
    RETURN v_option_id;
  END LOOP;
  
  -- If no match found, return lowest option
  RETURN v_lowest_option_id;
END;
$$ LANGUAGE plpgsql;

-- Main function to process renewal automation
CREATE OR REPLACE FUNCTION process_renewal_automation(p_renewal_id UUID)
RETURNS void AS $$
DECLARE
  v_renewal RECORD;
  v_group_id UUID;
  v_renewal_date DATE;
  v_plan RECORD;
  v_participant_plan RECORD;
  v_participant RECORD;
  v_dependent RECORD;
  v_group_plan RECORD;
  v_group_plan_option_id UUID;
  v_group_option_rate_id UUID;
  v_age INTEGER;
  v_dob DATE;
  v_employer_contribution_type VARCHAR;
  v_employer_contribution_amount DECIMAL;
  v_day_before_renewal DATE;
  v_existing_record_id UUID;
  v_existing_end_date DATE;
  v_rate DECIMAL;
  v_contribution_value DECIMAL;
  v_rate_record RECORD;
  v_plan_count INTEGER := 0;
  v_participant_count INTEGER := 0;
  v_record_created_count INTEGER := 0;
  v_total_before_distinct INTEGER;
  v_rate_count INTEGER;
  v_existing_count INTEGER;
  v_existing_for_renewal_date INTEGER;
BEGIN
  -- HYPOTHESIS D: Track function calls to detect multiple invocations
  RAISE NOTICE 'DEBUG HYPOTHESIS D: process_renewal_automation CALLED with renewal_id=%, timestamp=%', 
    p_renewal_id, NOW();
  
  -- Also log to renewal_debug_logs table if function exists
  BEGIN
    PERFORM log_renewal_debug(p_renewal_id, 'HYPOTHESIS D: Function called', 
      jsonb_build_object('renewal_id', p_renewal_id, 'timestamp', NOW()));
  EXCEPTION WHEN OTHERS THEN
    -- Function might not exist, ignore
    NULL;
  END;
  
  -- Get renewal details
  SELECT r.id, r.group_id, r.renewal_date
  INTO v_renewal
  FROM renewals r
  WHERE r.id = p_renewal_id;
  
  IF v_renewal.id IS NULL THEN
    RAISE EXCEPTION 'Renewal not found: %', p_renewal_id;
  END IF;
  
  RAISE NOTICE 'DEBUG: Found renewal - id=%, group_id=%, renewal_date=%', 
    v_renewal.id, v_renewal.group_id, v_renewal.renewal_date;
  
  v_group_id := v_renewal.group_id;
  v_renewal_date := v_renewal.renewal_date;
  v_day_before_renewal := v_renewal_date - 1;
  
  -- Process each plan in the renewal
  FOR v_plan IN
    SELECT rgp.group_plan_id
    FROM renewal_group_plans rgp
    WHERE rgp.renewal_id = p_renewal_id
  LOOP
    v_plan_count := v_plan_count + 1;
    RAISE NOTICE 'DEBUG: Processing plan % - group_plan_id=%', v_plan_count, v_plan.group_plan_id;
    -- Get plan details
    SELECT gp.*
    INTO v_group_plan
    FROM group_plans gp
    WHERE gp.id = v_plan.group_plan_id;
    
    IF v_group_plan.id IS NULL THEN
      RAISE WARNING 'DEBUG: Plan not found for group_plan_id=%', v_plan.group_plan_id;
      CONTINUE; -- Skip if plan not found
    END IF;
    
    RAISE NOTICE 'DEBUG: Found plan - id=%, plan_name=%, plan_type=%', 
      v_group_plan.id, v_group_plan.plan_name, v_group_plan.plan_type;
    
    -- Count total participant_group_plans BEFORE DISTINCT ON (HYPOTHESIS A, B)
    SELECT COUNT(*)
    INTO v_total_before_distinct
    FROM participant_group_plans pgp
    INNER JOIN participants p ON p.id = pgp.participant_id
    LEFT JOIN dependents d ON d.id = pgp.dependent_id
    WHERE pgp.group_plan_id = v_plan.group_plan_id
      AND p.group_id = v_group_id
      AND (p.hire_date IS NULL OR p.hire_date <= v_renewal_date)
      AND (p.termination_date IS NULL OR p.termination_date >= v_renewal_date)
      AND (pgp.termination_date IS NULL OR pgp.termination_date >= v_renewal_date);
    
    RAISE NOTICE 'DEBUG HYPOTHESIS A/B: Found % total participant_group_plans BEFORE DISTINCT ON for plan %', 
      v_total_before_distinct, v_plan.group_plan_id;
    
    -- Process each participant_group_plan record for this plan
    -- Use DISTINCT ON to ensure we only process ONE record per participant/dependent combination
    -- This ensures we only create ONE rate record per participant or dependent
    FOR v_participant_plan IN
      SELECT DISTINCT ON (pgp.participant_id, COALESCE(pgp.dependent_id, '00000000-0000-0000-0000-000000000000'::UUID))
        pgp.*,
        p.dob as participant_dob,
        p.hire_date,
        p.termination_date as participant_termination_date,
        p.class_number,
        d.id as dependent_id,
        d.dob as dependent_dob,
        d.relationship
      FROM participant_group_plans pgp
      INNER JOIN participants p ON p.id = pgp.participant_id
      LEFT JOIN dependents d ON d.id = pgp.dependent_id
      WHERE pgp.group_plan_id = v_plan.group_plan_id
        AND p.group_id = v_group_id
        -- Check if participant is active on renewal date
        AND (p.hire_date IS NULL OR p.hire_date <= v_renewal_date)
        AND (p.termination_date IS NULL OR p.termination_date >= v_renewal_date)
        -- Check if participant_group_plan is active
        AND (pgp.termination_date IS NULL OR pgp.termination_date >= v_renewal_date)
      -- Order by created_at DESC to get the most recent record if duplicates exist
      ORDER BY pgp.participant_id, COALESCE(pgp.dependent_id, '00000000-0000-0000-0000-000000000000'::UUID), pgp.created_at DESC
    LOOP
      v_participant_count := v_participant_count + 1;
      RAISE NOTICE 'DEBUG HYPOTHESIS A/B/C: Processing participant % - participant_id=%, dependent_id=%, participant_group_plan_id=%, plan_id=%', 
        v_participant_count, v_participant_plan.participant_id, v_participant_plan.dependent_id, v_participant_plan.id, v_plan.group_plan_id;
      
      -- HYPOTHESIS E: Track if this participant_group_plan_id was already processed
      SELECT COUNT(*)
      INTO v_already_processed_count
      FROM participant_group_plan_rates
      WHERE participant_group_plan_id = v_participant_plan.id
        AND start_date = v_renewal_date;
      
      IF v_already_processed_count > 0 THEN
        RAISE WARNING 'DEBUG HYPOTHESIS E: participant_group_plan_id=% ALREADY HAS % rate record(s) with start_date=% - THIS IS A DUPLICATE!', 
          v_participant_plan.id, v_already_processed_count, v_renewal_date;
      END IF;
      
      -- Reset variables for this iteration
      v_existing_record_id := NULL;
      v_existing_end_date := NULL;
      
      -- Determine DOB and relationship for age calculation
      IF v_participant_plan.dependent_id IS NOT NULL THEN
        -- This is a dependent
        v_dob := v_participant_plan.dependent_dob;
      ELSE
        -- This is the employee
        v_dob := v_participant_plan.participant_dob;
      END IF;
      
      -- For Age Banded plans, find the correct option based on age as of renewal date
      IF v_group_plan.plan_type = 'Age Banded' THEN
        IF v_dob IS NULL THEN
          RAISE WARNING 'Participant or dependent % has no DOB for Age Banded plan %', 
            COALESCE(v_participant_plan.dependent_id::TEXT, v_participant_plan.participant_id::TEXT),
            v_group_plan.id;
          CONTINUE; -- Skip this record
        END IF;
        
        -- Calculate age as of renewal date
        v_age := calculate_age_as_of(v_dob, v_renewal_date);
        
        IF v_age IS NULL THEN
          CONTINUE; -- Skip if age calculation failed
        END IF;
        
        -- Find matching age option
        v_group_plan_option_id := find_matching_age_option(v_age, v_group_plan.id, v_renewal_date);
        
        IF v_group_plan_option_id IS NULL THEN
          RAISE WARNING 'No matching age option found for age % on plan %', v_age, v_group_plan.id;
          CONTINUE; -- Skip this record
        END IF;
      ELSE
        -- For non-Age Banded plans, use the existing option
        v_group_plan_option_id := v_participant_plan.group_plan_option_id;
      END IF;
      
      -- Find the correct rate for this option on the renewal date
      -- Also get all contribution data from the rate history record (group_option_rates)
      -- HYPOTHESIS C: Check if multiple rates are active during renewal period
      SELECT COUNT(*)
      INTO v_rate_count
      FROM group_option_rates gor
      WHERE gor.group_plan_option_id = v_group_plan_option_id
        AND gor.start_date <= v_renewal_date
        AND (gor.end_date IS NULL OR gor.end_date >= v_renewal_date);
      
      RAISE NOTICE 'DEBUG HYPOTHESIS C: Found % active rates for option % on renewal date %', 
        v_rate_count, v_group_plan_option_id, v_renewal_date;
      
      SELECT 
        gor.id,
        gor.rate,
        gor.employer_contribution_type,
        gor.class_1_contribution_amount,
        gor.class_2_contribution_amount,
        gor.class_3_contribution_amount,
        gor.employer_employee_contribution_value,
        gor.employer_spouse_contribution_value,
        gor.employer_child_contribution_value
      INTO v_rate_record
      FROM group_option_rates gor
      WHERE gor.group_plan_option_id = v_group_plan_option_id
        AND gor.start_date <= v_renewal_date
        AND (gor.end_date IS NULL OR gor.end_date >= v_renewal_date)
      ORDER BY gor.start_date DESC
      LIMIT 1;
      
      IF v_rate_record.id IS NULL THEN
        RAISE WARNING 'No rate found for option % on renewal date %', 
          v_group_plan_option_id, v_renewal_date;
        CONTINUE; -- Skip this record
      END IF;
      
      v_group_option_rate_id := v_rate_record.id;
      v_rate := v_rate_record.rate;
      
      RAISE NOTICE 'DEBUG HYPOTHESIS C: Selected rate_id=% for participant_group_plan_id=%', 
        v_group_option_rate_id, v_participant_plan.id;
      
      -- ALWAYS use contribution type from the rate history record (group_option_rates)
      v_employer_contribution_type := v_rate_record.employer_contribution_type;
      
      -- Debug logging: Log rate history contribution type
      RAISE NOTICE 'DEBUG: participant_group_plan_id=%, plan_type=%, rate_id=%, contribution_type_from_rate_history=%', 
        v_participant_plan.id, v_group_plan.plan_type, v_rate_record.id, v_rate_record.employer_contribution_type;
      
      -- Determine contribution value based on plan type and relationship/class
      IF v_group_plan.plan_type = 'Composite' THEN
        -- For Composite plans: use class contribution amounts from rate history based on participant's class_number
        IF v_participant_plan.class_number = 1 THEN
          v_contribution_value := v_rate_record.class_1_contribution_amount;
          RAISE NOTICE 'DEBUG: Composite plan - using class 1 contribution: %', v_rate_record.class_1_contribution_amount;
        ELSIF v_participant_plan.class_number = 2 THEN
          v_contribution_value := v_rate_record.class_2_contribution_amount;
          RAISE NOTICE 'DEBUG: Composite plan - using class 2 contribution: %', v_rate_record.class_2_contribution_amount;
        ELSIF v_participant_plan.class_number = 3 THEN
          v_contribution_value := v_rate_record.class_3_contribution_amount;
          RAISE NOTICE 'DEBUG: Composite plan - using class 3 contribution: %', v_rate_record.class_3_contribution_amount;
        ELSE
          -- Default to class 1 if class_number is NULL or invalid
          v_contribution_value := v_rate_record.class_1_contribution_amount;
          RAISE NOTICE 'DEBUG: Composite plan - class_number is % (NULL/invalid), defaulting to class 1 contribution: %', 
            v_participant_plan.class_number, v_rate_record.class_1_contribution_amount;
        END IF;
      ELSIF v_group_plan.plan_type = 'Age Banded' THEN
        -- For Age Banded plans: use relationship-based contribution values from rate history
        IF v_participant_plan.dependent_id IS NULL THEN
          -- Employee
          v_contribution_value := v_rate_record.employer_employee_contribution_value;
          RAISE NOTICE 'DEBUG: Age Banded plan - Employee, using employee contribution: %', v_rate_record.employer_employee_contribution_value;
        ELSIF v_participant_plan.relationship = 'Spouse' THEN
          -- Spouse
          v_contribution_value := v_rate_record.employer_spouse_contribution_value;
          RAISE NOTICE 'DEBUG: Age Banded plan - Spouse, using spouse contribution: %', v_rate_record.employer_spouse_contribution_value;
        ELSIF v_participant_plan.relationship = 'Child' THEN
          -- Child
          v_contribution_value := v_rate_record.employer_child_contribution_value;
          RAISE NOTICE 'DEBUG: Age Banded plan - Child, using child contribution: %', v_rate_record.employer_child_contribution_value;
        ELSE
          -- Default to employee contribution
          v_contribution_value := v_rate_record.employer_employee_contribution_value;
          RAISE NOTICE 'DEBUG: Age Banded plan - Unknown relationship, defaulting to employee contribution: %', v_rate_record.employer_employee_contribution_value;
        END IF;
      ELSE
        -- Fallback: use employee contribution value from rate history
        v_contribution_value := v_rate_record.employer_employee_contribution_value;
      END IF;
      
      -- Calculate actual dollar amount based on contribution type
      -- employer_contribution_amount should always be the dollar amount, not the percentage value
      -- Note: contribution type may be 'Dollar' (normalized) or 'Dollar Amount' (from group_plans)
      IF v_employer_contribution_type = 'Percentage' AND v_contribution_value IS NOT NULL AND v_rate IS NOT NULL THEN
        v_employer_contribution_amount := v_rate * (v_contribution_value / 100);
        RAISE NOTICE 'DEBUG: Calculated contribution amount: rate=% * (contribution_value=% / 100) = %', 
          v_rate, v_contribution_value, v_employer_contribution_amount;
      ELSIF (v_employer_contribution_type = 'Dollar Amount' OR v_employer_contribution_type = 'Dollar') AND v_contribution_value IS NOT NULL THEN
        v_employer_contribution_amount := v_contribution_value;
        RAISE NOTICE 'DEBUG: Using dollar amount contribution: %', v_employer_contribution_amount;
      ELSE
        v_employer_contribution_amount := NULL;
        RAISE WARNING 'DEBUG: Could not calculate contribution amount - type=%, value=%, rate=%', 
          v_employer_contribution_type, v_contribution_value, v_rate;
      END IF;
      
      RAISE NOTICE 'DEBUG: Final values - contribution_type=%, contribution_amount=%, participant_group_plan_id=%', 
        v_employer_contribution_type, v_employer_contribution_amount, v_participant_plan.id;
      
      -- End all active participant_group_plan_rates records for this participant_group_plan
      -- Only update records that are currently active (end_date IS NULL)
      -- This ensures we preserve history by closing old records
      UPDATE participant_group_plan_rates
      SET end_date = v_day_before_renewal
      WHERE participant_group_plan_id = v_participant_plan.id
        AND end_date IS NULL;
      
      -- HYPOTHESIS D/E: Check for existing rate records BEFORE creating new one
      SELECT COUNT(*)
      INTO v_existing_count
      FROM participant_group_plan_rates
      WHERE participant_group_plan_id = v_participant_plan.id
        AND group_option_rate_id = v_group_option_rate_id;
      
      SELECT COUNT(*)
      INTO v_existing_for_renewal_date
      FROM participant_group_plan_rates
      WHERE participant_group_plan_id = v_participant_plan.id
        AND start_date = v_renewal_date;
      
      RAISE NOTICE 'DEBUG HYPOTHESIS D/E: participant_group_plan_id=% has % existing rate records with rate_id=%, % records with start_date=%', 
        v_participant_plan.id, v_existing_count, v_group_option_rate_id, v_existing_for_renewal_date, v_renewal_date;
      
      -- Check if a rate record already exists for this renewal date
      -- This prevents creating duplicate records if the renewal is run multiple times
      SELECT id, end_date
      INTO v_existing_record_id, v_existing_end_date
      FROM participant_group_plan_rates
      WHERE participant_group_plan_id = v_participant_plan.id
        AND group_option_rate_id = v_group_option_rate_id
        AND start_date = v_renewal_date;
      
      -- Only create a new record if one doesn't already exist for this renewal date
      IF v_existing_record_id IS NULL THEN
        -- Always try to create a new record for the renewal
        -- This preserves the history of rate changes
        -- If a record with the same rate already exists (due to unique constraint),
        -- we'll handle it gracefully, but normally renewals should use different rates
        BEGIN
          INSERT INTO participant_group_plan_rates (
            participant_group_plan_id,
            group_option_rate_id,
            employer_contribution_type,
            employer_contribution_amount,
            start_date,
            end_date
          ) VALUES (
            v_participant_plan.id,
            v_group_option_rate_id,
            v_employer_contribution_type,
            v_employer_contribution_amount,
            v_renewal_date,
            NULL
          );
          
          v_record_created_count := v_record_created_count + 1;
          RAISE NOTICE 'DEBUG HYPOTHESIS D/E: CREATED new participant_group_plan_rates record - participant_group_plan_id=%, group_option_rate_id=%, start_date=%', 
            v_participant_plan.id, v_group_option_rate_id, v_renewal_date;
      EXCEPTION
        WHEN unique_violation THEN
          -- A record with this exact rate already exists (shouldn't happen in normal renewals)
          -- Check if it's closed - if so, reactivate it; if active, update it
          SELECT id, end_date
          INTO v_existing_record_id, v_existing_end_date
          FROM participant_group_plan_rates
          WHERE participant_group_plan_id = v_participant_plan.id
            AND group_option_rate_id = v_group_option_rate_id
          LIMIT 1;
          
          IF v_existing_end_date IS NULL THEN
            -- Active record exists - we should have closed it above, but update it anyway
            RAISE WARNING 'Active record with same rate already exists for participant_group_plan % with rate %. Updating existing record instead of creating new one.', 
              v_participant_plan.id, v_group_option_rate_id;
            
            UPDATE participant_group_plan_rates
            SET 
              employer_contribution_type = v_employer_contribution_type,
              employer_contribution_amount = v_employer_contribution_amount,
              start_date = v_renewal_date,
              end_date = NULL
            WHERE id = v_existing_record_id;
          ELSE
            -- Closed record exists - reactivate it for the renewal
            RAISE WARNING 'Closed record with same rate exists for participant_group_plan % with rate %. Reactivating existing record instead of creating new one.', 
              v_participant_plan.id, v_group_option_rate_id;
            
            UPDATE participant_group_plan_rates
            SET 
              employer_contribution_type = v_employer_contribution_type,
              employer_contribution_amount = v_employer_contribution_amount,
              start_date = v_renewal_date,
              end_date = NULL
            WHERE id = v_existing_record_id;
          END IF;
        END;
      ELSE
        -- Rate record already exists for this renewal date - update it instead of creating duplicate
        UPDATE participant_group_plan_rates
        SET 
          employer_contribution_type = v_employer_contribution_type,
          employer_contribution_amount = v_employer_contribution_amount,
          end_date = NULL
        WHERE id = v_existing_record_id;
      END IF;
      
    END LOOP; -- End participant_group_plan loop
    
    RAISE NOTICE 'DEBUG: Finished processing plan % - processed % participants, created % records', 
      v_plan_count, v_participant_count, v_record_created_count;
    
  END LOOP; -- End plan loop
  
  RAISE NOTICE 'DEBUG: process_renewal_automation completed - processed % plans, % participants total, created % records total', 
    v_plan_count, v_participant_count, v_record_created_count;
  
  IF v_plan_count = 0 THEN
    RAISE WARNING 'DEBUG: No plans found in renewal_group_plans for renewal_id=%', p_renewal_id;
  END IF;
  
  IF v_participant_count = 0 THEN
    RAISE WARNING 'DEBUG: No participants found for any plans in renewal_id=%', p_renewal_id;
  END IF;
  
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to automatically run the automation when a renewal is created
CREATE OR REPLACE FUNCTION trigger_renewal_automation()
RETURNS TRIGGER AS $$
BEGIN
  -- HYPOTHESIS D: Track trigger invocations
  RAISE NOTICE 'DEBUG HYPOTHESIS D: trigger_renewal_automation FIRED for renewal_id=%, timestamp=%', 
    NEW.id, NOW();
  
  BEGIN
    -- Run the automation for the new renewal
    PERFORM process_renewal_automation(NEW.id);
    RAISE NOTICE 'DEBUG HYPOTHESIS D: trigger_renewal_automation completed successfully for renewal_id=%', NEW.id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'DEBUG HYPOTHESIS D: Error in trigger_renewal_automation for renewal_id=%: %', NEW.id, SQLERRM;
      RAISE;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on renewals table
DROP TRIGGER IF EXISTS renewal_automation_trigger ON renewals;
CREATE TRIGGER renewal_automation_trigger
  AFTER INSERT ON renewals
  FOR EACH ROW
  EXECUTE FUNCTION trigger_renewal_automation();

-- Add comments
COMMENT ON FUNCTION process_renewal_automation IS 'Processes renewal automation: ends active rates and creates new rate records for all active participants';
COMMENT ON FUNCTION calculate_age_as_of IS 'Calculates age as of a specific date';
COMMENT ON FUNCTION find_matching_age_option IS 'Finds matching age option for Age Banded plans, rounding down if over highest, rounding up if under lowest';


