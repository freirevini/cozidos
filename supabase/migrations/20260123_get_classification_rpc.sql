-- Migration: Create unified classification RPC
-- Purpose: Replace dual sources (player_rankings + player_round_stats aggregation) with single RPC
-- Benefits: One source of truth, automatic adjustment application, cleaner frontend code

-- Drop old version if exists (had more parameters)
DROP FUNCTION IF EXISTS get_classification(integer, text, integer, uuid);

-- Create unified classification RPC
CREATE FUNCTION get_classification(
  p_season_year INT DEFAULT NULL,
  p_level TEXT DEFAULT NULL
)
RETURNS TABLE (
  player_id uuid,
  nickname text,
  avatar_url text,
  level text,
  presencas int,
  vitorias int,
  empates int,
  derrotas int,
  atrasos int,
  faltas int,
  punicoes int,
  cartoes_amarelos int,
  cartoes_azuis int,
  gols int,
  assistencias int,
  saldo_gols int,
  pontos_totais int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH aggregated_stats AS (
    SELECT 
      prs.player_id as agg_player_id,
      p.nickname,
      p.name,
      p.avatar_url,
      p.level::text as level_text,
      COUNT(*) FILTER (WHERE prs.presence_points > 0)::int as presencas,
      COALESCE(SUM(prs.victories), 0)::int as vitorias,
      COALESCE(SUM(prs.draws), 0)::int as empates,
      COALESCE(SUM(prs.defeats), 0)::int as derrotas,
      0 as atrasos,
      0 as faltas,
      0 as punicoes,
      COALESCE(SUM(prs.yellow_cards), 0)::int as cartoes_amarelos,
      COALESCE(SUM(prs.blue_cards), 0)::int as cartoes_azuis,
      COALESCE(SUM(prs.goals), 0)::int as gols,
      COALESCE(SUM(prs.assists), 0)::int as assistencias,
      COALESCE(SUM(prs.goal_difference), 0)::int as saldo_gols,
      COALESCE(SUM(prs.total_points), 0)::int as pontos_totais
    FROM player_round_stats prs
    JOIN profiles p ON p.id = prs.player_id
    JOIN rounds r ON r.id = prs.round_id
    WHERE p.is_player = true
      AND p.status = 'aprovado'
      AND COALESCE(p.is_guest, false) = false
      AND (p_season_year IS NULL OR EXTRACT(YEAR FROM r.scheduled_date) = p_season_year)
      AND (p_level IS NULL OR p.level::text = p_level)
    GROUP BY prs.player_id, p.nickname, p.name, p.avatar_url, p.level
  ),
  adjustments_aggregated AS (
    SELECT 
      pra.player_id as adj_player_id,
      COALESCE(SUM(pra.adjustment_value) FILTER (WHERE pra.adjustment_type = 'gols'), 0)::int as adj_gols,
      COALESCE(SUM(pra.adjustment_value) FILTER (WHERE pra.adjustment_type = 'assistencias'), 0)::int as adj_assistencias,
      COALESCE(SUM(pra.adjustment_value) FILTER (WHERE pra.adjustment_type = 'vitorias'), 0)::int as adj_vitorias,
      COALESCE(SUM(pra.adjustment_value) FILTER (WHERE pra.adjustment_type = 'empates'), 0)::int as adj_empates,
      COALESCE(SUM(pra.adjustment_value) FILTER (WHERE pra.adjustment_type = 'derrotas'), 0)::int as adj_derrotas,
      COALESCE(SUM(pra.adjustment_value) FILTER (WHERE pra.adjustment_type = 'presencas'), 0)::int as adj_presencas,
      COALESCE(SUM(pra.adjustment_value) FILTER (WHERE pra.adjustment_type = 'faltas'), 0)::int as adj_faltas,
      COALESCE(SUM(pra.adjustment_value) FILTER (WHERE pra.adjustment_type = 'atrasos'), 0)::int as adj_atrasos,
      COALESCE(SUM(pra.adjustment_value) FILTER (WHERE pra.adjustment_type = 'punicoes'), 0)::int as adj_punicoes,
      COALESCE(SUM(pra.adjustment_value) FILTER (WHERE pra.adjustment_type = 'cartoes_amarelos'), 0)::int as adj_cartoes_amarelos,
      COALESCE(SUM(pra.adjustment_value) FILTER (WHERE pra.adjustment_type = 'cartoes_azuis'), 0)::int as adj_cartoes_azuis,
      COALESCE(SUM(pra.adjustment_value) FILTER (WHERE pra.adjustment_type = 'saldo_gols'), 0)::int as adj_saldo_gols,
      COALESCE(SUM(pra.adjustment_value) FILTER (WHERE pra.adjustment_type = 'pontos_totais'), 0)::int as adj_pontos_totais
    FROM player_ranking_adjustments pra
    WHERE (pra.season_year IS NULL OR pra.season_year = p_season_year)
    GROUP BY pra.player_id
  )
  SELECT 
    ag.agg_player_id,
    COALESCE(ag.nickname, ag.name, 'Sem nome') as nickname,
    ag.avatar_url,
    ag.level_text,
    (ag.presencas + COALESCE(adj.adj_presencas, 0))::int as presencas,
    (ag.vitorias + COALESCE(adj.adj_vitorias, 0))::int as vitorias,
    (ag.empates + COALESCE(adj.adj_empates, 0))::int as empates,
    (ag.derrotas + COALESCE(adj.adj_derrotas, 0))::int as derrotas,
    (ag.atrasos + COALESCE(adj.adj_atrasos, 0))::int as atrasos,
    (ag.faltas + COALESCE(adj.adj_faltas, 0))::int as faltas,
    (ag.punicoes + COALESCE(adj.adj_punicoes, 0))::int as punicoes,
    (ag.cartoes_amarelos + COALESCE(adj.adj_cartoes_amarelos, 0))::int as cartoes_amarelos,
    (ag.cartoes_azuis + COALESCE(adj.adj_cartoes_azuis, 0))::int as cartoes_azuis,
    (ag.gols + COALESCE(adj.adj_gols, 0))::int as gols,
    (ag.assistencias + COALESCE(adj.adj_assistencias, 0))::int as assistencias,
    (ag.saldo_gols + COALESCE(adj.adj_saldo_gols, 0))::int as saldo_gols,
    (ag.pontos_totais + COALESCE(adj.adj_pontos_totais, 0))::int as pontos_totais
  FROM aggregated_stats ag
  LEFT JOIN adjustments_aggregated adj ON adj.adj_player_id = ag.agg_player_id
  ORDER BY pontos_totais DESC, gols DESC, saldo_gols DESC, vitorias DESC, presencas DESC;
END;
$$;

COMMENT ON FUNCTION get_classification IS 
'Unified classification RPC. Aggregates stats from player_round_stats with optional season/level filters. Automatically applies player_ranking_adjustments. Returns sorted by points, goals, goal difference, wins, presences.';
