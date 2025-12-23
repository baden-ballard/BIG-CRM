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
BEGIN
  -- Get renewal details
  SELECT r.id, r.group_id, r.renewal_date
  INTO v_renewal
  FROM renewals r
  WHERE r.id = p_renewal_id;
  
  IF v_renewal.id IS NULL THEN
    RAISE EXCEPTION 'Renewal not found: %', p_renewal_id;
  END IF;
  
  v_group_id := v_renewal.group_id;
  v_renewal_date := v_renewal.renewal_date;
  v_day_before_renewal := v_renewal_date - 1;
  
  -- Process each plan in the renewal
  FOR v_plan IN
    SELECT rgp.group_plan_id
    FROM renewal_group_plans rgp
    WHERE rgp.renewal_id = p_renewal_id
  LOOP
    -- Get plan details
    SELECT gp.*
    INTO v_group_plan
    FROM group_plans gp
    WHERE gp.id = v_plan.group_plan_id;
    
    IF v_group_plan.id IS NULL THEN
      CONTINUE; -- Skip if plan not found
    END IF;
    
    -- Process each participant_group_plan record for this plan
    FOR v_participant_plan IN
      SELECT 
        pgp.*,
        p.dob as participant_dob,
        p.hire_date,
        p.termination_date as participant_termination_date,
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
    LOOP
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
      SELECT gor.id
      INTO v_group_option_rate_id
      FROM group_option_rates gor
      WHERE gor.group_plan_option_id = v_group_plan_option_id
        AND gor.start_date <= v_renewal_date
        AND (gor.end_date IS NULL OR gor.end_date >= v_renewal_date)
      ORDER BY gor.start_date DESC
      LIMIT 1;
      
      IF v_group_option_rate_id IS NULL THEN
        RAISE WARNING 'No rate found for option % on renewal date %', 
          v_group_plan_option_id, v_renewal_date;
        CONTINUE; -- Skip this record
      END IF;
      
      -- Determine employer contribution based on relationship
      v_employer_contribution_type := v_group_plan.employer_contribution_type;
      
      IF v_group_plan.plan_type = 'Age Banded' THEN
        IF v_participant_plan.dependent_id IS NULL THEN
          -- Employee
          v_employer_contribution_amount := v_group_plan.employer_contribution_value;
        ELSIF v_participant_plan.relationship = 'Spouse' THEN
          -- Spouse
          v_employer_contribution_amount := v_group_plan.employer_spouse_contribution_value;
        ELSIF v_participant_plan.relationship = 'Child' THEN
          -- Child
          v_employer_contribution_amount := v_group_plan.employer_child_contribution_value;
        ELSE
          v_employer_contribution_amount := v_group_plan.employer_contribution_value;
        END IF;
      ELSE
        -- For non-Age Banded plans, use standard contribution
        v_employer_contribution_amount := v_group_plan.employer_contribution_value;
      END IF;
      
      -- End all active participant_group_plan_rates records for this participant_group_plan
      UPDATE participant_group_plan_rates
      SET end_date = v_day_before_renewal
      WHERE participant_group_plan_id = v_participant_plan.id
        AND end_date IS NULL;
      
      -- Create new participant_group_plan_rates record
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
      
    END LOOP; -- End participant_group_plan loop
    
  END LOOP; -- End plan loop
  
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to automatically run the automation when a renewal is created
CREATE OR REPLACE FUNCTION trigger_renewal_automation()
RETURNS TRIGGER AS $$
BEGIN
  -- Run the automation for the new renewal
  PERFORM process_renewal_automation(NEW.id);
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

