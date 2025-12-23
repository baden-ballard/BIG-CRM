-- Add formula fields to group_option_rates for employer and employee amounts
-- These are computed columns that calculate based on the plan's employer contribution

-- First, create a function to calculate amount paid by employer
CREATE OR REPLACE FUNCTION calculate_amount_paid_by_employer(
    rate_amount DECIMAL,
    contribution_type VARCHAR,
    contribution_value DECIMAL
) RETURNS DECIMAL AS $$
BEGIN
    IF contribution_type = 'Percentage' AND contribution_value IS NOT NULL THEN
        RETURN (rate_amount * contribution_value / 100);
    ELSIF contribution_type = 'Dollar Amount' AND contribution_value IS NOT NULL THEN
        RETURN contribution_value;
    ELSE
        RETURN 0;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create a function to calculate employee responsible amount
CREATE OR REPLACE FUNCTION calculate_employee_responsible_amount(
    rate_amount DECIMAL,
    amount_paid_by_employer DECIMAL
) RETURNS DECIMAL AS $$
BEGIN
    RETURN GREATEST(0, rate_amount - amount_paid_by_employer);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add computed columns to group_option_rates
-- Note: These will be calculated via a view since we need to join with group_plans
-- We'll create a view that includes these calculated fields

CREATE OR REPLACE VIEW group_option_rates_with_formulas AS
SELECT 
    gor.*,
    gp.employer_contribution_type,
    gp.employer_contribution_value,
    calculate_amount_paid_by_employer(
        gor.rate,
        gp.employer_contribution_type,
        gp.employer_contribution_value
    ) AS amount_paid_by_employer,
    calculate_employee_responsible_amount(
        gor.rate,
        calculate_amount_paid_by_employer(
            gor.rate,
            gp.employer_contribution_type,
            gp.employer_contribution_value
        )
    ) AS employee_responsible_amount
FROM group_option_rates gor
JOIN group_plan_options gpo ON gor.group_plan_option_id = gpo.id
JOIN group_plans gp ON gpo.group_plan_id = gp.id;

-- Grant permissions
GRANT SELECT ON group_option_rates_with_formulas TO authenticated;
GRANT SELECT ON group_option_rates_with_formulas TO anon;

