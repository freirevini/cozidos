-- Migration: Create RPC get_match_timeline_events
-- Purpose: Consolidates timeline event loading into a single database query
-- Previously: Frontend made 4+ queries (goals, cards, substitutions, etc.)
-- Now: Single RPC returns all events formatted for the MatchTimeline component

CREATE OR REPLACE FUNCTION get_match_timeline_events(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result JSONB := '[]'::JSONB;
  v_match RECORD;
  v_end_minute INT;
BEGIN
  -- Get match info
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  IF NOT FOUND THEN RETURN v_result; END IF;

  -- Match start event
  IF v_match.started_at IS NOT NULL THEN
    v_result := v_result || jsonb_build_object(
      'id', 'start-' || p_match_id,
      'type', 'match_start',
      'minute', 0
    );
  END IF;

  -- Goals (with assists)
  v_result := v_result || COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', g.id,
      'type', 'goal',
      'minute', g.minute,
      'team_color', g.team_color,
      'is_own_goal', COALESCE(g.is_own_goal, false),
      'player', CASE WHEN p.id IS NOT NULL THEN jsonb_build_object(
        'id', p.id, 'name', p.name, 'nickname', p.nickname, 'avatar_url', p.avatar_url
      ) ELSE NULL END,
      'assist', (
        SELECT jsonb_build_object(
          'id', ap.id, 'name', ap.name, 'nickname', ap.nickname, 'avatar_url', ap.avatar_url
        )
        FROM assists a
        JOIN profiles ap ON ap.id = a.player_id
        WHERE a.goal_id = g.id
        LIMIT 1
      )
    ))
    FROM goals g
    LEFT JOIN profiles p ON p.id = g.player_id
    WHERE g.match_id = p_match_id
  ), '[]'::JSONB);

  -- Cards (with team_color resolution including match_absence_substitutes)
  -- Fallback order: 1) substitution, 2) roster, 3) absence substitute
  v_result := v_result || COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', c.id,
      'type', CASE 
        WHEN c.card_type = 'amarelo' THEN 'amarelo'
        WHEN c.card_type = 'azul' THEN 'azul'
        ELSE c.card_type::TEXT
      END,
      'minute', c.minute,
      'team_color', COALESCE(
        -- 1. Check if entered via substitution
        (SELECT team_color FROM substitutions WHERE player_in_id = c.player_id AND match_id = p_match_id LIMIT 1),
        -- 2. Check original roster
        (SELECT team_color FROM round_team_players WHERE player_id = c.player_id AND round_id = v_match.round_id LIMIT 1),
        -- 3. Check absence substitutes
        (SELECT team_color FROM match_absence_substitutes WHERE substitute_player_id = c.player_id AND match_id = p_match_id LIMIT 1)
      ),
      'player', CASE WHEN p.id IS NOT NULL THEN jsonb_build_object(
        'id', p.id, 'name', p.name, 'nickname', p.nickname, 'avatar_url', p.avatar_url
      ) ELSE NULL END
    ))
    FROM cards c
    LEFT JOIN profiles p ON p.id = c.player_id
    WHERE c.match_id = p_match_id
  ), '[]'::JSONB);

  -- Substitutions
  v_result := v_result || COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', s.id,
      'type', 'substitution',
      'minute', s.minute,
      'team_color', s.team_color,
      'playerOut', CASE WHEN po.id IS NOT NULL THEN jsonb_build_object(
        'id', po.id, 'name', po.name, 'nickname', po.nickname, 'avatar_url', po.avatar_url
      ) ELSE NULL END,
      'playerIn', CASE WHEN pi.id IS NOT NULL THEN jsonb_build_object(
        'id', pi.id, 'name', pi.name, 'nickname', pi.nickname, 'avatar_url', pi.avatar_url
      ) ELSE NULL END
    ))
    FROM substitutions s
    LEFT JOIN profiles po ON po.id = s.player_out_id
    LEFT JOIN profiles pi ON pi.id = s.player_in_id
    WHERE s.match_id = p_match_id
  ), '[]'::JSONB);

  -- Match end event (if finished)
  -- Subtracts paused seconds from total elapsed time
  IF v_match.status = 'finished' AND v_match.finished_at IS NOT NULL AND v_match.started_at IS NOT NULL THEN
    v_end_minute := GREATEST(0, 
      FLOOR(
        (EXTRACT(EPOCH FROM (v_match.finished_at - v_match.started_at)) 
         - COALESCE(v_match.match_timer_total_paused_seconds, 0)
        ) / 60
      )::INT
    );
    v_result := v_result || jsonb_build_object(
      'id', 'end-' || p_match_id,
      'type', 'match_end',
      'minute', v_end_minute
    );
  END IF;

  -- Sort by minute
  SELECT jsonb_agg(e ORDER BY (e->>'minute')::INT) INTO v_result
  FROM jsonb_array_elements(v_result) e;

  RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;

COMMENT ON FUNCTION get_match_timeline_events IS 
'Returns match timeline events as a JSON array. Includes goals (with assists), cards, substitutions, and match start/end events. All events are sorted by minute.';
