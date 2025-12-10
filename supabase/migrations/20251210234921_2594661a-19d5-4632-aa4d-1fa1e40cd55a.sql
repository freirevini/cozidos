
-- RPC para obter contagem de eventos por jogador em uma partida
-- Considera substituições: substitutos só contabilizam eventos após minuto de entrada
CREATE OR REPLACE FUNCTION public.get_match_player_events(p_match_id uuid)
RETURNS TABLE (
  player_id uuid,
  goals_count int,
  yellow_count int,
  blue_count int,
  sub_in_minute int,
  is_starter boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_round_id uuid;
BEGIN
  -- Get round_id for this match
  SELECT round_id INTO v_round_id FROM matches WHERE id = p_match_id;
  
  RETURN QUERY
  WITH match_players AS (
    -- Get all players from both teams in this match
    SELECT DISTINCT rtp.player_id, rtp.team_color
    FROM round_team_players rtp
    JOIN matches m ON m.round_id = rtp.round_id
    WHERE m.id = p_match_id
      AND (m.team_home = rtp.team_color OR m.team_away = rtp.team_color)
  ),
  player_subs AS (
    -- Get substitution info for each player
    SELECT 
      s.player_in_id as player_id,
      s.minute as sub_in_minute,
      false as is_starter
    FROM substitutions s
    WHERE s.match_id = p_match_id
    UNION ALL
    -- Players not substituted in are starters
    SELECT 
      mp.player_id,
      null::int as sub_in_minute,
      true as is_starter
    FROM match_players mp
    WHERE NOT EXISTS (
      SELECT 1 FROM substitutions s 
      WHERE s.match_id = p_match_id AND s.player_in_id = mp.player_id
    )
  ),
  player_goals AS (
    -- Count goals per player (considering sub_in_minute for substitutes)
    SELECT 
      g.player_id,
      COUNT(*)::int as cnt
    FROM goals g
    LEFT JOIN player_subs ps ON ps.player_id = g.player_id
    WHERE g.match_id = p_match_id 
      AND g.is_own_goal = false
      AND (ps.is_starter = true OR g.minute >= COALESCE(ps.sub_in_minute, 0))
    GROUP BY g.player_id
  ),
  player_cards AS (
    -- Count cards per player (considering sub_in_minute for substitutes)
    SELECT 
      c.player_id,
      COUNT(*) FILTER (WHERE c.card_type = 'amarelo')::int as yellow_cnt,
      COUNT(*) FILTER (WHERE c.card_type = 'azul')::int as blue_cnt
    FROM cards c
    LEFT JOIN player_subs ps ON ps.player_id = c.player_id
    WHERE c.match_id = p_match_id
      AND (ps.is_starter = true OR c.minute >= COALESCE(ps.sub_in_minute, 0))
    GROUP BY c.player_id
  )
  SELECT 
    mp.player_id,
    COALESCE(pg.cnt, 0) as goals_count,
    COALESCE(pc.yellow_cnt, 0) as yellow_count,
    COALESCE(pc.blue_cnt, 0) as blue_count,
    ps.sub_in_minute,
    COALESCE(ps.is_starter, true) as is_starter
  FROM match_players mp
  LEFT JOIN player_subs ps ON ps.player_id = mp.player_id
  LEFT JOIN player_goals pg ON pg.player_id = mp.player_id
  LEFT JOIN player_cards pc ON pc.player_id = mp.player_id
  WHERE COALESCE(pg.cnt, 0) > 0 
     OR COALESCE(pc.yellow_cnt, 0) > 0 
     OR COALESCE(pc.blue_cnt, 0) > 0
     OR ps.sub_in_minute IS NOT NULL;
END;
$$;
