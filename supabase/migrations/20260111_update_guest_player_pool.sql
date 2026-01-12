-- Migration: Update create_guest_player to support pool (guests show in pool before team allocation)
-- Strategy: Create a "round_guests" table to track guests created for a round but not yet allocated

-- Create round_guests table to track unallocated guests
CREATE TABLE IF NOT EXISTS public.round_guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(round_id, player_id)
);

-- Enable RLS
ALTER TABLE public.round_guests ENABLE ROW LEVEL SECURITY;

-- Create policy for admins
CREATE POLICY "Admins can manage round_guests" ON public.round_guests
    FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated users can view round_guests" ON public.round_guests
    FOR SELECT USING (auth.role() = 'authenticated');

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON public.round_guests TO authenticated;

-- Drop old function first
DROP FUNCTION IF EXISTS public.create_guest_player(TEXT, UUID, TEXT);

-- Create updated function that supports NULL team_color (pool)
CREATE OR REPLACE FUNCTION public.create_guest_player(
  p_name TEXT,
  p_round_id UUID,
  p_team_color TEXT DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_player_id UUID;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  IF p_name IS NULL OR LENGTH(TRIM(p_name)) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Nome é obrigatório');
  END IF;

  IF p_team_color IS NOT NULL AND p_team_color NOT IN ('branco', 'preto', 'azul', 'laranja') THEN
    RETURN json_build_object('success', false, 'error', 'Cor do time inválida');
  END IF;

  -- Create guest profile
  INSERT INTO public.profiles (name, nickname, is_player, is_guest, status, created_at)
  VALUES (TRIM(p_name), TRIM(p_name), false, true, 'aprovado', NOW())
  RETURNING id INTO v_player_id;

  IF p_team_color IS NOT NULL THEN
    -- Directly add to team
    INSERT INTO public.round_team_players (round_id, player_id, team_color)
    VALUES (p_round_id, v_player_id, p_team_color::team_color);
    
    RETURN json_build_object('success', true, 'player_id', v_player_id, 'message', 'Jogador criado e alocado');
  ELSE
    -- Add to round_guests pool (not allocated to team yet)
    INSERT INTO public.round_guests (round_id, player_id)
    VALUES (p_round_id, v_player_id);
    
    RETURN json_build_object('success', true, 'player_id', v_player_id, 'message', 'Convidado criado. Aloque em um time.');
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_guest_player(TEXT, UUID, TEXT) TO authenticated;

-- Create function to allocate guest to team
CREATE OR REPLACE FUNCTION public.allocate_guest_to_team(
  p_player_id UUID,
  p_round_id UUID,
  p_team_color TEXT
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_player_id AND is_guest = true) THEN
    RETURN json_build_object('success', false, 'error', 'Jogador não é um convidado');
  END IF;

  IF p_team_color NOT IN ('branco', 'preto', 'azul', 'laranja') THEN
    RETURN json_build_object('success', false, 'error', 'Cor do time inválida');
  END IF;

  -- Check if already in round_team_players
  IF EXISTS (SELECT 1 FROM public.round_team_players WHERE player_id = p_player_id AND round_id = p_round_id) THEN
    UPDATE public.round_team_players 
    SET team_color = p_team_color::team_color
    WHERE player_id = p_player_id AND round_id = p_round_id;
  ELSE
    INSERT INTO public.round_team_players (round_id, player_id, team_color)
    VALUES (p_round_id, p_player_id, p_team_color::team_color);
  END IF;

  -- Remove from round_guests pool if exists
  DELETE FROM public.round_guests WHERE player_id = p_player_id AND round_id = p_round_id;

  RETURN json_build_object('success', true, 'message', 'Convidado alocado com sucesso');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.allocate_guest_to_team(UUID, UUID, TEXT) TO authenticated;
