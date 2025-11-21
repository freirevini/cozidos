-- Atualizar função recalc_all_player_rankings para incluir ajustes no cálculo de pontos totais
CREATE OR REPLACE FUNCTION public.recalc_all_player_rankings()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validar acesso admin
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  -- Recalcular player_rankings para todos os jogadores aprovados
  -- INCLUINDO ajustes manuais E pontos calculados a partir dos ajustes
  INSERT INTO public.player_rankings (
    player_id, nickname, email,
    gols, assistencias,
    vitorias, empates, derrotas,
    presencas, faltas, atrasos, punicoes,
    cartoes_amarelos, cartoes_azuis,
    pontos_totais
  )
  SELECT 
    pr.id as player_id,
    COALESCE(pr.nickname, pr.name) as nickname,
    pr.email,
    
    -- Gols = eventos reais + ajustes
    COALESCE((SELECT COUNT(*) FROM public.goals g JOIN public.matches m ON m.id = g.match_id WHERE g.player_id = pr.id AND g.is_own_goal = false), 0)
    + COALESCE((SELECT SUM(adjustment_value) FROM public.player_ranking_adjustments WHERE player_id = pr.id AND adjustment_type = 'gols'), 0) as gols,
    
    -- Assistências = eventos reais + ajustes
    COALESCE((SELECT COUNT(*) FROM public.assists a WHERE a.player_id = pr.id), 0)
    + COALESCE((SELECT SUM(adjustment_value) FROM public.player_ranking_adjustments WHERE player_id = pr.id AND adjustment_type = 'assistencias'), 0) as assistencias,
    
    -- Vitórias = stats + ajustes
    COALESCE(SUM(prs.victories), 0)
    + COALESCE((SELECT SUM(adjustment_value) FROM public.player_ranking_adjustments WHERE player_id = pr.id AND adjustment_type = 'vitorias'), 0) as vitorias,
    
    -- Empates = stats + ajustes
    COALESCE(SUM(prs.draws), 0)
    + COALESCE((SELECT SUM(adjustment_value) FROM public.player_ranking_adjustments WHERE player_id = pr.id AND adjustment_type = 'empates'), 0) as empates,
    
    -- Derrotas = stats + ajustes
    COALESCE(SUM(prs.defeats), 0)
    + COALESCE((SELECT SUM(adjustment_value) FROM public.player_ranking_adjustments WHERE player_id = pr.id AND adjustment_type = 'derrotas'), 0) as derrotas,
    
    -- Presenças = stats + ajustes
    COALESCE(COUNT(DISTINCT prs.round_id) FILTER (WHERE prs.presence_points > 0), 0)
    + COALESCE((SELECT SUM(adjustment_value) FROM public.player_ranking_adjustments WHERE player_id = pr.id AND adjustment_type = 'presencas'), 0) as presencas,
    
    -- Faltas = stats + ajustes
    COALESCE(SUM(prs.absences), 0)
    + COALESCE((SELECT SUM(adjustment_value) FROM public.player_ranking_adjustments WHERE player_id = pr.id AND adjustment_type = 'faltas'), 0) as faltas,
    
    -- Atrasos = stats + ajustes
    COALESCE(SUM(prs.lates), 0)
    + COALESCE((SELECT SUM(adjustment_value) FROM public.player_ranking_adjustments WHERE player_id = pr.id AND adjustment_type = 'atrasos'), 0) as atrasos,
    
    -- Punições = stats + ajustes
    COALESCE(SUM(prs.punishments), 0)
    + COALESCE((SELECT SUM(adjustment_value) FROM public.player_ranking_adjustments WHERE player_id = pr.id AND adjustment_type = 'punicoes'), 0) as punicoes,
    
    -- Cartões amarelos = stats + ajustes
    COALESCE(SUM(prs.yellow_cards), 0)
    + COALESCE((SELECT SUM(adjustment_value) FROM public.player_ranking_adjustments WHERE player_id = pr.id AND adjustment_type = 'cartoes_amarelos'), 0) as cartoes_amarelos,
    
    -- Cartões azuis = stats + ajustes
    COALESCE(SUM(prs.blue_cards), 0)
    + COALESCE((SELECT SUM(adjustment_value) FROM public.player_ranking_adjustments WHERE player_id = pr.id AND adjustment_type = 'cartoes_azuis'), 0) as cartoes_azuis,
    
    -- Pontos totais = stats + pontos extras derivados dos ajustes
    COALESCE(SUM(prs.total_points), 0) + (
      -- Calcular pontos extras baseados nos ajustes aplicados
      COALESCE((SELECT SUM(adjustment_value) FROM public.player_ranking_adjustments WHERE player_id = pr.id AND adjustment_type = 'gols'), 0) * 1 +
      COALESCE((SELECT SUM(adjustment_value) FROM public.player_ranking_adjustments WHERE player_id = pr.id AND adjustment_type = 'assistencias'), 0) * 2 +
      COALESCE((SELECT SUM(adjustment_value) FROM public.player_ranking_adjustments WHERE player_id = pr.id AND adjustment_type = 'vitorias'), 0) * 3 +
      COALESCE((SELECT SUM(adjustment_value) FROM public.player_ranking_adjustments WHERE player_id = pr.id AND adjustment_type = 'empates'), 0) * 1 +
      COALESCE((SELECT SUM(adjustment_value) FROM public.player_ranking_adjustments WHERE player_id = pr.id AND adjustment_type = 'cartoes_amarelos'), 0) * (-1) +
      COALESCE((SELECT SUM(adjustment_value) FROM public.player_ranking_adjustments WHERE player_id = pr.id AND adjustment_type = 'cartoes_azuis'), 0) * (-2) +
      COALESCE((SELECT SUM(adjustment_value) FROM public.player_ranking_adjustments WHERE player_id = pr.id AND adjustment_type = 'atrasos'), 0) * (-5) +
      COALESCE((SELECT SUM(adjustment_value) FROM public.player_ranking_adjustments WHERE player_id = pr.id AND adjustment_type = 'faltas'), 0) * (-10)
    ) as pontos_totais
  FROM public.profiles pr
  LEFT JOIN public.player_round_stats prs ON prs.player_id = pr.id
  WHERE pr.is_player = true AND pr.status = 'aprovado'
  GROUP BY pr.id, pr.nickname, pr.name, pr.email
  ON CONFLICT (player_id)
  DO UPDATE SET
    gols = EXCLUDED.gols,
    assistencias = EXCLUDED.assistencias,
    vitorias = EXCLUDED.vitorias,
    empates = EXCLUDED.empates,
    derrotas = EXCLUDED.derrotas,
    presencas = EXCLUDED.presencas,
    faltas = EXCLUDED.faltas,
    atrasos = EXCLUDED.atrasos,
    punicoes = EXCLUDED.punicoes,
    cartoes_amarelos = EXCLUDED.cartoes_amarelos,
    cartoes_azuis = EXCLUDED.cartoes_azuis,
    pontos_totais = EXCLUDED.pontos_totais,
    nickname = EXCLUDED.nickname,
    updated_at = NOW();
    
  RETURN json_build_object('success', true, 'message', 'Rankings recalculados com ajustes aplicados');
END;
$function$;