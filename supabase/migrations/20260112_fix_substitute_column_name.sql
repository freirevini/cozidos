-- Migration: Fix recalc_round_aggregates with correct column names
-- The player_round_stats table has different column names than expected

CREATE OR REPLACE FUNCTION public.recalc_round_aggregates(p_round_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  player_record RECORD;
  match_record RECORD;
  v_victories INTEGER;
  v_draws INTEGER;
  v_defeats INTEGER;
  v_goals INTEGER;
  v_assists INTEGER;
  v_yellow_cards INTEGER;
  v_red_cards INTEGER;
  v_absences INTEGER;
  v_lates INTEGER;
  v_punishments INTEGER;
  v_total_points INTEGER;
  v_victory_points INTEGER;
  v_draw_points INTEGER;
  v_defeat_points INTEGER;
  v_goal_points INTEGER;
  v_absence_points INTEGER;
  v_late_points INTEGER;
  v_card_points INTEGER;
  v_punishment_points INTEGER;
  v_presence_points INTEGER;
  v_is_substitute BOOLEAN;
  v_player_original_team TEXT;
  v_team_goals INTEGER;
  v_opponent_goals INTEGER;
  v_attendance_status TEXT;
BEGIN
  -- Limpar estatísticas anteriores da rodada
  DELETE FROM public.player_round_stats WHERE round_id = p_round_id;

  -- Processar todos os jogadores que participaram (escalados) na rodada
  FOR player_record IN 
    SELECT DISTINCT rtp.player_id, rtp.team_color::text AS original_team
    FROM public.round_team_players rtp
    WHERE rtp.round_id = p_round_id
  LOOP
    -- Inicializar contadores
    v_victories := 0;
    v_draws := 0;
    v_defeats := 0;
    v_goals := 0;
    v_assists := 0;
    v_yellow_cards := 0;
    v_red_cards := 0;
    v_absences := 0;
    v_lates := 0;
    v_punishments := 0;
    v_total_points := 0;
    v_victory_points := 0;
    v_draw_points := 0;
    v_defeat_points := 0;
    v_goal_points := 0;
    v_absence_points := 0;
    v_late_points := 0;
    v_card_points := 0;
    v_punishment_points := 0;
    v_presence_points := 0;
    v_is_substitute := false;
    v_player_original_team := player_record.original_team;
    
    -- Verificar se é substituto
    SELECT EXISTS(
      SELECT 1 FROM public.match_absence_substitutes mas
      JOIN public.matches m ON m.id = mas.match_id
      WHERE m.round_id = p_round_id AND mas.substitute_player_id = player_record.player_id
    ) INTO v_is_substitute;
    
    -- Verificar status de presença
    SELECT status INTO v_attendance_status
    FROM public.round_absences
    WHERE round_id = p_round_id AND player_id = player_record.player_id
    LIMIT 1;
    
    -- Ajustar presença baseado em attendance
    IF v_attendance_status = 'falta' THEN
      v_absences := 1;
      v_absence_points := -3;
    ELSIF v_attendance_status = 'atrasado' THEN
      v_lates := 1;
      v_late_points := -2;
    ELSE
      v_presence_points := 1;
    END IF;
    
    -- Calcular vitórias, empates, derrotas por partida
    FOR match_record IN
      SELECT m.id, m.team_home::text AS team_home, m.team_away::text AS team_away, m.score_home, m.score_away
      FROM public.matches m
      WHERE m.round_id = p_round_id 
        AND m.status = 'finished'
        AND (m.team_home::text = v_player_original_team OR m.team_away::text = v_player_original_team)
    LOOP
      -- Determinar gols do time do jogador e do adversário
      IF v_player_original_team = match_record.team_home THEN
        v_team_goals := match_record.score_home;
        v_opponent_goals := match_record.score_away;
      ELSE
        v_team_goals := match_record.score_away;
        v_opponent_goals := match_record.score_home;
      END IF;
      
      -- REGRA 2026: Vitória = 3 pts, Empate = 1 pt, Derrota = 0 pts
      IF v_team_goals > v_opponent_goals THEN
        v_victories := v_victories + 1;
        v_victory_points := v_victory_points + 3;
      ELSIF v_team_goals = v_opponent_goals THEN
        v_draws := v_draws + 1;
        v_draw_points := v_draw_points + 1;
      ELSE
        v_defeats := v_defeats + 1;
      END IF;
    END LOOP;
    
    -- Contar gols do jogador (excluindo gols contra)
    SELECT COUNT(*) INTO v_goals
    FROM public.goals g
    JOIN public.matches m ON g.match_id = m.id
    WHERE m.round_id = p_round_id 
      AND g.player_id = player_record.player_id
      AND g.is_own_goal = false;
    
    v_goal_points := v_goals; -- 1 pt por gol
    
    -- Contar cartões
    SELECT 
      COUNT(*) FILTER (WHERE c.card_type = 'amarelo'),
      COUNT(*) FILTER (WHERE c.card_type = 'azul')
    INTO v_yellow_cards, v_red_cards
    FROM public.cards c
    JOIN public.matches m ON c.match_id = m.id
    WHERE m.round_id = p_round_id AND c.player_id = player_record.player_id;
    
    v_card_points := -(v_yellow_cards * 1 + v_red_cards * 2);
    
    -- Calcular total de pontos
    v_total_points := v_presence_points + v_victory_points + v_draw_points + v_defeat_points 
                    + v_goal_points + v_absence_points + v_late_points + v_card_points + v_punishment_points;
    
    -- Inserir estatísticas com colunas CORRETAS
    INSERT INTO public.player_round_stats (
      round_id,
      player_id,
      presence_points,
      victory_points,
      draw_points,
      defeat_points,
      late_points,
      absence_points,
      punishment_points,
      card_points,
      goal_points,
      total_points,
      victories,
      draws,
      defeats,
      lates,
      absences,
      punishments,
      yellow_cards,
      red_cards
    ) VALUES (
      p_round_id,
      player_record.player_id,
      v_presence_points,
      v_victory_points,
      v_draw_points,
      v_defeat_points,
      v_late_points,
      v_absence_points,
      v_punishment_points,
      v_card_points,
      v_goal_points,
      v_total_points,
      v_victories,
      v_draws,
      v_defeats,
      v_lates,
      v_absences,
      v_punishments,
      v_yellow_cards,
      v_red_cards
    );
  END LOOP;

  RETURN json_build_object('success', true, 'round_id', p_round_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalc_round_aggregates(uuid) TO authenticated;
