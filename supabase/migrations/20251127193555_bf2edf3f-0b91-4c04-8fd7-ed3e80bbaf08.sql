
-- Atualizar função apply_ranking_adjustment para validar valores negativos
CREATE OR REPLACE FUNCTION public.apply_ranking_adjustment(p_player_id uuid, p_adjustment_type text, p_new_total integer, p_reason text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_real INTEGER;
  v_current_adjustment INTEGER;
  v_current_total INTEGER;
  v_new_adjustment INTEGER;
  v_created_by UUID;
BEGIN
  -- Capturar auth.uid() - pode ser NULL se sessão expirada
  v_created_by := auth.uid();
  
  -- Log quando auth.uid() retorna NULL
  IF v_created_by IS NULL THEN
    RAISE NOTICE 'auth.uid() retornou NULL - Sessão inválida ou expirada';
    RETURN json_build_object('success', false, 'error', 'Sessão expirada ou inválida. Faça login novamente.');
  END IF;

  -- Validar acesso admin (apenas se há sessão válida)
  IF NOT public.is_admin(v_created_by) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  -- VALIDAÇÃO: Não permitir valores negativos
  IF p_new_total < 0 THEN
    RETURN json_build_object(
      'success', false, 
      'error', format('Valor inválido: %s não pode ser negativo', p_adjustment_type)
    );
  END IF;

  -- Calcular valor real dos eventos (sem ajustes)
  CASE p_adjustment_type
    WHEN 'gols' THEN
      SELECT COUNT(*) INTO v_current_real
      FROM public.goals g
      JOIN public.matches m ON m.id = g.match_id
      WHERE g.player_id = p_player_id AND g.is_own_goal = false;
      
    WHEN 'assistencias' THEN
      SELECT COUNT(*) INTO v_current_real
      FROM public.assists
      WHERE player_id = p_player_id;
      
    WHEN 'vitorias' THEN
      SELECT COALESCE(SUM(victories), 0) INTO v_current_real
      FROM public.player_round_stats
      WHERE player_id = p_player_id;
      
    WHEN 'empates' THEN
      SELECT COALESCE(SUM(draws), 0) INTO v_current_real
      FROM public.player_round_stats
      WHERE player_id = p_player_id;
      
    WHEN 'derrotas' THEN
      SELECT COALESCE(SUM(defeats), 0) INTO v_current_real
      FROM public.player_round_stats
      WHERE player_id = p_player_id;
      
    WHEN 'presencas' THEN
      SELECT COUNT(DISTINCT round_id) INTO v_current_real
      FROM public.player_round_stats
      WHERE player_id = p_player_id AND presence_points > 0;
      
    WHEN 'faltas' THEN
      SELECT COALESCE(SUM(absences), 0) INTO v_current_real
      FROM public.player_round_stats
      WHERE player_id = p_player_id;
      
    WHEN 'atrasos' THEN
      SELECT COALESCE(SUM(lates), 0) INTO v_current_real
      FROM public.player_round_stats
      WHERE player_id = p_player_id;
      
    WHEN 'punicoes' THEN
      SELECT COALESCE(SUM(punishments), 0) INTO v_current_real
      FROM public.player_round_stats
      WHERE player_id = p_player_id;
      
    WHEN 'cartoes_amarelos' THEN
      SELECT COALESCE(SUM(yellow_cards), 0) INTO v_current_real
      FROM public.player_round_stats
      WHERE player_id = p_player_id;
      
    WHEN 'cartoes_azuis' THEN
      SELECT COALESCE(SUM(blue_cards), 0) INTO v_current_real
      FROM public.player_round_stats
      WHERE player_id = p_player_id;
      
    ELSE
      RETURN json_build_object('success', false, 'error', 'Tipo de ajuste inválido');
  END CASE;

  -- Buscar ajuste atual
  SELECT COALESCE(SUM(adjustment_value), 0) INTO v_current_adjustment
  FROM public.player_ranking_adjustments
  WHERE player_id = p_player_id AND adjustment_type = p_adjustment_type;

  -- Calcular total atual
  v_current_total := v_current_real + v_current_adjustment;

  -- Calcular novo ajuste necessário
  v_new_adjustment := p_new_total - v_current_real;

  -- Deletar ajustes anteriores deste tipo para este jogador
  DELETE FROM public.player_ranking_adjustments
  WHERE player_id = p_player_id AND adjustment_type = p_adjustment_type;

  -- Inserir novo ajuste apenas se diferente de zero
  IF v_new_adjustment != 0 THEN
    INSERT INTO public.player_ranking_adjustments (
      player_id,
      adjustment_type,
      adjustment_value,
      reason,
      created_by
    ) VALUES (
      p_player_id,
      p_adjustment_type,
      v_new_adjustment,
      COALESCE(p_reason, format('Ajuste manual: %s → %s (real: %s, ajuste: %s)',
        v_current_total, p_new_total, v_current_real, v_new_adjustment)),
      v_created_by
    );
    
    RAISE NOTICE 'Ajuste criado com sucesso - created_by: %', v_created_by;
  END IF;

  -- Recalcular rankings
  PERFORM public.recalc_all_player_rankings();

  RETURN json_build_object(
    'success', true,
    'real_value', v_current_real,
    'old_adjustment', v_current_adjustment,
    'new_adjustment', v_new_adjustment,
    'old_total', v_current_total,
    'new_total', p_new_total
  );
END;
$function$;
