-- Add ON DELETE CASCADE to foreign keys for proper round deletion

-- First, drop existing foreign keys
ALTER TABLE round_team_players DROP CONSTRAINT IF EXISTS round_team_players_round_id_fkey;
ALTER TABLE round_teams DROP CONSTRAINT IF EXISTS round_teams_round_id_fkey;
ALTER TABLE player_attendance DROP CONSTRAINT IF EXISTS player_attendance_round_id_fkey;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_round_id_fkey;
ALTER TABLE player_round_stats DROP CONSTRAINT IF EXISTS player_round_stats_round_id_fkey;
ALTER TABLE punishments DROP CONSTRAINT IF EXISTS punishments_round_id_fkey;

-- Re-add foreign keys with ON DELETE CASCADE
ALTER TABLE round_team_players 
  ADD CONSTRAINT round_team_players_round_id_fkey 
  FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE;

ALTER TABLE round_teams 
  ADD CONSTRAINT round_teams_round_id_fkey 
  FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE;

ALTER TABLE player_attendance 
  ADD CONSTRAINT player_attendance_round_id_fkey 
  FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE;

ALTER TABLE matches 
  ADD CONSTRAINT matches_round_id_fkey 
  FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE;

ALTER TABLE player_round_stats 
  ADD CONSTRAINT player_round_stats_round_id_fkey 
  FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE;

ALTER TABLE punishments 
  ADD CONSTRAINT punishments_round_id_fkey 
  FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE;

-- Add RLS policy for deleting rounds
CREATE POLICY "Admins can delete rounds"
ON rounds
FOR DELETE
USING (is_admin(auth.uid()));