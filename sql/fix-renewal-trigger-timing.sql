-- Fix renewal automation trigger timing
-- The trigger was firing on renewals INSERT, but plans are linked AFTER the renewal is created
-- Move trigger to fire on renewal_group_plans INSERT instead

-- Drop the old trigger on renewals table
DROP TRIGGER IF EXISTS renewal_automation_trigger ON renewals;

-- Create new trigger function that processes renewal when plans are linked
-- This ensures plans exist before processing
-- Only processes once per renewal to avoid duplicates
CREATE OR REPLACE FUNCTION trigger_renewal_automation_on_plan_link()
RETURNS TRIGGER AS $$
DECLARE
  v_renewal_id UUID;
  v_already_processed BOOLEAN;
BEGIN
  v_renewal_id := NEW.renewal_id;
  
  -- Check if this renewal has already been processed by checking debug logs
  -- If "Function completed" exists for this renewal, skip processing
  SELECT EXISTS (
    SELECT 1 
    FROM renewal_debug_logs 
    WHERE renewal_id = v_renewal_id 
      AND message = 'Function completed'
  ) INTO v_already_processed;
  
  -- Only process if not already processed
  IF NOT v_already_processed THEN
    -- Process the renewal automation (it will process all linked plans)
    PERFORM process_renewal_automation(v_renewal_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on renewal_group_plans table
-- This fires AFTER a plan is linked to a renewal
DROP TRIGGER IF EXISTS renewal_automation_trigger ON renewal_group_plans;
CREATE TRIGGER renewal_automation_trigger
  AFTER INSERT ON renewal_group_plans
  FOR EACH ROW
  EXECUTE FUNCTION trigger_renewal_automation_on_plan_link();

-- Add comment
COMMENT ON FUNCTION trigger_renewal_automation_on_plan_link IS 'Triggers renewal automation when a plan is linked to a renewal. Processes all plans for the renewal.';

