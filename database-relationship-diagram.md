# Database Relationship Diagram

This diagram shows all tables in the database and how they're connected.

```mermaid
erDiagram
    groups ||--o{ participants : "has many"
    groups ||--o{ group_plans : "has many"
    groups ||--o{ group_programs : "has many"
    groups ||--o{ group_change_logs : "has many"
    groups ||--o{ notes : "has many"
    groups ||--o{ group_contacts : "has many"

    participants ||--o{ dependents : "has many"
    participants ||--o{ participant_programs : "has many"
    participants ||--o{ participant_group_plans : "has many"
    participants ||--o{ participant_medicare_plans : "has many"
    participants ||--o{ participant_change_logs : "has many"
    participants ||--o{ notes : "has many"

    programs ||--o{ program_providers : "has many"
    programs ||--o{ participant_programs : "has many"
    programs ||--o{ group_programs : "has many"
    programs ||--o{ group_plans : "has many"

    providers ||--o{ program_providers : "has many"
    providers ||--o{ group_plans : "has many"
    providers ||--o{ medicare_plans : "has many"

    group_plans ||--o{ group_plan_options : "has many"
    group_plans ||--o{ participant_group_plans : "has many"
    group_plans ||--o{ group_change_logs : "has many"

    group_plan_options ||--o{ group_option_rates : "has many"
    group_plan_options ||--o{ participant_group_plans : "has many"

    group_option_rates ||--o{ participant_group_plans : "has many"
    group_option_rates ||--o{ participant_group_plan_rates : "has many"
    group_option_rates ||--o{ group_change_logs : "has many"

    participant_group_plans ||--o{ participant_group_plan_rates : "has many"
    participant_group_plans }o--|| dependents : "optional (for dependents)"

    medicare_plans ||--o{ participant_medicare_plans : "has many"
    medicare_plans ||--o{ medicare_child_rates : "has many"

    medicare_child_rates ||--o{ participant_medicare_plans : "has many"

    groups {
        uuid id PK
        varchar name
        date initial_contact_date
        varchar lead_source
        varchar from_who
        varchar pipeline_status
        text status_change_notes
        varchar eligibility_period
        int number_of_classes
        varchar eligibility_period_class_2
        varchar eligibility_period_class_3
        timestamptz created_at
        timestamptz updated_at
    }

    participants {
        uuid id PK
        uuid group_id FK
        varchar client_name
        date dob
        text address
        varchar phone_number
        varchar email_address
        int number_of_spouses
        int number_of_children
        int class_number
        date hire_date
        date termination_date
        varchar employment_status
        timestamptz created_at
        timestamptz updated_at
    }

    programs {
        uuid id PK
        varchar name
        timestamptz created_at
        timestamptz updated_at
    }

    providers {
        uuid id PK
        varchar name
        timestamptz created_at
        timestamptz updated_at
    }

    group_plans {
        uuid id PK
        uuid group_id FK
        uuid program_id FK
        uuid provider_id FK
        varchar plan_name
        date effective_date
        date termination_date
        varchar plan_type
        varchar employer_contribution_type
        numeric employer_contribution_value
        numeric employer_spouse_contribution_value
        numeric employer_child_contribution_value
        timestamptz created_at
        timestamptz updated_at
    }

    group_plan_options {
        uuid id PK
        uuid group_plan_id FK
        varchar option
        timestamptz created_at
        timestamptz updated_at
    }

    group_option_rates {
        uuid id PK
        uuid group_plan_option_id FK
        numeric rate
        date start_date
        date end_date
        varchar status
        timestamptz created_at
        timestamptz updated_at
    }

    participant_group_plans {
        uuid id PK
        uuid participant_id FK
        uuid group_plan_id FK
        uuid group_plan_option_id FK
        uuid group_option_rate_id FK
        uuid dependent_id FK
        numeric rate_override
        numeric total_employee_responsible_amount
        date effective_date
        timestamptz created_at
        timestamptz updated_at
    }

    participant_group_plan_rates {
        uuid id PK
        uuid participant_group_plan_id FK
        uuid group_option_rate_id FK
        varchar employer_contribution_type
        numeric employer_contribution_amount
        date start_date
        date end_date
        timestamptz created_at
    }

    dependents {
        uuid id PK
        uuid participant_id FK
        varchar relationship
        varchar name
        date dob
        timestamptz created_at
        timestamptz updated_at
    }

    medicare_plans {
        uuid id PK
        uuid provider_id FK
        varchar plan_name
        timestamptz created_at
        timestamptz updated_at
    }

    medicare_child_rates {
        uuid id PK
        uuid medicare_plan_id FK
        numeric rate
        date start_date
        date end_date
        timestamptz created_at
        timestamptz updated_at
    }

    participant_medicare_plans {
        uuid id PK
        uuid participant_id FK
        uuid medicare_plan_id FK
        uuid medicare_rate_id FK
        uuid medicare_child_rate_id FK
        numeric rate_override
        date effective_date
        timestamptz created_at
        timestamptz updated_at
    }

    program_providers {
        uuid id PK
        uuid program_id FK
        uuid provider_id FK
        timestamptz created_at
    }

    group_programs {
        uuid id PK
        uuid group_id FK
        uuid program_id FK
        timestamptz created_at
    }

    participant_programs {
        uuid id PK
        uuid participant_id FK
        uuid program_id FK
        timestamptz created_at
    }

    group_change_logs {
        uuid id PK
        uuid group_id FK
        uuid group_plan_id FK
        uuid group_option_rate_id FK
        timestamptz date
        varchar option
        text notes
        varchar origin
        timestamptz created_at
    }

    participant_change_logs {
        uuid id PK
        uuid participant_id FK
        timestamptz date
        varchar option
        text notes
        varchar origin
        timestamptz created_at
    }

    notes {
        uuid id PK
        uuid group_id FK
        uuid participant_id FK
        date date
        text notes
        timestamptz created_at
        timestamptz updated_at
    }

    group_contacts {
        uuid id PK
        uuid group_id FK
        varchar contact_type
        varchar contact_value
        boolean is_primary
        timestamptz created_at
        timestamptz updated_at
    }

    documents {
        uuid id PK
        varchar entity_type
        uuid entity_id
        varchar file_name
        varchar file_path
        date upload_date
        timestamptz created_at
    }
```

## Table Summary

### Core Entities
- **groups** - Client groups/employers
- **participants** - Individual employees/clients
- **programs** - Insurance programs
- **providers** - Insurance providers

### Group Plans (Group Insurance)
- **group_plans** - Plans offered to groups
- **group_plan_options** - Options within a plan
- **group_option_rates** - Rates for plan options
- **participant_group_plans** - Participant enrollment in group plans
- **participant_group_plan_rates** - Rate history for participant plans

### Medicare Plans
- **medicare_plans** - Medicare plans
- **medicare_child_rates** - Child rates for Medicare plans
- **participant_medicare_plans** - Participant enrollment in Medicare plans

### Supporting Tables
- **dependents** - Spouses and children of participants
- **program_providers** - Many-to-many: programs ↔ providers
- **group_programs** - Many-to-many: groups ↔ programs
- **participant_programs** - Many-to-many: participants ↔ programs
- **group_change_logs** - Change history for groups
- **participant_change_logs** - Change history for participants
- **notes** - Notes for groups or participants
- **group_contacts** - Contact information for groups
- **documents** - File attachments (polymorphic)
