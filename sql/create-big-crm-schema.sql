-- BIG CRM Database Schema
-- Complete schema creation script

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop old tables if they exist (from initial setup)
DROP TABLE IF EXISTS notes CASCADE;
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS deals CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS companies CASCADE;

-- ============================================
-- CORE TABLES
-- ============================================

-- Programs Table
CREATE TABLE IF NOT EXISTS programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Providers Table
CREATE TABLE IF NOT EXISTS providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Program Providers Junction Table (Many-to-Many)
CREATE TABLE IF NOT EXISTS program_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(program_id, provider_id)
);

-- Groups Table
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    initial_contact_date DATE,
    lead_source VARCHAR(50) CHECK (lead_source IN ('Prospecting', 'Walk In', 'Referral')),
    from_who VARCHAR(255),
    pipeline_status VARCHAR(50) CHECK (pipeline_status IS NULL OR pipeline_status IN ('Meeting Set', 'Waiting On Decision', 'Won', 'Lost')),
    status_change_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Group Programs Junction Table (Many-to-Many)
CREATE TABLE IF NOT EXISTS group_programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_id, program_id)
);

-- Group Plans Table
CREATE TABLE IF NOT EXISTS group_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    plan_name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    effective_date DATE NOT NULL,
    termination_date DATE,
    plan_type VARCHAR(50) NOT NULL CHECK (plan_type IN ('Age Banded', 'Composite')),
    employer_contribution_type VARCHAR(50) CHECK (employer_contribution_type IN ('Percentage', 'Dollar Amount')),
    employer_contribution_value DECIMAL(12, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Group Plan Options Table
CREATE TABLE IF NOT EXISTS group_plan_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_plan_id UUID NOT NULL REFERENCES group_plans(id) ON DELETE CASCADE,
    option VARCHAR(255) NOT NULL,
    employer_contribution_type VARCHAR(50) CHECK (employer_contribution_type IN ('Dollar', 'Percentage')),
    class_1_contribution_amount DECIMAL(12, 2),
    class_2_contribution_amount DECIMAL(12, 2),
    class_3_contribution_amount DECIMAL(12, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Group Option Rates Table
CREATE TABLE IF NOT EXISTS group_option_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_plan_option_id UUID NOT NULL REFERENCES group_plan_options(id) ON DELETE CASCADE,
    rate DECIMAL(12, 2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Participants Table
CREATE TABLE IF NOT EXISTS participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
    client_name VARCHAR(255) NOT NULL,
    dob DATE,
    address TEXT,
    phone_number VARCHAR(50),
    email_address VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Participant Programs Junction Table (Many-to-Many)
CREATE TABLE IF NOT EXISTS participant_programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(participant_id, program_id)
);

-- Participant Group Plans Junction Table (Many-to-Many)
CREATE TABLE IF NOT EXISTS participant_group_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    group_plan_id UUID NOT NULL REFERENCES group_plans(id) ON DELETE CASCADE,
    group_plan_option_id UUID REFERENCES group_plan_options(id) ON DELETE SET NULL,
    group_option_rate_id UUID REFERENCES group_option_rates(id) ON DELETE SET NULL,
    rate_override DECIMAL(12, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dependents Table
CREATE TABLE IF NOT EXISTS dependents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    relationship VARCHAR(50) NOT NULL CHECK (relationship IN ('Spouse', 'Child')),
    name VARCHAR(255) NOT NULL,
    dob DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Medicare Plans Table
CREATE TABLE IF NOT EXISTS medicare_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    plan_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Medicare Rates Table
CREATE TABLE IF NOT EXISTS medicare_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medicare_plan_id UUID NOT NULL REFERENCES medicare_plans(id) ON DELETE CASCADE,
    rate DECIMAL(12, 2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Participant Medicare Plans Junction Table (Many-to-Many)
CREATE TABLE IF NOT EXISTS participant_medicare_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    medicare_plan_id UUID NOT NULL REFERENCES medicare_plans(id) ON DELETE CASCADE,
    medicare_rate_id UUID REFERENCES medicare_rates(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Group Change Logs Table
CREATE TABLE IF NOT EXISTS group_change_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    option VARCHAR(255) NOT NULL,
    notes TEXT,
    origin VARCHAR(50) NOT NULL CHECK (origin IN ('Status Change', 'Plan Change', 'Rate Change')),
    group_plan_id UUID REFERENCES group_plans(id) ON DELETE SET NULL,
    group_option_rate_id UUID REFERENCES group_option_rates(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Participant Change Logs Table
CREATE TABLE IF NOT EXISTS participant_change_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    option VARCHAR(255) NOT NULL,
    notes TEXT,
    origin VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notes Table
CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    notes TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK ((group_id IS NOT NULL) OR (participant_id IS NOT NULL))
);

-- Group Contacts Table
CREATE TABLE IF NOT EXISTS group_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    contact_type VARCHAR(50) NOT NULL,
    contact_value VARCHAR(255) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Documents Table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    upload_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_program_providers_program ON program_providers(program_id);
CREATE INDEX IF NOT EXISTS idx_program_providers_provider ON program_providers(provider_id);
CREATE INDEX IF NOT EXISTS idx_group_programs_group ON group_programs(group_id);
CREATE INDEX IF NOT EXISTS idx_group_programs_program ON group_programs(program_id);
CREATE INDEX IF NOT EXISTS idx_groups_pipeline_status ON groups(pipeline_status);
CREATE INDEX IF NOT EXISTS idx_group_plans_group ON group_plans(group_id);
CREATE INDEX IF NOT EXISTS idx_group_plans_program ON group_plans(program_id);
CREATE INDEX IF NOT EXISTS idx_group_plans_provider ON group_plans(provider_id);
CREATE INDEX IF NOT EXISTS idx_group_plan_options_plan ON group_plan_options(group_plan_id);
CREATE INDEX IF NOT EXISTS idx_group_option_rates_option ON group_option_rates(group_plan_option_id);
CREATE INDEX IF NOT EXISTS idx_group_option_rates_active ON group_option_rates(group_plan_option_id, end_date) WHERE end_date IS NULL;
CREATE INDEX IF NOT EXISTS idx_participants_group ON participants(group_id);
CREATE INDEX IF NOT EXISTS idx_participant_programs_participant ON participant_programs(participant_id);
CREATE INDEX IF NOT EXISTS idx_participant_programs_program ON participant_programs(program_id);
CREATE INDEX IF NOT EXISTS idx_participant_group_plans_participant ON participant_group_plans(participant_id);
CREATE INDEX IF NOT EXISTS idx_participant_group_plans_plan ON participant_group_plans(group_plan_id);
CREATE INDEX IF NOT EXISTS idx_dependents_participant ON dependents(participant_id);
CREATE INDEX IF NOT EXISTS idx_medicare_rates_plan ON medicare_rates(medicare_plan_id);
CREATE INDEX IF NOT EXISTS idx_medicare_rates_active ON medicare_rates(medicare_plan_id, end_date) WHERE end_date IS NULL;
CREATE INDEX IF NOT EXISTS idx_participant_medicare_plans_participant ON participant_medicare_plans(participant_id);
CREATE INDEX IF NOT EXISTS idx_participant_medicare_plans_plan ON participant_medicare_plans(medicare_plan_id);
CREATE INDEX IF NOT EXISTS idx_group_change_logs_group ON group_change_logs(group_id);
CREATE INDEX IF NOT EXISTS idx_group_change_logs_origin ON group_change_logs(origin);
CREATE INDEX IF NOT EXISTS idx_participant_change_logs_participant ON participant_change_logs(participant_id);
CREATE INDEX IF NOT EXISTS idx_notes_group ON notes(group_id);
CREATE INDEX IF NOT EXISTS idx_notes_participant ON notes(participant_id);
CREATE INDEX IF NOT EXISTS idx_group_contacts_group ON group_contacts(group_id);
CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(entity_type, entity_id);

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to handle group option rate date automation
CREATE OR REPLACE FUNCTION handle_group_option_rate_dates()
RETURNS TRIGGER AS $$
DECLARE
    plan_effective_date DATE;
    previous_rate_id UUID;
    previous_start_date DATE;
BEGIN
    -- If this is a new rate (INSERT)
    IF TG_OP = 'INSERT' THEN
        -- Get the plan's effective date
        SELECT gp.effective_date INTO plan_effective_date
        FROM group_plans gp
        JOIN group_plan_options gpo ON gpo.group_plan_id = gp.id
        WHERE gpo.id = NEW.group_plan_option_id;
        
        -- Check if this is the first rate for this option
        SELECT id, start_date INTO previous_rate_id, previous_start_date
        FROM group_option_rates
        WHERE group_plan_option_id = NEW.group_plan_option_id
          AND id != NEW.id
        ORDER BY start_date DESC
        LIMIT 1;
        
        -- If no previous rate exists, set start_date to plan effective date
        IF previous_rate_id IS NULL THEN
            NEW.start_date = COALESCE(NEW.start_date, plan_effective_date);
        ELSE
            -- Set start_date to today if not provided
            IF NEW.start_date IS NULL THEN
                NEW.start_date = CURRENT_DATE;
            END IF;
            
            -- Update previous rate's end_date to day before new rate's start_date
            UPDATE group_option_rates
            SET end_date = NEW.start_date - INTERVAL '1 day',
                updated_at = NOW()
            WHERE id = previous_rate_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to handle medicare rate date automation
CREATE OR REPLACE FUNCTION handle_medicare_rate_dates()
RETURNS TRIGGER AS $$
DECLARE
    previous_rate_id UUID;
BEGIN
    -- If this is a new rate (INSERT)
    IF TG_OP = 'INSERT' THEN
        -- Check if this is the first rate for this plan
        SELECT id INTO previous_rate_id
        FROM medicare_rates
        WHERE medicare_plan_id = NEW.medicare_plan_id
          AND id != NEW.id
        ORDER BY start_date DESC
        LIMIT 1;
        
        -- If no previous rate exists, set start_date to today if not provided
        IF previous_rate_id IS NULL THEN
            IF NEW.start_date IS NULL THEN
                NEW.start_date = CURRENT_DATE;
            END IF;
        ELSE
            -- Set start_date to today if not provided
            IF NEW.start_date IS NULL THEN
                NEW.start_date = CURRENT_DATE;
            END IF;
            
            -- Update previous rate's end_date to day before new rate's start_date
            UPDATE medicare_rates
            SET end_date = NEW.start_date - INTERVAL '1 day',
                updated_at = NOW()
            WHERE id = previous_rate_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to auto-create group change log on pipeline status change
CREATE OR REPLACE FUNCTION log_group_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.pipeline_status IS DISTINCT FROM NEW.pipeline_status THEN
        INSERT INTO group_change_logs (
            group_id,
            date,
            option,
            notes,
            origin
        ) VALUES (
            NEW.id,
            NOW(),
            NEW.pipeline_status,
            NEW.status_change_notes,
            'Status Change'
        );
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to auto-create group change log on plan change
CREATE OR REPLACE FUNCTION log_group_plan_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO group_change_logs (
        group_id,
        date,
        option,
        notes,
        origin,
        group_plan_id
    ) VALUES (
        NEW.group_id,
        NOW(),
        NEW.plan_name,
        'Plan added or updated',
        'Plan Change',
        NEW.id
    );
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to auto-create group change log on rate change
CREATE OR REPLACE FUNCTION log_group_rate_change()
RETURNS TRIGGER AS $$
DECLARE
    plan_id UUID;
    group_id_val UUID;
BEGIN
    -- Get the group_plan_id from the option
    SELECT gpo.group_plan_id INTO plan_id
    FROM group_plan_options gpo
    WHERE gpo.id = NEW.group_plan_option_id;
    
    -- Get the group_id from the plan
    SELECT gp.group_id INTO group_id_val
    FROM group_plans gp
    WHERE gp.id = plan_id;
    
    INSERT INTO group_change_logs (
        group_id,
        date,
        option,
        notes,
        origin,
        group_plan_id,
        group_option_rate_id
    ) VALUES (
        group_id_val,
        NOW(),
        'Rate Change',
        'Rate updated: ' || NEW.rate::text,
        'Rate Change',
        plan_id,
        NEW.id
    );
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_programs_updated_at BEFORE UPDATE ON programs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_providers_updated_at BEFORE UPDATE ON providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_group_plans_updated_at BEFORE UPDATE ON group_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_group_plan_options_updated_at BEFORE UPDATE ON group_plan_options
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_group_option_rates_updated_at BEFORE UPDATE ON group_option_rates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_participants_updated_at BEFORE UPDATE ON participants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_participant_group_plans_updated_at BEFORE UPDATE ON participant_group_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dependents_updated_at BEFORE UPDATE ON dependents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_medicare_plans_updated_at BEFORE UPDATE ON medicare_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_medicare_rates_updated_at BEFORE UPDATE ON medicare_rates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_participant_medicare_plans_updated_at BEFORE UPDATE ON participant_medicare_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_group_contacts_updated_at BEFORE UPDATE ON group_contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create triggers for rate date automation
CREATE TRIGGER handle_group_option_rate_dates_trigger
    BEFORE INSERT ON group_option_rates
    FOR EACH ROW EXECUTE FUNCTION handle_group_option_rate_dates();

CREATE TRIGGER handle_medicare_rate_dates_trigger
    BEFORE INSERT ON medicare_rates
    FOR EACH ROW EXECUTE FUNCTION handle_medicare_rate_dates();

-- Create triggers for change logs
CREATE TRIGGER log_group_status_change_trigger
    AFTER UPDATE OF pipeline_status ON groups
    FOR EACH ROW EXECUTE FUNCTION log_group_status_change();

CREATE TRIGGER log_group_plan_change_trigger
    AFTER INSERT OR UPDATE ON group_plans
    FOR EACH ROW EXECUTE FUNCTION log_group_plan_change();

CREATE TRIGGER log_group_rate_change_trigger
    AFTER INSERT OR UPDATE ON group_option_rates
    FOR EACH ROW EXECUTE FUNCTION log_group_rate_change();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_plan_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_option_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_group_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE dependents ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicare_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicare_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_medicare_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_change_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_change_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (will be customized later with Firebase auth)
CREATE POLICY "Allow all operations" ON programs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON providers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON program_providers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON group_programs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON group_plans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON group_plan_options FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON group_option_rates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON participants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON participant_programs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON participant_group_plans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON dependents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON medicare_plans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON medicare_rates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON participant_medicare_plans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON group_change_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON participant_change_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON group_contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON documents FOR ALL USING (true) WITH CHECK (true);


