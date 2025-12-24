-- Create debug logging table for renewal automation
CREATE TABLE IF NOT EXISTS renewal_debug_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  renewal_id UUID,
  log_level VARCHAR(20) DEFAULT 'INFO',
  message TEXT,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_renewal_debug_logs_renewal_id ON renewal_debug_logs(renewal_id);
CREATE INDEX IF NOT EXISTS idx_renewal_debug_logs_created_at ON renewal_debug_logs(created_at);

-- Function to log debug messages
CREATE OR REPLACE FUNCTION log_renewal_debug(
  p_renewal_id UUID,
  p_message TEXT,
  p_data JSONB DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO renewal_debug_logs (renewal_id, message, data)
  VALUES (p_renewal_id, p_message, p_data);
EXCEPTION
  WHEN OTHERS THEN
    -- Silently fail if logging table doesn't exist yet
    NULL;
END;
$$ LANGUAGE plpgsql;

-- Update renewal automation function with debug logging
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
  v_rate DECIMAL;
  v_contribution_value DECIMAL;
  v_day_before_renewal DATE;
  v_existing_record_id UUID;
  v_existing_end_date DATE;
  v_plan_count INTEGER := 0;
  v_participant_count INTEGER := 0;
BEGIN
  -- Log function entry
  PERFORM log_renewal_debug(p_renewal_id, 'Function started', jsonb_build_object('renewal_id', p_renewal_id));
  
  -- Get renewal details
  SELECT r.id, r.group_id, r.renewal_date
  INTO v_renewal
  FROM renewals r
  WHERE r.id = p_renewal_id;
  
  IF v_renewal.id IS NULL THEN
    PERFORM log_renewal_debug(p_renewal_id, 'ERROR: Renewal not found', jsonb_build_object('renewal_id', p_renewal_id));
    RAISE EXCEPTION 'Renewal not found: %', p_renewal_id;
  END IF;
  
  v_group_id := v_renewal.group_id;
  v_renewal_date := v_renewal.renewal_date;
  v_day_before_renewal := v_renewal_date - 1;
  
  PERFORM log_renewal_debug(p_renewal_id, 'Renewal details loaded', jsonb_build_object(
    'group_id', v_group_id,
    'renewal_date', v_renewal_date,
    'day_before_renewal', v_day_before_renewal
  ));
  
  -- Process each plan in the renewal
  FOR v_plan IN
    SELECT rgp.group_plan_id
    FROM renewal_group_plans rgp
    WHERE rgp.renewal_id = p_renewal_id
  LOOP
    v_plan_count := v_plan_count + 1;
    PERFORM log_renewal_debug(p_renewal_id, 'Processing plan', jsonb_build_object('plan_id', v_plan.group_plan_id, 'plan_number', v_plan_count));
    
    -- Get plan details
    SELECT gp.*
    INTO v_group_plan
    FROM group_plans gp
    WHERE gp.id = v_plan.group_plan_id;
    
    IF v_group_plan.id IS NULL THEN
      PERFORM log_renewal_debug(p_renewal_id, 'WARNING: Plan not found, skipping', jsonb_build_object('plan_id', v_plan.group_plan_id));
      CONTINUE; -- Skip if plan not found
    END IF;
    
    PERFORM log_renewal_debug(p_renewal_id, 'Plan details loaded', jsonb_build_object(
      'plan_id', v_group_plan.id,
      'plan_name', v_group_plan.plan_name,
      'plan_type', v_group_plan.plan_type
    ));
    
    -- Count participants for this plan
    SELECT COUNT(*)
    INTO v_participant_count
    FROM participant_group_plans pgp
    INNER JOIN participants p ON p.id = pgp.participant_id
    LEFT JOIN dependents d ON d.id = pgp.dependent_id
    WHERE pgp.group_plan_id = v_plan.group_plan_id
      AND p.group_id = v_group_id
      AND (p.hire_date IS NULL OR p.hire_date <= v_renewal_date)
      AND (p.termination_date IS NULL OR p.termination_date >= v_renewal_date)
      AND (pgp.termination_date IS NULL OR pgp.termination_date >= v_renewal_date);
    
    PERFORM log_renewal_debug(p_renewal_id, 'Found participants for plan', jsonb_build_object(
      'plan_id', v_plan.group_plan_id,
      'participant_count', v_participant_count
    ));
    
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
      PERFORM log_renewal_debug(p_renewal_id, 'Processing participant plan', jsonb_build_object(
        'participant_group_plan_id', v_participant_plan.id,
        'participant_id', v_participant_plan.participant_id,
        'group_plan_id', v_participant_plan.group_plan_id,
        'group_plan_option_id', v_participant_plan.group_plan_option_id,
        'dependent_id', v_participant_plan.dependent_id
      ));
      
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
          PERFORM log_renewal_debug(p_renewal_id, 'WARNING: No DOB for Age Banded plan', jsonb_build_object(
            'participant_group_plan_id', v_participant_plan.id,
            'dependent_id', v_participant_plan.dependent_id,
            'participant_id', v_participant_plan.participant_id
          ));
          CONTINUE; -- Skip this record
        END IF;
        
        -- Calculate age as of renewal date
        v_age := calculate_age_as_of(v_dob, v_renewal_date);
        
        IF v_age IS NULL THEN
          PERFORM log_renewal_debug(p_renewal_id, 'WARNING: Age calculation failed', jsonb_build_object(
            'participant_group_plan_id', v_participant_plan.id,
            'dob', v_dob,
            'renewal_date', v_renewal_date
          ));
          CONTINUE; -- Skip if age calculation failed
        END IF;
        
        -- Find matching age option
        v_group_plan_option_id := find_matching_age_option(v_age, v_group_plan.id, v_renewal_date);
        
        IF v_group_plan_option_id IS NULL THEN
          PERFORM log_renewal_debug(p_renewal_id, 'WARNING: No matching age option found', jsonb_build_object(
            'participant_group_plan_id', v_participant_plan.id,
            'age', v_age,
            'plan_id', v_group_plan.id
          ));
          CONTINUE; -- Skip this record
        END IF;
      ELSE
        -- For non-Age Banded plans, use the existing option
        v_group_plan_option_id := v_participant_plan.group_plan_option_id;
      END IF;
      
      PERFORM log_renewal_debug(p_renewal_id, 'Selected option', jsonb_build_object(
        'participant_group_plan_id', v_participant_plan.id,
        'group_plan_option_id', v_group_plan_option_id,
        'plan_type', v_group_plan.plan_type
      ));
      
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
        PERFORM log_renewal_debug(p_renewal_id, 'ERROR: No rate found for option', jsonb_build_object(
          'participant_group_plan_id', v_participant_plan.id,
          'group_plan_option_id', v_group_plan_option_id,
          'renewal_date', v_renewal_date
        ));
        CONTINUE; -- Skip this record
      END IF;
      
      PERFORM log_renewal_debug(p_renewal_id, 'Found rate', jsonb_build_object(
        'participant_group_plan_id', v_participant_plan.id,
        'group_option_rate_id', v_group_option_rate_id
      ));
      
      -- Determine employer contribution based on relationship
      v_employer_contribution_type := v_group_plan.employer_contribution_type;
      
      -- Get the rate to calculate dollar amount if contribution is percentage-based
      SELECT gor.rate
      INTO v_rate
      FROM group_option_rates gor
      WHERE gor.id = v_group_option_rate_id;
      
      -- Determine contribution value based on relationship
      IF v_group_plan.plan_type = 'Age Banded' THEN
        IF v_participant_plan.dependent_id IS NULL THEN
          -- Employee
          v_contribution_value := v_group_plan.employer_contribution_value;
        ELSIF v_participant_plan.relationship = 'Spouse' THEN
          -- Spouse
          v_contribution_value := v_group_plan.employer_spouse_contribution_value;
        ELSIF v_participant_plan.relationship = 'Child' THEN
          -- Child
          v_contribution_value := v_group_plan.employer_child_contribution_value;
        ELSE
          v_contribution_value := v_group_plan.employer_contribution_value;
        END IF;
      ELSE
        -- For non-Age Banded plans, use standard contribution
        v_contribution_value := v_group_plan.employer_contribution_value;
      END IF;
      
      -- Calculate actual dollar amount based on contribution type
      -- employer_contribution_amount should always be the dollar amount, not the percentage value
      IF v_employer_contribution_type = 'Percentage' AND v_contribution_value IS NOT NULL AND v_rate IS NOT NULL THEN
        v_employer_contribution_amount := v_rate * (v_contribution_value / 100);
      ELSIF v_employer_contribution_type = 'Dollar Amount' AND v_contribution_value IS NOT NULL THEN
        v_employer_contribution_amount := v_contribution_value;
      ELSE
        v_employer_contribution_amount := NULL;
      END IF;
      
      -- End all active participant_group_plan_rates records for this participant_group_plan
      -- Only update records that are currently active (end_date IS NULL)
      -- This ensures we preserve history by closing old records
      UPDATE participant_group_plan_rates
      SET end_date = v_day_before_renewal
      WHERE participant_group_plan_id = v_participant_plan.id
        AND end_date IS NULL;
      
      PERFORM log_renewal_debug(p_renewal_id, 'Closed active records', jsonb_build_object(
        'participant_group_plan_id', v_participant_plan.id,
        'end_date', v_day_before_renewal
      ));
      
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
        
        PERFORM log_renewal_debug(p_renewal_id, 'SUCCESS: Created new rate record', jsonb_build_object(
          'participant_group_plan_id', v_participant_plan.id,
          'group_option_rate_id', v_group_option_rate_id,
          'start_date', v_renewal_date
        ));
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
            PERFORM log_renewal_debug(p_renewal_id, 'WARNING: Active record with same rate exists, updating', jsonb_build_object(
              'participant_group_plan_id', v_participant_plan.id,
              'group_option_rate_id', v_group_option_rate_id,
              'existing_record_id', v_existing_record_id
            ));
            
            UPDATE participant_group_plan_rates
            SET 
              employer_contribution_type = v_employer_contribution_type,
              employer_contribution_amount = v_employer_contribution_amount,
              start_date = v_renewal_date,
              end_date = NULL
            WHERE id = v_existing_record_id;
          ELSE
            -- Closed record exists - reactivate it for the renewal
            PERFORM log_renewal_debug(p_renewal_id, 'WARNING: Closed record with same rate exists, reactivating', jsonb_build_object(
              'participant_group_plan_id', v_participant_plan.id,
              'group_option_rate_id', v_group_option_rate_id,
              'existing_record_id', v_existing_record_id
            ));
            
            UPDATE participant_group_plan_rates
            SET 
              employer_contribution_type = v_employer_contribution_type,
              employer_contribution_amount = v_employer_contribution_amount,
              start_date = v_renewal_date,
              end_date = NULL
            WHERE id = v_existing_record_id;
          END IF;
        WHEN OTHERS THEN
          PERFORM log_renewal_debug(p_renewal_id, 'ERROR: Failed to insert rate record', jsonb_build_object(
            'participant_group_plan_id', v_participant_plan.id,
            'error', SQLERRM,
            'sqlstate', SQLSTATE
          ));
      END;
      
    END LOOP; -- End participant_group_plan loop
    
  END LOOP; -- End plan loop
  
  PERFORM log_renewal_debug(p_renewal_id, 'Function completed', jsonb_build_object('plans_processed', v_plan_count));
  
END;
$$ LANGUAGE plpgsql;

