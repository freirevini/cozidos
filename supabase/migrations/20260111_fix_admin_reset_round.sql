-- Migration: Corrigir admin_reset_round function
-- Remove a chamada de recalc_round_aggregates após deletar dados
-- e adiciona mais limpezas necessárias

CREATE OR REPLACE FUNCTION public.admin_reset_round(p_round_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  match_ids UUID[];
  deleted_goals INT := 0;
  deleted_cards INT := 0;
  deleted_subs INT := 0;
  deleted_assists INT := 0;
  reset_matches INT := 0;
BEGIN
  -- Validar acesso admin
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado: apenas administradores podem executar esta função');
  END IF;

  -- Obter IDs das partidas da rodada
  SELECT ARRAY_AGG(id) INTO match_ids 
  FROM public.matches WHERE round_id = p_round_id;
  
  IF match_ids IS NULL OR array_length(match_ids, 1) IS NULL THEN
    -- Se não há partidas, apenas resetar o status da rodada
    UPDATE public.rounds
    SET status = 'a_iniciar'
    WHERE id = p_round_id;
    
    RETURN json_build_object(
      'success', true,
      'message', 'Rodada resetada (sem partidas)',
      'deleted_goals', 0,
      'deleted_cards', 0,
      'deleted_substitutions', 0,
      'reset_matches', 0
    );
  END IF;

  -- 1. Deletar assistências primeiro (referência a goals)
  DELETE FROM public.assists 
  WHERE goal_id IN (SELECT id FROM public.goals WHERE match_id = ANY(match_ids));
  GET DIAGNOSTICS deleted_assists = ROW_COUNT;
  
  -- 2. Deletar gols
  DELETE FROM public.goals WHERE match_id = ANY(match_ids);
  GET DIAGNOSTICS deleted_goals = ROW_COUNT;
  
  -- 3. Deletar cartões
  DELETE FROM public.cards WHERE match_id = ANY(match_ids);
  GET DIAGNOSTICS deleted_cards = ROW_COUNT;
  
  -- 4. Deletar substituições
  DELETE FROM public.substitutions WHERE match_id = ANY(match_ids);
  GET DIAGNOSTICS deleted_subs = ROW_COUNT;
  
  -- 5. Deletar registros de substitutos de ausência
  DELETE FROM public.match_absence_substitutes WHERE match_id = ANY(match_ids);
  
  -- 6. Deletar estatísticas da rodada
  DELETE FROM public.player_round_stats WHERE round_id = p_round_id;
  
  -- 7. Limpar registros de ausências da rodada (opcional - mantém se quiser preservar)
  -- DELETE FROM public.round_absences WHERE round_id = p_round_id;
  
  -- 8. Resetar partidas para estado inicial
  UPDATE public.matches
  SET status = 'not_started',
      score_home = 0,
      score_away = 0,
      started_at = NULL,
      finished_at = NULL,
      match_timer_started_at = NULL,
      match_timer_paused_at = NULL,
      match_timer_total_paused_seconds = 0
  WHERE round_id = p_round_id;
  GET DIAGNOSTICS reset_matches = ROW_COUNT;
  
  -- 9. Resetar status da rodada para 'a_iniciar'
  UPDATE public.rounds
  SET status = 'a_iniciar',
      completed_at = NULL
  WHERE id = p_round_id;
  
  -- NÃO chamar recalc aqui pois os dados foram deletados
  -- O recálculo deve ser feito quando novas partidas forem finalizadas

  RETURN json_build_object(
    'success', true,
    'message', 'Rodada resetada com sucesso',
    'deleted_goals', deleted_goals,
    'deleted_assists', deleted_assists,
    'deleted_cards', deleted_cards,
    'deleted_substitutions', deleted_subs,
    'reset_matches', reset_matches
  );
END;
$$;

-- Garantir permissão
GRANT EXECUTE ON FUNCTION public.admin_reset_round(UUID) TO authenticated;
