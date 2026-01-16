-- Migration: Correção Pontuação 2026 (v3)
-- Regras CORRETAS:
--   - Presença (time original): +3
--   - Vitória: +3 cada
--   - Empate: +1 cada
--   - Saldo de Gols: +N (APENAS se positivo, baseado no TOTAL da rodada)
--   - Clean Sheet: +2 cada
--   - Atraso: -10 cada
--   - Cartão Amarelo: -1 cada
--   - Cartão Azul: -2 cada
--   - Substitutos: 0 pontos de ranking

-- Recriar função recalc_round_aggregates com regras 2026 CORRIGIDAS
CREATE OR REPLACE FUNCTION public.recalc_round_aggregates(p_round_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  player_record RECORD;
  match_record RECORD;
  v_round_status TEXT;
  v_victories INT;
  v_draws INT;
  v_defeats INT;
  v_goals_count INT;
  v_assists_count INT;
  v_own_goals_count INT;
  v_yellow_cards INT;
  v_blue_cards INT;
  v_lates INT;
  v_absences INT;
  v_goal_difference INT;
  v_clean_sheets INT;
  v_is_substitute BOOLEAN;
  v_team_goals INT;
  v_opponent_goals INT;
  v_player_team TEXT;
  
  -- Pontos por componente
  v_presence_points INT;
  v_victory_points INT;
  v_draw_points INT;
  v_defeat_points INT;
  v_goal_points INT;
  v_card_points INT;
  v_late_points INT;
  v_absence_points INT;
  v_punishment_points INT;
  v_total_points INT;
BEGIN
  -- Validar acesso admin
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  -- Verificar se a rodada está finalizada
  SELECT status INTO v_round_status FROM rounds WHERE id = p_round_id;
  IF v_round_status != 'finalizada' THEN
    RETURN json_build_object('success', false, 'error', 'Rodada não está finalizada. Status: ' || COALESCE(v_round_status, 'null'));
  END IF;

  -- Processar cada jogador da rodada
  FOR player_record IN 
    SELECT DISTINCT rtp.player_id, rtp.team_color as original_team
    FROM public.round_team_players rtp 
    WHERE rtp.round_id = p_round_id
  LOOP
    -- Inicializar contadores
    v_victories := 0;
    v_draws := 0;
    v_defeats := 0;
    v_goals_count := 0;
    v_assists_count := 0;
    v_own_goals_count := 0;
    v_yellow_cards := 0;
    v_blue_cards := 0;
    v_lates := 0;
    v_absences := 0;
    v_goal_difference := 0;
    v_clean_sheets := 0;
    v_is_substitute := false;
    
    -- Verificar se é substituto
    SELECT EXISTS(
      SELECT 1 FROM public.match_absence_substitutes mas
      JOIN public.matches m ON m.id = mas.match_id
      WHERE mas.substitute_player_id = player_record.player_id
        AND m.round_id = p_round_id
    ) INTO v_is_substitute;
    
    -- Contar atrasos e faltas
    SELECT 
      COALESCE(SUM(CASE WHEN status = 'atrasado' THEN 1 ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN status = 'falta' THEN 1 ELSE 0 END), 0)
    INTO v_lates, v_absences
    FROM public.round_absences
    WHERE round_id = p_round_id AND player_id = player_record.player_id;
    
    -- Processar cada partida da rodada
    FOR match_record IN
      SELECT m.* FROM public.matches m
      WHERE m.round_id = p_round_id AND m.status = 'finished'
    LOOP
      -- Determinar em qual time o jogador participou
      v_player_team := NULL;
      
      -- Verificar se foi substituto nesta partida
      SELECT mas.team_color INTO v_player_team
      FROM public.match_absence_substitutes mas
      WHERE mas.match_id = match_record.id
        AND mas.substitute_player_id = player_record.player_id;
      
      -- Se não foi substituto, usar time original
      IF v_player_team IS NULL THEN
        IF player_record.original_team IN (match_record.team_home, match_record.team_away) THEN
          v_player_team := player_record.original_team;
        END IF;
      END IF;
      
      -- Se jogador participou da partida
      IF v_player_team IS NOT NULL THEN
        -- Determinar gols do time e adversário
        IF v_player_team = match_record.team_home THEN
          v_team_goals := match_record.score_home;
          v_opponent_goals := match_record.score_away;
        ELSE
          v_team_goals := match_record.score_away;
          v_opponent_goals := match_record.score_home;
        END IF;
        
        -- Acumular saldo de gols da rodada
        v_goal_difference := v_goal_difference + (v_team_goals - v_opponent_goals);
        
        -- Contabilizar resultado
        IF v_team_goals > v_opponent_goals THEN
          v_victories := v_victories + 1;
        ELSIF v_team_goals = v_opponent_goals THEN
          v_draws := v_draws + 1;
        ELSE
          v_defeats := v_defeats + 1;
        END IF;
        
        -- Clean sheet (não sofreu gol)
        IF v_opponent_goals = 0 THEN
          v_clean_sheets := v_clean_sheets + 1;
        END IF;
      END IF;
    END LOOP;
    
    -- Contar gols marcados
    SELECT COALESCE(COUNT(*), 0) INTO v_goals_count
    FROM public.goals g
    JOIN public.matches m ON m.id = g.match_id
    WHERE g.player_id = player_record.player_id
      AND m.round_id = p_round_id
      AND m.status = 'finished'
      AND (g.is_own_goal IS NULL OR g.is_own_goal = false);
    
    -- Contar assistências
    SELECT COALESCE(COUNT(*), 0) INTO v_assists_count
    FROM public.assists a
    JOIN public.goals g ON g.id = a.goal_id
    JOIN public.matches m ON m.id = g.match_id
    WHERE a.player_id = player_record.player_id
      AND m.round_id = p_round_id
      AND m.status = 'finished';
    
    -- Contar gols contra
    SELECT COALESCE(COUNT(*), 0) INTO v_own_goals_count
    FROM public.goals g
    JOIN public.matches m ON m.id = g.match_id
    WHERE g.player_id = player_record.player_id
      AND m.round_id = p_round_id
      AND m.status = 'finished'
      AND g.is_own_goal = true;
    
    -- Contar cartões
    SELECT 
      COALESCE(SUM(CASE WHEN c.card_type = 'yellow' THEN 1 ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN c.card_type = 'blue' THEN 1 ELSE 0 END), 0)
    INTO v_yellow_cards, v_blue_cards
    FROM public.cards c
    JOIN public.matches m ON m.id = c.match_id
    WHERE c.player_id = player_record.player_id
      AND m.round_id = p_round_id
      AND m.status = 'finished';
    
    -- ===== CALCULAR PONTOS (REGRAS 2026) =====
    
    -- Substitutos não recebem pontos de ranking
    IF v_is_substitute THEN
      v_presence_points := 0;
      v_victory_points := 0;
      v_draw_points := 0;
      v_defeat_points := 0;
      v_goal_points := 0;
    ELSE
      -- Presença: +3
      v_presence_points := 3;
      
      -- Vitórias: +3 cada
      v_victory_points := v_victories * 3;
      
      -- Empates: +1 cada
      v_draw_points := v_draws * 1;
      
      -- Derrotas: 0
      v_defeat_points := 0;
      
      -- Saldo de Gols: +N (APENAS SE POSITIVO, baseado no TOTAL da rodada)
      IF v_goal_difference > 0 THEN
        v_goal_points := v_goal_difference;
      ELSE
        v_goal_points := 0;
      END IF;
      
      -- Clean sheets: +2 cada (incluído no goal_points ou separado?)
      -- Por enquanto, adiciona ao goal_points
      v_goal_points := v_goal_points + (v_clean_sheets * 2);
    END IF;
    
    -- Cartões: -1 amarelo, -2 azul
    v_card_points := (v_yellow_cards * -1) + (v_blue_cards * -2);
    
    -- Atrasos: -10 cada
    v_late_points := v_lates * -10;
    
    -- Faltas: 0 (já não participa)
    v_absence_points := 0;
    
    -- Punições: 0 (não implementado)
    v_punishment_points := 0;
    
    -- Total
    v_total_points := v_presence_points + v_victory_points + v_draw_points + v_defeat_points 
                    + v_goal_points + v_card_points + v_late_points + v_absence_points + v_punishment_points;
    
    -- Upsert player_round_stats
    INSERT INTO public.player_round_stats (
      player_id, round_id,
      presence_points, victory_points, draw_points, defeat_points,
      goal_points, card_points, late_points, absence_points, punishment_points,
      total_points,
      victories, draws, defeats, lates, absences, punishments,
      yellow_cards, blue_cards, goals, assists, own_goals,
      goal_difference, clean_sheets, is_substitute
    ) VALUES (
      player_record.player_id, p_round_id,
      v_presence_points, v_victory_points, v_draw_points, v_defeat_points,
      v_goal_points, v_card_points, v_late_points, v_absence_points, v_punishment_points,
      v_total_points,
      v_victories, v_draws, v_defeats, v_lates, v_absences, 0,
      v_yellow_cards, v_blue_cards, v_goals_count, v_assists_count, v_own_goals_count,
      v_goal_difference, v_clean_sheets, v_is_substitute
    )
    ON CONFLICT (player_id, round_id) DO UPDATE SET
      presence_points = EXCLUDED.presence_points,
      victory_points = EXCLUDED.victory_points,
      draw_points = EXCLUDED.draw_points,
      defeat_points = EXCLUDED.defeat_points,
      goal_points = EXCLUDED.goal_points,
      card_points = EXCLUDED.card_points,
      late_points = EXCLUDED.late_points,
      absence_points = EXCLUDED.absence_points,
      punishment_points = EXCLUDED.punishment_points,
      total_points = EXCLUDED.total_points,
      victories = EXCLUDED.victories,
      draws = EXCLUDED.draws,
      defeats = EXCLUDED.defeats,
      lates = EXCLUDED.lates,
      absences = EXCLUDED.absences,
      yellow_cards = EXCLUDED.yellow_cards,
      blue_cards = EXCLUDED.blue_cards,
      goals = EXCLUDED.goals,
      assists = EXCLUDED.assists,
      own_goals = EXCLUDED.own_goals,
      goal_difference = EXCLUDED.goal_difference,
      clean_sheets = EXCLUDED.clean_sheets,
      is_substitute = EXCLUDED.is_substitute;
      
  END LOOP;

  -- Atualizar player_rankings agregado
  PERFORM public.recalc_all_player_rankings();

  RETURN json_build_object(
    'success', true, 
    'message', 'Pontuação recalculada com regras 2026'
  );
END;
$$;

-- Função para recalcular TODAS as rodadas de 2026
CREATE OR REPLACE FUNCTION public.recalc_all_2026_rounds()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  round_record RECORD;
  v_count INT := 0;
  v_result json;
BEGIN
  -- Validar admin
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  -- Processar cada rodada FINALIZADA de 2026
  FOR round_record IN
    SELECT id, round_number 
    FROM rounds 
    WHERE EXTRACT(YEAR FROM scheduled_date) = 2026
      AND status = 'finalizada'
    ORDER BY round_number
  LOOP
    v_result := recalc_round_aggregates(round_record.id);
    v_count := v_count + 1;
    RAISE NOTICE 'Recalculada rodada %', round_record.round_number;
  END LOOP;

  RETURN json_build_object(
    'success', true, 
    'message', format('Recalculadas %s rodadas de 2026', v_count),
    'rounds_processed', v_count
  );
END;
$$;

-- Conceder permissões
GRANT EXECUTE ON FUNCTION public.recalc_round_aggregates(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_all_2026_rounds() TO authenticated;

COMMENT ON FUNCTION public.recalc_round_aggregates IS 'Recalcula pontos de uma rodada usando regras 2026: Presença +3, Vitória +3, Empate +1, SG positivo +N, CS +2, Atraso -10, Amarelo -1, Azul -2';
