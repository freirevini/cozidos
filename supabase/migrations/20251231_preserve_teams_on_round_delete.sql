-- Migration: Preserve teams when round is deleted
-- Changes FK behavior from ON DELETE CASCADE to ON DELETE SET NULL
-- Teams and players should only be deleted via the "Times" admin tab

-- 1. Make round_id nullable in round_teams
ALTER TABLE round_teams ALTER COLUMN round_id DROP NOT NULL;

-- 2. Make round_id nullable in round_team_players
ALTER TABLE round_team_players ALTER COLUMN round_id DROP NOT NULL;

-- 3. Drop existing CASCADE constraints
ALTER TABLE round_teams DROP CONSTRAINT IF EXISTS round_teams_round_id_fkey;
ALTER TABLE round_team_players DROP CONSTRAINT IF EXISTS round_team_players_round_id_fkey;

-- 4. Re-add with SET NULL behavior
ALTER TABLE round_teams 
  ADD CONSTRAINT round_teams_round_id_fkey 
  FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE SET NULL;

ALTER TABLE round_team_players 
  ADD CONSTRAINT round_team_players_round_id_fkey 
  FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE SET NULL;
