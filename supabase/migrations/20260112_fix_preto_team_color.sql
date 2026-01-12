-- Migration: Fix team color validation to use 'preto' instead of 'vermelho'
-- This fixes the error "Cor de time inválida" when registering goals for the Preto team

-- Fix record_goal_with_assist function
CREATE OR REPLACE FUNCTION public.record_goal_with_assist(
  p_match_id uuid,
  p_team_color text,
  p_scorer_profile_id uuid,
  p_minute integer,
  p_is_own_goal boolean DEFAULT false,
  p_assist_profile_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_goal_id uuid;
  v_assist_id uuid;
  v_match_round_id uuid;
  v_actor_id uuid;
BEGIN
  -- Capturar actor_id para auditoria
  v_actor_id := auth.uid();
  
  -- Validar permissão admin
  IF NOT public.is_admin(v_actor_id) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado: apenas administradores podem registrar gols');
  END IF;
  
  -- Validar match existe e obter round_id
  SELECT round_id INTO v_match_round_id
  FROM public.matches
  WHERE id = p_match_id;
  
  IF v_match_round_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Partida não encontrada');
  END IF;
  
  -- Validar team_color - FIXED: using 'preto' instead of 'vermelho'
  IF p_team_color NOT IN ('branco', 'preto', 'azul', 'laranja') THEN
    RETURN json_build_object('success', false, 'error', 'Cor de time inválida');
  END IF;
  
  -- Validar minuto
  IF p_minute < 0 OR p_minute > 120 THEN
    RETURN json_build_object('success', false, 'error', 'Minuto inválido (0-120)');
  END IF;
  
  -- Validar scorer existe (se não for gol contra)
  IF NOT p_is_own_goal AND p_scorer_profile_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_scorer_profile_id) THEN
      RETURN json_build_object('success', false, 'error', 'Jogador marcador não encontrado');
    END IF;
  END IF;
  
  -- Validar assist existe (se fornecido)
  IF p_assist_profile_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_assist_profile_id) THEN
      RETURN json_build_object('success', false, 'error', 'Jogador assistente não encontrado');
    END IF;
  END IF;
  
  -- TRANSAÇÃO ATÔMICA: Inserir gol
  -- Para gol contra: guardar o player_id para saber quem fez o gol contra
  INSERT INTO public.goals (
    match_id,
    player_id,
    team_color,
    minute,
    is_own_goal
  ) VALUES (
    p_match_id,
    p_scorer_profile_id,  -- Guardar player_id mesmo em gol contra
    p_team_color::public.team_color,
    p_minute,
    p_is_own_goal
  )
  RETURNING id INTO v_goal_id;
  
  -- Inserir assistência se fornecida (e não é gol contra)
  IF p_assist_profile_id IS NOT NULL AND NOT p_is_own_goal THEN
    -- Verificar duplicidade
    IF NOT EXISTS (SELECT 1 FROM public.assists WHERE goal_id = v_goal_id) THEN
      INSERT INTO public.assists (goal_id, player_id)
      VALUES (v_goal_id, p_assist_profile_id)
      RETURNING id INTO v_assist_id;
    END IF;
  END IF;
  
  -- Atualizar placar da partida
  UPDATE public.matches
  SET 
    score_home = (
      SELECT COUNT(*) FROM public.goals g 
      WHERE g.match_id = p_match_id 
      AND ((g.team_color = team_home AND NOT g.is_own_goal) 
           OR (g.team_color = team_away AND g.is_own_goal))
    ),
    score_away = (
      SELECT COUNT(*) FROM public.goals g 
      WHERE g.match_id = p_match_id 
      AND ((g.team_color = team_away AND NOT g.is_own_goal) 
           OR (g.team_color = team_home AND g.is_own_goal))
    )
  WHERE id = p_match_id;
  
  -- Registrar no audit_log
  INSERT INTO public.audit_log (action, actor_id, metadata)
  VALUES (
    'record_goal_with_assist',
    v_actor_id,
    jsonb_build_object(
      'goal_id', v_goal_id,
      'assist_id', v_assist_id,
      'match_id', p_match_id,
      'scorer_id', p_scorer_profile_id,
      'assist_player_id', p_assist_profile_id,
      'team_color', p_team_color,
      'minute', p_minute,
      'is_own_goal', p_is_own_goal
    )
  );
  
  RETURN json_build_object(
    'success', true,
    'goal_id', v_goal_id,
    'assist_id', v_assist_id,
    'round_id', v_match_round_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Fix record_substitution function
CREATE OR REPLACE FUNCTION public.record_substitution(
  p_match_id uuid,
  p_team_color text,
  p_player_in_id uuid,
  p_player_out_id uuid,
  p_minute integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_substitution_id uuid;
  v_match_round_id uuid;
  v_actor_id uuid;
BEGIN
  -- Capturar actor_id para auditoria
  v_actor_id := auth.uid();
  
  -- Validar permissão admin
  IF NOT public.is_admin(v_actor_id) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado: apenas administradores podem registrar substituições');
  END IF;
  
  -- Validar match existe e obter round_id
  SELECT round_id INTO v_match_round_id
  FROM public.matches
  WHERE id = p_match_id;
  
  IF v_match_round_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Partida não encontrada');
  END IF;
  
  -- Validar team_color - FIXED: using 'preto' instead of 'vermelho'
  IF p_team_color NOT IN ('branco', 'preto', 'azul', 'laranja') THEN
    RETURN json_build_object('success', false, 'error', 'Cor de time inválida');
  END IF;
  
  -- Validar minuto
  IF p_minute < 0 OR p_minute > 120 THEN
    RETURN json_build_object('success', false, 'error', 'Minuto inválido (0-120)');
  END IF;
  
  -- Validar jogadores existem
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_player_in_id) THEN
    RETURN json_build_object('success', false, 'error', 'Jogador que entra não encontrado');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_player_out_id) THEN
    RETURN json_build_object('success', false, 'error', 'Jogador que sai não encontrado');
  END IF;
  
  -- Validar que são jogadores diferentes
  IF p_player_in_id = p_player_out_id THEN
    RETURN json_build_object('success', false, 'error', 'Jogador que entra e que sai devem ser diferentes');
  END IF;
  
  -- Validar que ambos os jogadores estão no time correto da rodada
  IF NOT EXISTS (
    SELECT 1 FROM public.round_team_players 
    WHERE round_id = v_match_round_id 
    AND team_color = p_team_color::team_color
    AND player_id = p_player_in_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Jogador que entra não está escalado neste time');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM public.round_team_players 
    WHERE round_id = v_match_round_id 
    AND team_color = p_team_color::team_color
    AND player_id = p_player_out_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Jogador que sai não está escalado neste time');
  END IF;
  
  -- Inserir substituição
  INSERT INTO public.substitutions (
    match_id,
    team_color,
    player_in_id,
    player_out_id,
    minute,
    created_by
  ) VALUES (
    p_match_id,
    p_team_color::team_color,
    p_player_in_id,
    p_player_out_id,
    p_minute,
    v_actor_id
  )
  RETURNING id INTO v_substitution_id;
  
  -- Registrar no audit_log
  INSERT INTO public.audit_log (action, actor_id, metadata)
  VALUES (
    'record_substitution',
    v_actor_id,
    jsonb_build_object(
      'substitution_id', v_substitution_id,
      'match_id', p_match_id,
      'team_color', p_team_color,
      'player_in_id', p_player_in_id,
      'player_out_id', p_player_out_id,
      'minute', p_minute
    )
  );
  
  RETURN json_build_object(
    'success', true,
    'substitution_id', v_substitution_id,
    'round_id', v_match_round_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Add own_goals column to player_round_stats for tracking own goals per round
ALTER TABLE public.player_round_stats 
ADD COLUMN IF NOT EXISTS own_goals INTEGER DEFAULT 0;

-- Add own_goals column to player_rankings for total own goals
ALTER TABLE public.player_rankings 
ADD COLUMN IF NOT EXISTS own_goals INTEGER DEFAULT 0;

COMMENT ON COLUMN public.player_round_stats.own_goals IS 'Gols contra marcados pelo jogador nesta rodada';
COMMENT ON COLUMN public.player_rankings.own_goals IS 'Total de gols contra marcados pelo jogador';
