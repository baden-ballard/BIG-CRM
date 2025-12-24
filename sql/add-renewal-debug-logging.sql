-- Create debug logging table for renewal automation
CREATE TABLE IF NOT EXISTS renewal_debug_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  renewal_id UUID,
  log_level VARCHAR(20) DEFAULT 'INFO',
  message TEXT,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_renewal_debug_logs_renewal_id ON renewal_debug_logs(renewal_id);
CREATE INDEX IF NOT EXISTS idx_renewal_debug_logs_created_at ON renewal_debug_logs(created_at);

-- Function to log debug messages
CREATE OR REPLACE FUNCTION log_renewal_debug(
  p_renewal_id UUID,
  p_message TEXT,
  p_data JSONB DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO renewal_debug_logs (renewal_id, message, data)
  VALUES (p_renewal_id, p_message, p_data);
END;
$$ LANGUAGE plpgsql;

