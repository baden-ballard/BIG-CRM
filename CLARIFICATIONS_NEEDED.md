# Clarifications Needed Before Development

## Critical Questions

### 1. **Company Field in Participants**
- **Question**: The Participants table has a "Company" field. Is this:
  - A reference to the Groups table?
  - A separate Companies table?
  - A text field for company name?
- **Recommendation**: If Groups represent companies, use a "Group" relationship field instead of "Company"

### 2. **Group Plan Options - Composite Plan Type**
- **Issue**: Description says for Composite plans, the Option field title changes to "Age" (same as Age Banded)
- **Question**: Should Composite plans have a different field label? Perhaps:
  - "Coverage Tier" or "Plan Tier" for Composite
  - "Age" for Age Banded
- **Recommendation**: Clarify what "Option" means for Composite plans

### 3. **Document Attachments**
- **Question**: How should document attachments be stored?
  - Supabase Storage (recommended)
  - External storage service
  - File paths/references
- **Recommendation**: Use Supabase Storage with a separate `documents` or `attachments` table that references Groups and Group Plans

### 4. **Rate Override Placement**
- **Question**: Rate Override is in Participant Plans, but should it be:
  - At the Participant Plan level (current)
  - At the Group Option Rate level
  - Both?
- **Recommendation**: Keep at Participant Plan level (allows per-participant overrides) but consider adding to Group Option Rate for group-wide overrides

### 5. **Medicare Plans Structure**
- **Question**: Should Medicare Plans:
  - Share the same structure as Group Plans (reuse components)?
  - Have separate but similar structure?
  - Be completely independent?
- **Recommendation**: Create a base "Plan" structure that both Group Plans and Medicare Plans inherit from, or use a "Plan Type" discriminator

### 6. **Group Change Log - Rate Connections** ✅ RESOLVED
- **Solution**: Group change logs now only track pipeline status changes. Rate changes are tracked through participant_group_plans and participant_medicare_plans tables. When a new rate is added, all active participants are automatically connected to that rate, creating a historical record.

### 7. **Authentication & User Management**
- **Question**: Who can access the system?
  - Single user?
  - Multiple users with roles?
  - Team-based access?
- **Recommendation**: Start with single user, but design for future multi-user expansion

### 8. **Prospecting Tab**
- **Question**: "Prospecting tab on record view" - is this:
  - A UI/UX concept (tab in the interface)?
  - A data structure (separate table)?
  - Fields within the Groups table?
- **Recommendation**: These appear to be fields in the Groups table (Lead Source, From Who, Pipeline Status, Status Change Notes)

### 9. **Participant Plans - Many-to-Many Structure**
- **Clarification**: Description mentions "child table" but also "many-to-many"
- **Question**: Should this be:
  - A junction table (true many-to-many)?
  - A child table with foreign keys?
- **Recommendation**: Use a junction table for true many-to-many flexibility

### 10. **Initial Contact Date**
- **Question**: In Groups table, is "Initial Contact Date":
  - When the group was first contacted?
  - When the group record was created?
  - A separate field from created_at?
- **Recommendation**: Keep as separate field for tracking first contact separately from record creation

## Suggested Improvements

### 1. **Unified Plan Structure**
Consider creating a base plan structure:
- **Plans** (base table)
  - Plan Type: Group Plan or Medicare Plan
  - Common fields: Name, Effective Date, Termination Date, Provider, etc.
- **Group Plans** and **Medicare Plans** inherit or reference base structure
- **Benefit**: Reduces code duplication, easier to maintain

### 2. **Unified Rate Structure**
- **Rates** (base table)
  - Rate Type: Group Option Rate or Medicare Rate
  - Common fields: Rate, Start Date, End Date
- **Benefit**: Single rate management system

### 3. **Change Log Enhancement**
- Add "Changed By" field (for future user tracking)
- Add "Previous Value" and "New Value" fields for better audit trail
- **Note**: Group change logs now only track pipeline status changes. Plan and rate history is tracked through participant junction tables.

### 4. **Document Management**
- Create `documents` table:
  - Related Entity Type (Group, Group Plan, Participant, etc.)
  - Related Entity ID
  - File Path/URL
  - File Name
  - Upload Date
- **Benefit**: Centralized document management

### 5. **Address Normalization**
- Consider separate `addresses` table for Groups and Participants
- **Benefit**: Better data consistency, easier to manage multiple addresses

### 6. **Email/Phone Normalization**
- Consider separate `contact_methods` table
- **Benefit**: Track multiple emails/phones per entity, mark primary

### 7. **Status Workflow**
- Consider adding status workflow validation:
  - Can't go from "Won" back to "Meeting Set"
  - Define valid status transitions
- **Benefit**: Data integrity, better UX

## Recommended Next Steps

1. **Clarify the questions above** before building
2. **Decide on document storage** approach
3. **Confirm data relationships** (especially Company vs Group)
4. **Review Plan Type options** and field labeling
5. **Plan authentication** approach (even if starting simple)
6. **Design change log structure** for audit requirements

## Database Schema Recommendations

### Core Tables Needed:
1. `programs` - Programs
2. `providers` - Providers  
3. `program_providers` - Junction table (Many-to-Many)
4. `groups` - Groups with prospecting fields
5. `group_programs` - Junction table (Many-to-Many)
6. `group_plans` - Group Plans
7. `group_plan_options` - Plan Options
8. `group_option_rates` - Rate History
9. `participants` - Participants
10. `participant_group_plans` - Junction table
11. `participant_medicare_plans` - Junction table
12. `dependents` - Dependents
13. `medicare_plans` - Medicare Plans
14. `medicare_rates` - Medicare Rate History
15. `group_change_logs` - Group Change Logs (Pipeline Status changes only)
16. `participant_change_logs` - Participant Change Logs
17. `notes` - Notes
18. `documents` - Document attachments (recommended)

### Additional Considerations:
- Add `users` table if multi-user support needed
- Add `addresses` table for better address management
- Add `contact_methods` table for email/phone management


