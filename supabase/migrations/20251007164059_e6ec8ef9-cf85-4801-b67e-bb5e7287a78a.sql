-- Add new fields to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nickname text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_player boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS player_type text; -- 'mensal' or 'avulso'
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS level player_level;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS position player_position;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_approved boolean DEFAULT false;

-- Create table for player statistics per round
CREATE TABLE IF NOT EXISTS public.player_round_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  round_id uuid REFERENCES public.rounds(id) ON DELETE CASCADE NOT NULL,
  presence_points integer DEFAULT 0,
  victory_points integer DEFAULT 0,
  draw_points integer DEFAULT 0,
  defeat_points integer DEFAULT 0,
  late_points integer DEFAULT 0,
  absence_points integer DEFAULT 0,
  punishment_points integer DEFAULT 0,
  card_points integer DEFAULT 0,
  goal_points integer DEFAULT 0,
  total_points integer DEFAULT 0,
  victories integer DEFAULT 0,
  draws integer DEFAULT 0,
  defeats integer DEFAULT 0,
  lates integer DEFAULT 0,
  absences integer DEFAULT 0,
  punishments integer DEFAULT 0,
  yellow_cards integer DEFAULT 0,
  red_cards integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(player_id, round_id)
);

ALTER TABLE public.player_round_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view player_round_stats"
ON public.player_round_stats FOR SELECT
USING (true);

CREATE POLICY "Admins can insert player_round_stats"
ON public.player_round_stats FOR INSERT
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update player_round_stats"
ON public.player_round_stats FOR UPDATE
USING (is_admin(auth.uid()));

-- Create table for round team players (which players are on which team in a round)
CREATE TABLE IF NOT EXISTS public.round_team_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid REFERENCES public.rounds(id) ON DELETE CASCADE NOT NULL,
  player_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  team_color team_color NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(round_id, player_id)
);

ALTER TABLE public.round_team_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view round_team_players"
ON public.round_team_players FOR SELECT
USING (true);

CREATE POLICY "Admins can insert round_team_players"
ON public.round_team_players FOR INSERT
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update round_team_players"
ON public.round_team_players FOR UPDATE
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete round_team_players"
ON public.round_team_players FOR DELETE
USING (is_admin(auth.uid()));

-- Add scheduled_date to rounds
ALTER TABLE public.rounds ADD COLUMN IF NOT EXISTS scheduled_date date;

-- Update matches table to include match status
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS status text DEFAULT 'not_started'; -- 'not_started', 'in_progress', 'finished'