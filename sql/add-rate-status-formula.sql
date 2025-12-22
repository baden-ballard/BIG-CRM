-- Add status formula to group_option_rates table
-- Status is "Active" if CURRENT_DATE is between start_date and end_date (or end_date is NULL and CURRENT_DATE >= start_date)
-- Otherwise status is "Inactive"

-- Create a function to calculate rate status
CREATE OR REPLACE FUNCTION calculate_rate_status(start_date DATE, end_date DATE)
RETURNS VARCHAR(10) AS $$
BEGIN
    IF start_date IS NULL THEN
        RETURN 'Inactive';
    END IF;
    
    IF end_date IS NULL THEN
        -- If no end date, check if start date is today or in the past
        IF start_date <= CURRENT_DATE THEN
            RETURN 'Active';
        ELSE
            RETURN 'Inactive';
        END IF;
    ELSE
        -- Check if current date is within the range
        IF CURRENT_DATE >= start_date AND CURRENT_DATE <= end_date THEN
            RETURN 'Active';
        ELSE
            RETURN 'Inactive';
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add a generated column for status (PostgreSQL 12+)
-- This will automatically compute the status based on start_date and end_date
ALTER TABLE group_option_rates 
ADD COLUMN IF NOT EXISTS status VARCHAR(10) GENERATED ALWAYS AS (
    calculate_rate_status(start_date, end_date)
) STORED;

-- Create an index on status for faster queries
CREATE INDEX IF NOT EXISTS idx_group_option_rates_status ON group_option_rates(status);

-- Add comment to explain the column
COMMENT ON COLUMN group_option_rates.status IS 'Computed status: Active if CURRENT_DATE is between start_date and end_date (or end_date is NULL and CURRENT_DATE >= start_date), otherwise Inactive';
