-- Create player_rankings table for general classification management
CREATE TABLE IF NOT EXISTS public.player_rankings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  gols integer NOT NULL DEFAULT 0,
  assistencias integer NOT NULL DEFAULT 0,
  vitorias integer NOT NULL DEFAULT 0,
  empates integer NOT NULL DEFAULT 0,
  derrotas integer NOT NULL DEFAULT 0,
  presencas integer NOT NULL DEFAULT 0,
  faltas integer NOT NULL DEFAULT 0,
  atrasos integer NOT NULL DEFAULT 0,
  punicoes integer NOT NULL DEFAULT 0,
  cartoes_amarelos integer NOT NULL DEFAULT 0,
  cartoes_vermelhos integer NOT NULL DEFAULT 0,
  pontos_totais integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(player_id)
);

-- Enable Row Level Security
ALTER TABLE public.player_rankings ENABLE ROW LEVEL SECURITY;

-- Create policies for player_rankings
CREATE POLICY "Anyone can view player_rankings"
  ON public.player_rankings
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert player_rankings"
  ON public.player_rankings
  FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update player_rankings"
  ON public.player_rankings
  FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete player_rankings"
  ON public.player_rankings
  FOR DELETE
  USING (public.is_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_player_rankings_updated_at
  BEFORE UPDATE ON public.player_rankings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();