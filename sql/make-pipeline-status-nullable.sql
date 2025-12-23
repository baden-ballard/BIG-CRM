-- Make pipeline_status nullable and remove default value
-- This allows groups to be created without a pipeline status selected

ALTER TABLE groups 
  ALTER COLUMN pipeline_status DROP NOT NULL,
  ALTER COLUMN pipeline_status DROP DEFAULT;

-- Update the CHECK constraint to allow NULL values
ALTER TABLE groups 
  DROP CONSTRAINT IF EXISTS groups_pipeline_status_check;

ALTER TABLE groups 
  ADD CONSTRAINT groups_pipeline_status_check 
  CHECK (pipeline_status IS NULL OR pipeline_status IN ('Meeting Set', 'Waiting On Decision', 'Won', 'Lost'));

