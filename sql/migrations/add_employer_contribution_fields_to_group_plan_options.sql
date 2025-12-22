-- Migration: Add employer contribution fields to group_plan_options table
-- Date: 2025-01-XX
-- Description: Adds employer_contribution_type and class contribution amount fields for composite plans

-- Add employer_contribution_type column
ALTER TABLE group_plan_options 
ADD COLUMN IF NOT EXISTS employer_contribution_type VARCHAR(50) CHECK (employer_contribution_type IN ('Dollar', 'Percentage'));

-- Add class contribution amount columns
ALTER TABLE group_plan_options 
ADD COLUMN IF NOT EXISTS class_1_contribution_amount DECIMAL(12, 2);

ALTER TABLE group_plan_options 
ADD COLUMN IF NOT EXISTS class_2_contribution_amount DECIMAL(12, 2);

ALTER TABLE group_plan_options 
ADD COLUMN IF NOT EXISTS class_3_contribution_amount DECIMAL(12, 2);
