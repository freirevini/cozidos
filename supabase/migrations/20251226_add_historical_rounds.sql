-- Migration: Add is_historical column to rounds table
-- This allows historical data to appear in profile/classification but not in match listings

ALTER TABLE rounds ADD COLUMN IF NOT EXISTS is_historical boolean DEFAULT false;

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_rounds_is_historical ON rounds(is_historical);

COMMENT ON COLUMN rounds.is_historical IS 'True for imported historical data that should not appear in match/round listings';
