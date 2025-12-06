
-- BLOCO B: Função RPC atômica para registrar gol com assistência
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
  
  -- Validar team_color
  IF p_team_color NOT IN ('branco', 'vermelho', 'azul', 'laranja') THEN
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
  INSERT INTO public.goals (
    match_id,
    player_id,
    team_color,
    minute,
    is_own_goal
  ) VALUES (
    p_match_id,
    CASE WHEN p_is_own_goal THEN NULL ELSE p_scorer_profile_id END,
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

-- Adicionar comentário para documentação
COMMENT ON FUNCTION public.record_goal_with_assist IS 'Registra gol e assistência atomicamente, atualizando placar automaticamente';
