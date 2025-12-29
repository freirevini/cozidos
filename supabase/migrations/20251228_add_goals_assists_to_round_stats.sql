-- Migration: Add goals and assists columns to player_round_stats
-- This enables storing historical data with complete stats for year filtering

ALTER TABLE player_round_stats 
  ADD COLUMN IF NOT EXISTS goals integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assists integer DEFAULT 0;

COMMENT ON COLUMN player_round_stats.goals IS 'Goals scored in this round (for historical data import)';
COMMENT ON COLUMN player_round_stats.assists IS 'Assists in this round (for historical data import)';
