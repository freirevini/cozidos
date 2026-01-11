-- Migration: Update create_guest_player to support pool (no team)
-- Allows creating guests without immediately assigning to a team

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
  -- Validate admin access
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  -- Validar inputs
  IF p_name IS NULL OR LENGTH(TRIM(p_name)) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Nome é obrigatório');
  END IF;

  -- Validate team color if provided
  IF p_team_color IS NOT NULL AND p_team_color NOT IN ('branco', 'preto', 'azul', 'laranja', 'pool') THEN
    RETURN json_build_object('success', false, 'error', 'Cor do time inválida');
  END IF;

  -- Criar o perfil do jogador avulso
  INSERT INTO public.profiles (
    name,
    nickname,
    is_player,
    is_guest,
    status,
    created_at
  ) VALUES (
    TRIM(p_name),
    TRIM(p_name) || ' (Avulso)',
    false,  -- is_player = false para não aparecer na gestão de jogadores
    true,   -- is_guest = true
    'aprovado',
    NOW()
  )
  RETURNING id INTO v_player_id;

  -- Add to round/team only if a valid team color is provided
  IF p_team_color IS NOT NULL AND p_team_color IN ('branco', 'preto', 'azul', 'laranja') THEN
    INSERT INTO public.round_team_players (
      round_id,
      player_id,
      team_color
    ) VALUES (
      p_round_id,
      v_player_id,
      p_team_color::team_color
    );
  ELSE
    -- Create entry with 'pool' as a marker (will be updated later)
    -- Actually we need to insert to round_team_players for them to show
    -- Use a temporary approach: insert without valid team_color using direct SQL
    -- For now, let's insert with 'branco' as placeholder and track via is_guest
    -- Better approach: Just don't insert to round_team_players until allocated
    NULL; -- Guest stays in profiles only, will be added to round_team_players when allocated
  END IF;

  RETURN json_build_object(
    'success', true, 
    'player_id', v_player_id,
    'message', 'Jogador avulso criado. Aloque-o em uma equipe.'
  );
END;
$function$;

-- Grant permissions (function signature changed, need to update grants)
DROP FUNCTION IF EXISTS public.create_guest_player(TEXT, UUID, TEXT);
-- Recreate with default parameter
GRANT EXECUTE ON FUNCTION public.create_guest_player(TEXT, UUID, TEXT) TO authenticated;

-- Also create a function to allocate guest to team
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
  -- Validate admin access
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  -- Validate player is a guest
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_player_id AND is_guest = true) THEN
    RETURN json_build_object('success', false, 'error', 'Jogador não é um convidado');
  END IF;

  -- Validate team color
  IF p_team_color NOT IN ('branco', 'preto', 'azul', 'laranja') THEN
    RETURN json_build_object('success', false, 'error', 'Cor do time inválida');
  END IF;

  -- Check if already allocated to this round
  IF EXISTS (SELECT 1 FROM public.round_team_players WHERE player_id = p_player_id AND round_id = p_round_id) THEN
    -- Update team
    UPDATE public.round_team_players 
    SET team_color = p_team_color::team_color
    WHERE player_id = p_player_id AND round_id = p_round_id;
  ELSE
    -- Insert
    INSERT INTO public.round_team_players (round_id, player_id, team_color)
    VALUES (p_round_id, p_player_id, p_team_color::team_color);
  END IF;

  RETURN json_build_object('success', true, 'message', 'Convidado alocado com sucesso');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.allocate_guest_to_team(UUID, UUID, TEXT) TO authenticated;
