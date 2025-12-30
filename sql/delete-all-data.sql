-- Delete All Data from BIG CRM Database
-- This script deletes all data from all tables while preserving table structure
-- WARNING: This will permanently delete all data!

-- We'll delete in reverse dependency order to respect foreign key constraints

-- ============================================
-- STEP 1: Delete from most dependent junction/rate history tables first
-- ============================================

-- Rate history junction tables
DELETE FROM participant_group_plan_rates;
DELETE FROM participant_medicare_plan_rates;

-- Renewal-related tables
DELETE FROM renewal_group_plans;
DELETE FROM renewal_medicare_plans;
DELETE FROM renewals;
DELETE FROM medicare_renewals;

-- Debug logs
DELETE FROM renewal_debug_logs;

-- ============================================
-- STEP 2: Delete from participant-related junction tables
-- ============================================

DELETE FROM participant_group_plans;
DELETE FROM participant_medicare_plans;
DELETE FROM participant_programs;

-- ============================================
-- STEP 3: Delete from group-related junction tables
-- ============================================

DELETE FROM group_programs;
DELETE FROM program_providers;

-- ============================================
-- STEP 4: Delete from dependent/child tables
-- ============================================

-- Dependents (depends on participants)
DELETE FROM dependents;

-- Notes (depends on groups and participants)
DELETE FROM notes;

-- Group contacts (depends on groups)
DELETE FROM group_contacts;

-- Documents (references various entities)
DELETE FROM documents;

-- Change logs (depends on groups and participants)
DELETE FROM group_change_logs;
DELETE FROM participant_change_logs;

-- ============================================
-- STEP 5: Delete from rate tables
-- ============================================

-- Group option rates (depends on group_plan_options)
DELETE FROM group_option_rates;

-- Medicare child rates (depends on medicare_plans)
DELETE FROM medicare_child_rates;

-- ============================================
-- STEP 6: Delete from plan option tables
-- ============================================

-- Group plan options (depends on group_plans)
DELETE FROM group_plan_options;

-- ============================================
-- STEP 7: Delete from plan tables
-- ============================================

-- Group plans (depends on groups, programs, providers)
DELETE FROM group_plans;

-- Medicare plans (depends on providers)
DELETE FROM medicare_plans;

-- ============================================
-- STEP 8: Delete from main entity tables
-- ============================================

-- Participants (depends on groups, but group_id can be null)
DELETE FROM participants;

-- Groups (no dependencies on other main tables)
DELETE FROM groups;

-- ============================================
-- STEP 9: Delete from reference tables
-- ============================================

-- Programs (reference table)
DELETE FROM programs;

-- Providers (reference table)
DELETE FROM providers;

-- ============================================
-- Verification: Check row counts (should all be 0)
-- ============================================

-- Uncomment the following to verify deletion:
-- SELECT 
--     'participant_group_plans' as table_name, COUNT(*) as row_count FROM participant_group_plans
-- UNION ALL SELECT 'participant_medicare_plans', COUNT(*) FROM participant_medicare_plans
-- UNION ALL SELECT 'participant_programs', COUNT(*) FROM participant_programs
-- UNION ALL SELECT 'group_programs', COUNT(*) FROM group_programs
-- UNION ALL SELECT 'program_providers', COUNT(*) FROM program_providers
-- UNION ALL SELECT 'dependents', COUNT(*) FROM dependents
-- UNION ALL SELECT 'notes', COUNT(*) FROM notes
-- UNION ALL SELECT 'group_contacts', COUNT(*) FROM group_contacts
-- UNION ALL SELECT 'documents', COUNT(*) FROM documents
-- UNION ALL SELECT 'group_change_logs', COUNT(*) FROM group_change_logs
-- UNION ALL SELECT 'participant_change_logs', COUNT(*) FROM participant_change_logs
-- UNION ALL SELECT 'group_option_rates', COUNT(*) FROM group_option_rates
-- UNION ALL SELECT 'medicare_rates', COUNT(*) FROM medicare_rates
-- UNION ALL SELECT 'group_plan_options', COUNT(*) FROM group_plan_options
-- UNION ALL SELECT 'group_plans', COUNT(*) FROM group_plans
-- UNION ALL SELECT 'medicare_plans', COUNT(*) FROM medicare_plans
-- UNION ALL SELECT 'participants', COUNT(*) FROM participants
-- UNION ALL SELECT 'groups', COUNT(*) FROM groups
-- UNION ALL SELECT 'programs', COUNT(*) FROM programs
-- UNION ALL SELECT 'providers', COUNT(*) FROM providers;

