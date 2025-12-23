# BIG CRM - Database Schema

## Final Schema Design

### Core Tables

1. **programs** - Programs (e.g., Medicare, Group Health)
2. **providers** - Insurance Providers
3. **program_providers** - Junction table (Many-to-Many: Programs ↔ Providers)
4. **groups** - Groups with prospecting/pipeline fields
5. **group_programs** - Junction table (Many-to-Many: Groups ↔ Programs)
6. **group_plans** - Plans for groups
7. **group_plan_options** - Options for group plans (Age Banded or Composite)
8. **group_option_rates** - Rate history for plan options
9. **participants** - Individual clients/participants
10. **participant_group_plans** - Junction table (Many-to-Many: Participants ↔ Group Plans)
11. **participant_medicare_plans** - Junction table (Many-to-Many: Participants ↔ Medicare Plans)
12. **dependents** - Dependents of participants
13. **medicare_plans** - Medicare-specific plans
14. **medicare_rates** - Rate history for Medicare plans
15. **group_change_logs** - Change logs for groups (pipeline status changes only)
16. **participant_change_logs** - Change logs for participants
17. **notes** - Notes attached to groups or participants
18. **group_contacts** - Contact information for groups
19. **documents** - Document attachments (Supabase Storage references)

## Table Structures

### programs
- id (UUID, PK)
- name (VARCHAR)
- created_at, updated_at

### providers
- id (UUID, PK)
- name (VARCHAR)
- created_at, updated_at

### program_providers (Junction)
- id (UUID, PK)
- program_id (UUID, FK → programs)
- provider_id (UUID, FK → providers)
- created_at

### groups
- id (UUID, PK)
- name (VARCHAR)
- initial_contact_date (DATE)
- lead_source (VARCHAR: Prospecting, Walk In, Referral)
- from_who (VARCHAR) - Person who prospected/referred
- pipeline_status (VARCHAR: Meeting Set, Waiting On Decision, Won, Lost)
- status_change_notes (TEXT)
- eligibility_period (VARCHAR: First of Month Following Date of Hire, First of Month Following 30 Days, First of the Month Following 60 Days)
- created_at, updated_at

### group_programs (Junction)
- id (UUID, PK)
- group_id (UUID, FK → groups)
- program_id (UUID, FK → programs)
- created_at

### group_plans
- id (UUID, PK)
- group_id (UUID, FK → groups)
- program_id (UUID, FK → programs)
- provider_id (UUID, FK → providers)
- plan_name (VARCHAR)
- effective_date (DATE)
- termination_date (DATE)
- plan_type (VARCHAR: Age Banded, Composite)
- employer_contribution_type (VARCHAR: Percentage, Dollar Amount)
- employer_contribution_value (DECIMAL)
- created_at, updated_at

### group_plan_options
- id (UUID, PK)
- group_plan_id (UUID, FK → group_plans)
- option (VARCHAR) - Labeled as "Age" for Age Banded, "Plan Option" for Composite
- created_at, updated_at

### group_option_rates
- id (UUID, PK)
- group_plan_option_id (UUID, FK → group_plan_options)
- rate (DECIMAL)
- start_date (DATE)
- end_date (DATE)
- created_at, updated_at

### participants
- id (UUID, PK)
- group_id (UUID, FK → groups, nullable) - Can be null if assigned directly to program
- client_name (VARCHAR)
- dob (DATE)
- address (TEXT)
- phone_number (VARCHAR)
- email_address (VARCHAR)
- created_at, updated_at

### participant_programs (Junction)
- id (UUID, PK)
- participant_id (UUID, FK → participants)
- program_id (UUID, FK → programs)
- created_at

### participant_group_plans (Junction)
- id (UUID, PK)
- participant_id (UUID, FK → participants)
- group_plan_id (UUID, FK → group_plans)
- group_plan_option_id (UUID, FK → group_plan_options)
- group_option_rate_id (UUID, FK → group_option_rates)
- rate_override (DECIMAL, nullable)
- termination_date (DATE, nullable) - Date when the participant's enrollment in this group plan ended. NULL means the participant is still actively enrolled.
- created_at, updated_at
- **Note**: This table tracks participant rate history. Participant connections to new rates are handled through the renewal automation process, not automatically when rates are created.

### dependents
- id (UUID, PK)
- participant_id (UUID, FK → participants)
- relationship (VARCHAR: Spouse, Child)
- name (VARCHAR)
- dob (DATE)
- created_at, updated_at

### medicare_plans
- id (UUID, PK)
- provider_id (UUID, FK → providers)
- plan_name (VARCHAR)
- created_at, updated_at

### medicare_rates
- id (UUID, PK)
- medicare_plan_id (UUID, FK → medicare_plans)
- rate (DECIMAL)
- start_date (DATE)
- end_date (DATE)
- created_at, updated_at

### participant_medicare_plans (Junction)
- id (UUID, PK)
- participant_id (UUID, FK → participants)
- medicare_plan_id (UUID, FK → medicare_plans)
- medicare_rate_id (UUID, FK → medicare_rates)
- created_at, updated_at
- **Note**: This table tracks participant Medicare rate history. Participant connections to new rates are handled through the renewal automation process, not automatically when rates are created.

### group_change_logs
- id (UUID, PK)
- group_id (UUID, FK → groups)
- date (TIMESTAMP)
- option (VARCHAR) - Pipeline Status
- notes (TEXT) - Status change notes
- origin (VARCHAR: Status Change)
- created_at
- **Note**: Only tracks pipeline status changes. Plan and rate changes are tracked through participant_group_plans and participant_medicare_plans tables.

### participant_change_logs
- id (UUID, PK)
- participant_id (UUID, FK → participants)
- date (TIMESTAMP)
- option (VARCHAR) - What changed
- notes (TEXT)
- origin (VARCHAR: Plan Change, Rate Change, etc.)
- created_at

### notes
- id (UUID, PK)
- group_id (UUID, FK → groups, nullable)
- participant_id (UUID, FK → participants, nullable)
- date (DATE)
- notes (TEXT)
- created_at, updated_at

### group_contacts
- id (UUID, PK)
- group_id (UUID, FK → groups)
- contact_type (VARCHAR: Email, Phone, etc.)
- contact_value (VARCHAR)
- is_primary (BOOLEAN, default false)
- created_at, updated_at

### documents
- id (UUID, PK)
- entity_type (VARCHAR: Group, Group Plan, Participant, etc.)
- entity_id (UUID) - ID of the related entity
- file_name (VARCHAR)
- file_path (VARCHAR) - Supabase Storage path
- upload_date (DATE)
- created_at

## Key Features

### Automations
1. **Group Option Rates**: 
   - First rate: Start Date = Plan Effective Date
   - New rate: Start Date = Today, Previous rate End Date = New Start Date - 1 day

2. **Participant Rate History**:
   - Participant connections to new rates are handled through the renewal automation process
   - Rate history is tracked through the participant_group_plans and participant_medicare_plans junction tables
   - When renewals are processed, participants are automatically connected to the appropriate new rates

3. **Change Logs**:
   - Auto-create on Pipeline Status change only

### Relationships
- Programs ↔ Providers (Many-to-Many)
- Groups ↔ Programs (Many-to-Many)
- Participants ↔ Group Plans (Many-to-Many)
- Participants ↔ Medicare Plans (Many-to-Many)
- Participants can be in Groups OR directly in Programs

### Future Considerations
- Multi-user support (Firebase auth)
- Changed By fields in change logs (add later)
- User roles and permissions



