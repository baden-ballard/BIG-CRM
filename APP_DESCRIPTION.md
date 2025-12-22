# BIG CRM - Application Description

## Overview
BIG CRM is a streamlined application that combines Sales Pipeline management with Account Management functionality. The app is designed to be simple and intuitive, focusing on managing programs, providers, groups, and participants in a healthcare/insurance context.

## Core Purpose
Track and manage the sales pipeline for groups and participants across multiple programs and providers, with comprehensive logging and rate tracking capabilities.

## Key Features

### 1. Program & Provider Management
- **Programs**: Define different programs (e.g., Medicare, Group Health)
- **Providers**: Define insurance providers
- **Many-to-Many Relationship**: Programs can have multiple providers, and providers can be part of multiple programs

### 2. Group Management (Sales Pipeline)
- **Groups**: Main entity for tracking sales opportunities
- **Pipeline Status**: Track progress through stages:
  - Meeting Set
  - Waiting On Decision
  - Won
  - Lost
- **Lead Source Tracking**:
  - Lead Source: Prospecting, Walk In, Referral
  - From Who: Person who prospected/referred them
- **Status Change Notes**: Notes field that appears when pipeline status changes
- **Many-to-Many Relationship**: Groups can be associated with multiple Programs
- **Document Attachments**: Store documents related to groups

### 3. Group Plans
- **Purpose**: Track all plans that a group has
- **Relationships**:
  - Group (Related Field)
  - Program (Filtered to show only programs assigned to the group, defaults if only one)
  - Provider (Filtered to show only providers assigned to the selected program)
- **Fields**:
  - Plan Name
  - Effective Date
  - Termination Date
  - Plan Type: Age Banded or Composite
  - Employer Contribution (Percentage or Dollar Amount)
  - Document Attachments

### 4. Group Plan Options
- **Dynamic Field Labeling**: 
  - If Plan Type is "Age Banded": Option field labeled as "Age"
  - If Plan Type is "Composite": Option field labeled as "Age" (Note: This seems like it should be different - needs clarification)
- **Relationship**: Related to Group Plan
- **Display**: Shows list of all ACTIVE Group Option Rates

### 5. Group Option Rates (Rate History Log)
- **Purpose**: Maintain a complete log of all rate changes for each option
- **Fields**:
  - Rate
  - Start Date
  - End Date
- **Automation**:
  - First rate: Start Date defaults to plan's Effective Date
  - New rate: Start Date defaults to today's date
  - On save: Automatically sets End Date of previous rate to day before new rate's Start Date

### 6. Participants (Clients)
- **Purpose**: Manage individual clients/participants
- **Flexible Assignment**: Can be added to a Group OR directly to a Program (e.g., Medicare outside of a group)
- **Fields**:
  - Company (Related Field - needs clarification: is this Groups or separate?)
  - Programs (Related Field)
  - Client Name
  - DOB
  - Address
  - Phone Number
  - Email Address

### 7. Participant Plans
- **Purpose**: Assign participants to group plans and track rate history
- **Structure**: Many-to-Many relationship between Participants and Group Plans
- **Capability**: Select a plan for each program part of the group
- **Rate History**: When a new rate is added to a plan, all active participants on that plan are automatically connected to the new rate, creating a historical record
- **Fields**:
  - Group Plan (Related Field)
  - Plan Options (Filtered to options associated with selected plan)
  - Group Option Rate (Connected to selected option - tracks rate history)
  - Rate Override (Allows manual rate override - may need better placement)

### 8. Dependents
- **Purpose**: Add dependents to participants
- **Fields**:
  - Related Participant (Show Full Name)
  - Relationship: Spouse or Child
  - Name
  - DOB

### 9. Change Logs
- **Group Change Log**: Tracks only Pipeline Status changes
  - Auto-populates when pipeline status changes
  - Fields: Date, Option (Pipeline Status), Notes (from status change notes), Origin (Status Change)
- **Participant Rate History**: Tracked through participant_group_plans and participant_medicare_plans tables
  - When a new rate is added to a plan, all active participants on that plan are automatically connected to the new rate
  - This creates a historical record showing which rates each participant had at different times
  - No separate change log needed for plan or rate changes
- **Participant Change Logs**: Tracks other participant changes (not rate-related)

### 10. Notes
- **Purpose**: General notes system
- **Relationships**: Can be attached to Groups or Participants
- **Fields**:
  - Group (Related Field)
  - Participant (Related Field)
  - Date
  - Notes

### 11. Medicare Plans
- **Structure**: Similar to Group Plans
- **Relationship**: Connected to Providers
- **Purpose**: Handle Medicare-specific plans separately from group plans

### 12. Rates (Medicare)
- **Purpose**: Rate history log for Medicare Plans
- **Structure**: Similar to Group Option Rates

### 13. Participant Medicare Plans
- **Purpose**: Many-to-Many relationship between Participants and Medicare Plans, tracking rate history
- **Capability**: Add participants to multiple Medicare plans simultaneously
- **Rate History**: When a new rate is added to a Medicare plan, all active participants on that plan are automatically connected to the new rate, creating a historical record

## Technical Requirements

### Database Features
- Many-to-Many relationships (Programs ↔ Providers, Groups ↔ Programs, Participants ↔ Group Plans, Participants ↔ Medicare Plans)
- Automatic date management for rate history
- Automatic participant rate history tracking (when new rates added, connect active participants)
- Change log automation (pipeline status only)
- Filtered dropdowns based on relationships
- Document attachment storage

### User Experience
- Simple, uncomplicated interface
- Dynamic field labeling based on Plan Type
- Default values based on relationships
- Automatic log creation on pipeline status changes
- Automatic participant rate history updates when new rates are added to plans

## Data Flow Examples

1. **Group Creation Flow**:
   - Create Group → Assign Programs → Set Pipeline Status → Add Lead Source info
   - Status change → Auto-create Change Log entry

2. **Plan Setup Flow**:
   - Create Group Plan → Select Program → Select Provider → Set Plan Type
   - Add Plan Options → Add Rates (with auto date management)
   - When new rate added → Automatically connect all active participants on that plan to the new rate

3. **Participant Assignment Flow**:
   - Create Participant → Assign to Group or Program directly
   - Select Group Plan → Choose Options → Set Rate (with override option)
   - Changes → Auto-create Participant Change Log


