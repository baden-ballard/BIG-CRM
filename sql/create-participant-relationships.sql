-- Create participant_relationships join table
-- This table links two participants together with relationship information

CREATE TABLE IF NOT EXISTS participant_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant_id_1 UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    participant_id_2 UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    relationship VARCHAR(50) NOT NULL CHECK (relationship IN ('Spouses', 'Parent/Child')),
    is_representative BOOLEAN DEFAULT FALSE,
    representative_participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Ensure participant_id_1 < participant_id_2 to prevent duplicate relationships
    CONSTRAINT participant_relationships_unique CHECK (participant_id_1 < participant_id_2),
    CONSTRAINT participant_relationships_different CHECK (participant_id_1 != participant_id_2)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_participant_relationships_participant_1 ON participant_relationships(participant_id_1);
CREATE INDEX IF NOT EXISTS idx_participant_relationships_participant_2 ON participant_relationships(participant_id_2);
CREATE INDEX IF NOT EXISTS idx_participant_relationships_representative ON participant_relationships(representative_participant_id);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_participant_relationships_updated_at BEFORE UPDATE ON participant_relationships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE participant_relationships ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users" ON participant_relationships
    FOR ALL USING (true) WITH CHECK (true);

