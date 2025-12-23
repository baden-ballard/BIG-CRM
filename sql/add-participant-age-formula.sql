-- Add age formula field to participants table
-- Age is calculated from date of birth

-- Create a function to calculate age from date of birth
CREATE OR REPLACE FUNCTION calculate_age(date_of_birth DATE)
RETURNS INTEGER AS $$
BEGIN
    IF date_of_birth IS NULL THEN
        RETURN NULL;
    END IF;
    
    RETURN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth))::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create a view that includes the age calculation
CREATE OR REPLACE VIEW participants_with_age AS
SELECT 
    p.*,
    calculate_age(p.dob) AS age
FROM participants p;

-- Grant permissions
GRANT SELECT ON participants_with_age TO authenticated;
GRANT SELECT ON participants_with_age TO anon;

-- Add comment to document the age field
COMMENT ON FUNCTION calculate_age(DATE) IS 'Calculates age in years from date of birth based on current date';

