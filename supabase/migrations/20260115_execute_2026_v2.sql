-- =============================================
-- SCRIPT DE EXECUÇÃO DIRETA (SQL Editor)
-- Aplica a migration e recalcula as rodadas de 2026
-- =============================================

-- Desabilitar temporariamente a verificação de admin para execução direta
-- Executar as funções atualizadas primeiro (cole o conteúdo da migration antes deste bloco)

-- Recalcular diretamente sem verificação de admin
DO $$
DECLARE
  round_record RECORD;
  player_record RECORD;
  match_record RECORD;
  v_victories INT;
  v_draws INT;
  v_defeats INT;
  v_goals_count INT;
  v_assists_count INT;
  v_yellow_cards INT;
  v_blue_cards INT;
  v_lates INT;
  v_absences INT;
  v_punishments_sum INT;
  v_goal_difference INT;
  v_clean_sheets INT;
  v_is_substitute BOOLEAN;
  v_team_goals INT;
  v_opponent_goals INT;
  v_player_original_team TEXT;
  v_presence_points INT;
  v_victory_points INT;
  v_draw_points INT;
  v_goal_diff_points INT;
  v_clean_sheet_points INT;
  v_team_goals_points INT;
  v_team_total_goals INT;
  v_late_points INT;
  v_absence_points INT;
  v_card_points INT;
  v_punishment_points INT;
  v_total_points INT;
  v_attendance_status TEXT;
  rounds_processed INT := 0;
BEGIN
  -- Processar cada rodada FINALIZADA de 2026
  FOR round_record IN
    SELECT r.id, r.round_number
    FROM public.rounds r
    WHERE r.scheduled_date >= '2026-01-01'
      AND r.scheduled_date <= '2026-12-31'
      AND r.status = 'finalizada'  -- APENAS rodadas finalizadas
    ORDER BY r.round_number
  LOOP
    RAISE NOTICE 'Processando rodada %', round_record.round_number;
    
    -- Processar cada jogador da rodada
    FOR player_record IN 
      SELECT DISTINCT rtp.player_id, rtp.team_color as original_team
      FROM public.round_team_players rtp 
      WHERE rtp.round_id = round_record.id
    LOOP
      v_victories := 0;
      v_draws := 0;
      v_defeats := 0;
      v_goal_difference := 0;
      v_clean_sheets := 0;
      v_team_total_goals := 0;
      v_is_substitute := false;
      v_lates := 0;
      v_absences := 0;
      v_player_original_team := player_record.original_team;
      
      -- Verificar se é substituto
      SELECT EXISTS(
        SELECT 1 FROM public.match_absence_substitutes mas
        JOIN public.matches m ON m.id = mas.match_id
        WHERE m.round_id = round_record.id AND mas.substitute_player_id = player_record.player_id
      ) INTO v_is_substitute;
      
      -- Verificar status de presença
      SELECT status INTO v_attendance_status
      FROM public.round_absences
      WHERE round_id = round_record.id AND player_id = player_record.player_id
      LIMIT 1;
      
      IF v_attendance_status = 'falta' THEN
        v_absences := 1;
      ELSIF v_attendance_status = 'atrasado' THEN
        v_lates := 1;
      END IF;
      
      -- Calcular resultados por partida
      FOR match_record IN
        SELECT m.id, m.team_home, m.team_away, m.score_home, m.score_away
        FROM public.matches m
        WHERE m.round_id = round_record.id 
          AND m.status = 'finished'
          AND (m.team_home::text = v_player_original_team OR m.team_away::text = v_player_original_team)
      LOOP
        IF v_player_original_team = match_record.team_home::text THEN
          v_team_goals := match_record.score_home;
          v_opponent_goals := match_record.score_away;
        ELSE
          v_team_goals := match_record.score_away;
          v_opponent_goals := match_record.score_home;
        END IF;
        
        IF v_team_goals > v_opponent_goals THEN
          v_victories := v_victories + 1;
        ELSIF v_team_goals = v_opponent_goals THEN
          v_draws := v_draws + 1;
        ELSE
          v_defeats := v_defeats + 1;
        END IF;
        
        v_goal_difference := v_goal_difference + (v_team_goals - v_opponent_goals);
        v_team_total_goals := v_team_total_goals + v_team_goals;
        
        IF v_opponent_goals = 0 THEN
          v_clean_sheets := v_clean_sheets + 1;
        END IF;
      END LOOP;
      
      -- Contar gols individuais
      SELECT COUNT(*) INTO v_goals_count
      FROM public.goals g
      JOIN public.matches m ON m.id = g.match_id
      WHERE m.round_id = round_record.id 
        AND g.player_id = player_record.player_id
        AND g.is_own_goal = false;
      
      -- Contar assistências
      SELECT COUNT(*) INTO v_assists_count
      FROM public.assists a
      JOIN public.goals g ON g.id = a.goal_id
      JOIN public.matches m ON m.id = g.match_id
      WHERE m.round_id = round_record.id 
        AND a.player_id = player_record.player_id;
      
      -- Contar cartões
      SELECT 
        COALESCE(COUNT(*) FILTER (WHERE card_type = 'amarelo'), 0),
        COALESCE(COUNT(*) FILTER (WHERE card_type = 'azul'), 0)
      INTO v_yellow_cards, v_blue_cards
      FROM public.cards c
      JOIN public.matches m ON m.id = c.match_id
      WHERE m.round_id = round_record.id AND c.player_id = player_record.player_id;
      
      -- Somar punições
      SELECT COALESCE(SUM(points), 0) INTO v_punishments_sum
      FROM public.punishments
      WHERE round_id = round_record.id AND player_id = player_record.player_id;
      
      -- CÁLCULO DE PONTOS - REGRAS 2026 v2
      IF NOT v_is_substitute AND v_absences = 0 THEN
        v_presence_points := 3;
        v_victory_points := v_victories * 3;
        v_draw_points := v_draws * 1;
        v_goal_diff_points := CASE WHEN v_goal_difference > 0 THEN v_goal_difference ELSE 0 END;
        v_clean_sheet_points := v_clean_sheets * 2;
        v_team_goals_points := v_team_total_goals * 1;  -- NOVO: +1 por gol da equipe
      ELSE
        v_presence_points := 0;
        v_victory_points := 0;
        v_draw_points := 0;
        v_goal_diff_points := 0;
        v_clean_sheet_points := 0;
        v_team_goals_points := 0;
      END IF;
      
      v_late_points := v_lates * -10;
      v_absence_points := v_absences * -20;
      v_card_points := (v_yellow_cards * -1) + (v_blue_cards * -2);
      v_punishment_points := v_punishments_sum;
      
      v_total_points := 
        v_presence_points + v_victory_points + v_draw_points +
        v_goal_diff_points + v_clean_sheet_points + v_team_goals_points +
        v_late_points + v_absence_points + v_card_points + v_punishment_points;
      
      -- Upsert player_round_stats
      INSERT INTO public.player_round_stats (
        player_id, round_id, victories, draws, defeats,
        yellow_cards, blue_cards, lates, absences, punishments,
        goal_difference, clean_sheets, is_substitute,
        presence_points, victory_points, draw_points, defeat_points,
        late_points, absence_points, punishment_points, card_points,
        goal_points, total_points, goals, assists
      ) VALUES (
        player_record.player_id, round_record.id, 
        v_victories, v_draws, v_defeats,
        v_yellow_cards, v_blue_cards, v_lates, v_absences, 
        (SELECT COUNT(*) FROM public.punishments WHERE round_id = round_record.id AND player_id = player_record.player_id),
        v_goal_difference, v_clean_sheets, v_is_substitute,
        v_presence_points, v_victory_points, v_draw_points, 0,
        v_late_points, v_absence_points, v_punishment_points, v_card_points,
        v_goal_diff_points + v_clean_sheet_points + v_team_goals_points,
        v_total_points,
        v_goals_count, v_assists_count
      )
      ON CONFLICT (player_id, round_id) DO UPDATE SET
        victories = EXCLUDED.victories, draws = EXCLUDED.draws, defeats = EXCLUDED.defeats,
        yellow_cards = EXCLUDED.yellow_cards, blue_cards = EXCLUDED.blue_cards,
        lates = EXCLUDED.lates, absences = EXCLUDED.absences, punishments = EXCLUDED.punishments,
        goal_difference = EXCLUDED.goal_difference, clean_sheets = EXCLUDED.clean_sheets,
        is_substitute = EXCLUDED.is_substitute,
        presence_points = EXCLUDED.presence_points, victory_points = EXCLUDED.victory_points,
        draw_points = EXCLUDED.draw_points, defeat_points = EXCLUDED.defeat_points,
        late_points = EXCLUDED.late_points, absence_points = EXCLUDED.absence_points,
        punishment_points = EXCLUDED.punishment_points, card_points = EXCLUDED.card_points,
        goal_points = EXCLUDED.goal_points, total_points = EXCLUDED.total_points,
        goals = EXCLUDED.goals, assists = EXCLUDED.assists;
    END LOOP;
    
    rounds_processed := rounds_processed + 1;
  END LOOP;
  
  RAISE NOTICE 'Rodadas processadas: %', rounds_processed;
  
  -- Atualizar rankings agregados
  UPDATE public.player_rankings pr SET
    pontos_totais = (SELECT COALESCE(SUM(prs.total_points), 0) FROM public.player_round_stats prs WHERE prs.player_id = pr.player_id),
    vitorias = (SELECT COALESCE(SUM(prs.victories), 0) FROM public.player_round_stats prs WHERE prs.player_id = pr.player_id),
    empates = (SELECT COALESCE(SUM(prs.draws), 0) FROM public.player_round_stats prs WHERE prs.player_id = pr.player_id),
    derrotas = (SELECT COALESCE(SUM(prs.defeats), 0) FROM public.player_round_stats prs WHERE prs.player_id = pr.player_id),
    gols = (SELECT COALESCE(SUM(prs.goals), 0) FROM public.player_round_stats prs WHERE prs.player_id = pr.player_id),
    assistencias = (SELECT COALESCE(SUM(prs.assists), 0) FROM public.player_round_stats prs WHERE prs.player_id = pr.player_id),
    cartoes_amarelos = (SELECT COALESCE(SUM(prs.yellow_cards), 0) FROM public.player_round_stats prs WHERE prs.player_id = pr.player_id),
    cartoes_azuis = (SELECT COALESCE(SUM(prs.blue_cards), 0) FROM public.player_round_stats prs WHERE prs.player_id = pr.player_id),
    saldo_gols = (SELECT COALESCE(SUM(prs.goal_difference), 0) FROM public.player_round_stats prs WHERE prs.player_id = pr.player_id),
    clean_sheets = (SELECT COALESCE(SUM(prs.clean_sheets), 0) FROM public.player_round_stats prs WHERE prs.player_id = pr.player_id),
    presencas = (SELECT COUNT(DISTINCT prs.round_id) FROM public.player_round_stats prs WHERE prs.player_id = pr.player_id AND prs.presence_points > 0),
    faltas = (SELECT COALESCE(SUM(prs.absences), 0) FROM public.player_round_stats prs WHERE prs.player_id = pr.player_id),
    atrasos = (SELECT COALESCE(SUM(prs.lates), 0) FROM public.player_round_stats prs WHERE prs.player_id = pr.player_id),
    updated_at = NOW();
    
  RAISE NOTICE 'Rankings atualizados com sucesso!';
END $$;

SELECT 'Regras 2026 v2 aplicadas com sucesso! Nova regra: +1 ponto por gol da equipe.' as resultado;
