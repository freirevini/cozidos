-- Create enum types
CREATE TYPE team_color AS ENUM ('branco', 'vermelho', 'azul', 'laranja');
CREATE TYPE player_level AS ENUM ('A', 'B', 'C', 'D', 'E');
CREATE TYPE player_position AS ENUM ('goleiro', 'defensor', 'meio-campista', 'atacante');
CREATE TYPE card_type AS ENUM ('amarelo', 'vermelho');
CREATE TYPE attendance_status AS ENUM ('presente', 'atrasado', 'falta');

-- Players table
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  level player_level NOT NULL,
  position player_position NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Rounds table
CREATE TABLE public.rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, completed
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  completed_at TIMESTAMPTZ
);

-- Round participants (which teams are playing in this round)
CREATE TABLE public.round_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID REFERENCES public.rounds(id) ON DELETE CASCADE NOT NULL,
  team_color team_color NOT NULL,
  UNIQUE(round_id, team_color)
);

-- Player attendance for each round
CREATE TABLE public.player_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID REFERENCES public.rounds(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  team_color team_color NOT NULL,
  status attendance_status NOT NULL DEFAULT 'presente',
  UNIQUE(round_id, player_id)
);

-- Matches table
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID REFERENCES public.rounds(id) ON DELETE CASCADE NOT NULL,
  match_number INTEGER NOT NULL,
  team_home team_color NOT NULL,
  team_away team_color NOT NULL,
  score_home INTEGER DEFAULT 0 NOT NULL,
  score_away INTEGER DEFAULT 0 NOT NULL,
  scheduled_time TIME NOT NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  UNIQUE(round_id, match_number)
);

-- Goals table
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  team_color team_color NOT NULL,
  minute INTEGER NOT NULL,
  is_own_goal BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Assists table
CREATE TABLE public.assists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID REFERENCES public.goals(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  UNIQUE(goal_id)
);

-- Cards table
CREATE TABLE public.cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  card_type card_type NOT NULL,
  minute INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Manual punishments table
CREATE TABLE public.punishments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  round_id UUID REFERENCES public.rounds(id) ON DELETE CASCADE NOT NULL,
  points INTEGER NOT NULL CHECK (points >= -15 AND points <= -10),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- User roles table for admin management
CREATE TYPE user_role AS ENUM ('user', 'admin');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.punishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = is_admin.user_id
    AND role = 'admin'
  );
$$;

-- RLS Policies - Everyone can read
CREATE POLICY "Anyone can view players"
  ON public.players FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view rounds"
  ON public.rounds FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view round_teams"
  ON public.round_teams FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view player_attendance"
  ON public.player_attendance FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view matches"
  ON public.matches FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view goals"
  ON public.goals FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view assists"
  ON public.assists FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view cards"
  ON public.cards FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view punishments"
  ON public.punishments FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view user_roles"
  ON public.user_roles FOR SELECT
  USING (true);

-- RLS Policies - Only admins can write
CREATE POLICY "Admins can insert players"
  ON public.players FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update players"
  ON public.players FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete players"
  ON public.players FOR DELETE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert rounds"
  ON public.rounds FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update rounds"
  ON public.rounds FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert round_teams"
  ON public.round_teams FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert player_attendance"
  ON public.player_attendance FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update player_attendance"
  ON public.player_attendance FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert matches"
  ON public.matches FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update matches"
  ON public.matches FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert goals"
  ON public.goals FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert assists"
  ON public.assists FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert cards"
  ON public.cards FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert punishments"
  ON public.punishments FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update punishments"
  ON public.punishments FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete punishments"
  ON public.punishments FOR DELETE
  USING (public.is_admin(auth.uid()));

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for players table
CREATE TRIGGER update_players_updated_at
  BEFORE UPDATE ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.goals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.assists;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cards;