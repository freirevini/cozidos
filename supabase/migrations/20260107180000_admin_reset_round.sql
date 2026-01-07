-- Migration: admin_reset_round function
-- Allows admin to reset a round to initial state, keeping only team assignments

CREATE OR REPLACE FUNCTION public.admin_reset_round(p_round_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  match_ids UUID[];
  deleted_goals INT;
  deleted_cards INT;
  deleted_subs INT;
  reset_matches INT;
BEGIN
  -- Validar acesso admin
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado: apenas administradores podem executar esta função');
  END IF;

  -- Obter IDs das partidas da rodada
  SELECT ARRAY_AGG(id) INTO match_ids 
  FROM public.matches WHERE round_id = p_round_id;
  
  IF match_ids IS NULL OR array_length(match_ids, 1) IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Nenhuma partida encontrada para esta rodada');
  END IF;

  -- 1. Deletar assistências (CASCADE já cuida via foreign key de goals)
  -- 2. Deletar gols
  DELETE FROM public.goals WHERE match_id = ANY(match_ids);
  GET DIAGNOSTICS deleted_goals = ROW_COUNT;
  
  -- 3. Deletar cartões
  DELETE FROM public.cards WHERE match_id = ANY(match_ids);
  GET DIAGNOSTICS deleted_cards = ROW_COUNT;
  
  -- 4. Deletar substituições
  DELETE FROM public.substitutions WHERE match_id = ANY(match_ids);
  GET DIAGNOSTICS deleted_subs = ROW_COUNT;
  
  -- 5. Deletar estatísticas da rodada
  DELETE FROM public.player_round_stats WHERE round_id = p_round_id;
  
  -- 6. Resetar partidas para estado inicial
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
  
  -- 7. Resetar status da rodada para 'a_iniciar'
  UPDATE public.rounds
  SET status = 'a_iniciar'
  WHERE id = p_round_id;
  
  -- 8. Recalcular rankings globais para refletir mudanças
  PERFORM public.recalc_round_aggregates(p_round_id);

  RETURN json_build_object(
    'success', true,
    'message', 'Rodada resetada com sucesso',
    'deleted_goals', deleted_goals,
    'deleted_cards', deleted_cards,
    'deleted_substitutions', deleted_subs,
    'reset_matches', reset_matches
  );
END;
$$;
