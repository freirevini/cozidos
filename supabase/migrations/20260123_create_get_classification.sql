-- Migration: Create unified get_classification RPC
-- Purpose: Single source of truth for classification data
-- Replaces: dual queries to player_rankings + player_round_stats in frontend
-- Benefits: 
--   - Consistent data across Classification, Statistics, Home, Profile
--   - Adjustments applied in backend (no frontend logic needed)
--   - Single query instead of multiple

CREATE OR REPLACE FUNCTION public.get_classification(
  p_season_year INT DEFAULT NULL,  -- NULL = all time
  p_level TEXT DEFAULT NULL        -- NULL = all levels, or 'A', 'B', 'C', etc.
)
RETURNS TABLE (
  player_id UUID,
  nickname TEXT,
  avatar_url TEXT,
  level TEXT,
  presencas INT,
  vitorias INT,
  empates INT,
  derrotas INT,
  atrasos INT,
  faltas INT,
  punicoes INT,
  cartoes_amarelos INT,
  cartoes_azuis INT,
  gols INT,
  assistencias INT,
  saldo_gols INT,
  pontos_totais INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH player_stats AS (
    -- Aggregate from player_round_stats, filtered by year if provided
    SELECT 
      prs.player_id,
      p.nickname,
      p.avatar_url,
      p.level,
      -- Count rounds with presence (not sum of presence_points)
      COUNT(*) FILTER (WHERE prs.presence_points > 0)::INT as presencas,
      SUM(COALESCE(prs.victories, 0))::INT as vitorias,
      SUM(COALESCE(prs.draws, 0))::INT as empates,
      SUM(COALESCE(prs.defeats, 0))::INT as defeats,
      0::INT as atrasos,  -- Not tracked in player_round_stats
      0::INT as faltas,   -- Not tracked in player_round_stats
      0::INT as punicoes, -- Not tracked in player_round_stats
      SUM(COALESCE(prs.yellow_cards, 0))::INT as yellow_cards,
      SUM(COALESCE(prs.blue_cards, 0))::INT as blue_cards,
      SUM(COALESCE(prs.goals, 0))::INT as goals,
      SUM(COALESCE(prs.assists, 0))::INT as assists,
      SUM(COALESCE(prs.goal_difference, 0))::INT as goal_diff,
      SUM(COALESCE(prs.total_points, 0))::INT as total_pts
    FROM player_round_stats prs
    JOIN profiles p ON p.id = prs.player_id
    JOIN rounds r ON r.id = prs.round_id
    WHERE 
      p.is_player = true 
      AND p.status = 'aprovado'
      AND (p.is_guest IS NULL OR p.is_guest = false)
      -- Filter by year if provided
      AND (p_season_year IS NULL OR EXTRACT(YEAR FROM r.scheduled_date) = p_season_year)
      -- Filter by level if provided
      AND (p_level IS NULL OR p.level = p_level)
    GROUP BY prs.player_id, p.nickname, p.avatar_url, p.level
  ),
  adjustments_applied AS (
    -- Apply player_ranking_adjustments
    SELECT 
      ps.player_id,
      ps.nickname,
      ps.avatar_url,
      ps.level,
      -- Base stats + adjustments
      ps.presencas + COALESCE((
        SELECT SUM(adjustment_value) 
        FROM player_ranking_adjustments pra 
        WHERE pra.player_id = ps.player_id 
          AND pra.adjustment_type = 'presencas'
          AND (pra.season_year IS NULL OR pra.season_year = p_season_year)
      ), 0)::INT as presencas,
      ps.vitorias + COALESCE((
        SELECT SUM(adjustment_value) 
        FROM player_ranking_adjustments pra 
        WHERE pra.player_id = ps.player_id 
          AND pra.adjustment_type = 'vitorias'
          AND (pra.season_year IS NULL OR pra.season_year = p_season_year)
      ), 0)::INT as vitorias,
      ps.empates + COALESCE((
        SELECT SUM(adjustment_value) 
        FROM player_ranking_adjustments pra 
        WHERE pra.player_id = ps.player_id 
          AND pra.adjustment_type = 'empates'
          AND (pra.season_year IS NULL OR pra.season_year = p_season_year)
      ), 0)::INT as empates,
      ps.defeats + COALESCE((
        SELECT SUM(adjustment_value) 
        FROM player_ranking_adjustments pra 
        WHERE pra.player_id = ps.player_id 
          AND pra.adjustment_type = 'derrotas'
          AND (pra.season_year IS NULL OR pra.season_year = p_season_year)
      ), 0)::INT as derrotas,
      ps.atrasos + COALESCE((
        SELECT SUM(adjustment_value) 
        FROM player_ranking_adjustments pra 
        WHERE pra.player_id = ps.player_id 
          AND pra.adjustment_type = 'atrasos'
          AND (pra.season_year IS NULL OR pra.season_year = p_season_year)
      ), 0)::INT as atrasos,
      ps.faltas + COALESCE((
        SELECT SUM(adjustment_value) 
        FROM player_ranking_adjustments pra 
        WHERE pra.player_id = ps.player_id 
          AND pra.adjustment_type = 'faltas'
          AND (pra.season_year IS NULL OR pra.season_year = p_season_year)
      ), 0)::INT as faltas,
      ps.punicoes + COALESCE((
        SELECT SUM(adjustment_value) 
        FROM player_ranking_adjustments pra 
        WHERE pra.player_id = ps.player_id 
          AND pra.adjustment_type = 'punicoes'
          AND (pra.season_year IS NULL OR pra.season_year = p_season_year)
      ), 0)::INT as punicoes,
      ps.yellow_cards + COALESCE((
        SELECT SUM(adjustment_value) 
        FROM player_ranking_adjustments pra 
        WHERE pra.player_id = ps.player_id 
          AND pra.adjustment_type = 'cartoes_amarelos'
          AND (pra.season_year IS NULL OR pra.season_year = p_season_year)
      ), 0)::INT as cartoes_amarelos,
      ps.blue_cards + COALESCE((
        SELECT SUM(adjustment_value) 
        FROM player_ranking_adjustments pra 
        WHERE pra.player_id = ps.player_id 
          AND pra.adjustment_type = 'cartoes_azuis'
          AND (pra.season_year IS NULL OR pra.season_year = p_season_year)
      ), 0)::INT as cartoes_azuis,
      ps.goals + COALESCE((
        SELECT SUM(adjustment_value) 
        FROM player_ranking_adjustments pra 
        WHERE pra.player_id = ps.player_id 
          AND pra.adjustment_type = 'gols'
          AND (pra.season_year IS NULL OR pra.season_year = p_season_year)
      ), 0)::INT as gols,
      ps.assists + COALESCE((
        SELECT SUM(adjustment_value) 
        FROM player_ranking_adjustments pra 
        WHERE pra.player_id = ps.player_id 
          AND pra.adjustment_type = 'assistencias'
          AND (pra.season_year IS NULL OR pra.season_year = p_season_year)
      ), 0)::INT as assistencias,
      ps.goal_diff + COALESCE((
        SELECT SUM(adjustment_value) 
        FROM player_ranking_adjustments pra 
        WHERE pra.player_id = ps.player_id 
          AND pra.adjustment_type = 'saldo_gols'
          AND (pra.season_year IS NULL OR pra.season_year = p_season_year)
      ), 0)::INT as saldo_gols,
      ps.total_pts + COALESCE((
        SELECT SUM(adjustment_value) 
        FROM player_ranking_adjustments pra 
        WHERE pra.player_id = ps.player_id 
          AND pra.adjustment_type = 'pontos_totais'
          AND (pra.season_year IS NULL OR pra.season_year = p_season_year)
      ), 0)::INT as pontos_totais
    FROM player_stats ps
  )
  SELECT 
    aa.player_id,
    aa.nickname,
    aa.avatar_url,
    aa.level,
    aa.presencas,
    aa.vitorias,
    aa.empates,
    aa.derrotas,
    aa.atrasos,
    aa.faltas,
    aa.punicoes,
    aa.cartoes_amarelos,
    aa.cartoes_azuis,
    aa.gols,
    aa.assistencias,
    aa.saldo_gols,
    aa.pontos_totais
  FROM adjustments_applied aa
  -- Sort by ranking criteria (same as frontend sortPlayers)
  ORDER BY 
    aa.pontos_totais DESC,
    aa.presencas DESC,
    aa.vitorias DESC,
    aa.saldo_gols DESC,
    (aa.cartoes_amarelos + aa.cartoes_azuis) ASC,  -- Less cards = better
    aa.assistencias DESC,
    aa.gols DESC,
    aa.derrotas ASC,  -- Less defeats = better
    aa.nickname ASC;
END;
$$;

COMMENT ON FUNCTION get_classification IS 
'Returns player classification/ranking data. Aggregates from player_round_stats and applies adjustments.
Parameters:
  - p_season_year: NULL for all-time, or specific year (e.g., 2026)
  - p_level: NULL for all levels, or specific level (e.g., ''A'')
Used by: Classification.tsx, Statistics.tsx, Home.tsx, useProfileStats.ts';
