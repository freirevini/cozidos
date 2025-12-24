-- Create substitutions table
CREATE TABLE IF NOT EXISTS public.substitutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_color public.team_color NOT NULL,
  player_out_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  player_in_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  minute integer NOT NULL CHECK (minute >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.substitutions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can manage substitutions"
ON public.substitutions
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Anyone can view substitutions"
ON public.substitutions
FOR SELECT
TO authenticated
USING (true);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_substitutions_match_id ON public.substitutions(match_id);

-- Enable realtime for substitutions
ALTER PUBLICATION supabase_realtime ADD TABLE public.substitutions;