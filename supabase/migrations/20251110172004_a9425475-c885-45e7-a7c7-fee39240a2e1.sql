-- Update recalc_rankings_on_round_delete trigger function to use cartoes_azuis
CREATE OR REPLACE FUNCTION public.recalc_rankings_on_round_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Recalculate player_rankings for all approved players
  INSERT INTO public.player_rankings (
    player_id, nickname, email,
    vitorias, empates, derrotas,
    gols, assistencias,
    cartoes_amarelos, cartoes_azuis,
    atrasos, faltas, punicoes,
    presencas, pontos_totais
  )
  SELECT 
    pr.id as player_id,
    COALESCE(pr.nickname, pr.name) as nickname,
    pr.email,
    COALESCE(SUM(prs.victories), 0) as vitorias,
    COALESCE(SUM(prs.draws), 0) as empates,
    COALESCE(SUM(prs.defeats), 0) as derrotas,
    COALESCE((SELECT COUNT(*) FROM public.goals g JOIN public.matches m ON m.id = g.match_id WHERE g.player_id = pr.id AND g.is_own_goal = false), 0) as gols,
    COALESCE((SELECT COUNT(*) FROM public.assists a WHERE a.player_id = pr.id), 0) as assistencias,
    COALESCE(SUM(prs.yellow_cards), 0) as cartoes_amarelos,
    COALESCE(SUM(prs.blue_cards), 0) as cartoes_azuis,
    COALESCE(SUM(prs.lates), 0) as atrasos,
    COALESCE(SUM(prs.absences), 0) as faltas,
    COALESCE(SUM(prs.punishments), 0) as punicoes,
    COALESCE(COUNT(DISTINCT prs.round_id) FILTER (WHERE prs.presence_points > 0), 0) as presencas,
    COALESCE(SUM(prs.total_points), 0) as pontos_totais
  FROM public.profiles pr
  LEFT JOIN public.player_round_stats prs ON prs.player_id = pr.id
  WHERE pr.is_player = true AND pr.status = 'aprovado'
  GROUP BY pr.id, pr.nickname, pr.name, pr.email
  ON CONFLICT (player_id)
  DO UPDATE SET
    vitorias = EXCLUDED.vitorias,
    empates = EXCLUDED.empates,
    derrotas = EXCLUDED.derrotas,
    gols = EXCLUDED.gols,
    assistencias = EXCLUDED.assistencias,
    cartoes_amarelos = EXCLUDED.cartoes_amarelos,
    cartoes_azuis = EXCLUDED.cartoes_azuis,
    atrasos = EXCLUDED.atrasos,
    faltas = EXCLUDED.faltas,
    punicoes = EXCLUDED.punicoes,
    presencas = EXCLUDED.presencas,
    pontos_totais = EXCLUDED.pontos_totais,
    nickname = EXCLUDED.nickname,
    updated_at = NOW();
    
  RETURN OLD;
END;
$$;