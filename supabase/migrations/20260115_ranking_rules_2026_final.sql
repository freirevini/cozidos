-- =============================================
-- MIGRATION: Regras de Pontuação 2026 (FINAL)
-- Data: 2026-01-15
-- =============================================
-- 
-- REGRAS DE PONTUAÇÃO:
--   ✅ Presença: +3 pontos
--   🏆 Vitória: +3 pontos
--   🤝 Empate: +1 ponto
--   📊 Saldo de Gols: +N pontos (apenas se total positivo)
--   🧤 Clean Sheet: +2 pontos
--   ⏰ Atraso: -10 pontos
--   ❌ Falta: -20 pontos
--   🟨 Cartão Amarelo: -1 ponto
--   🟦 Cartão Azul: -2 pontos
--
-- Substitutos (jogadores emprestados) não ganham pontos de ranking.
-- =============================================

-- 1. Função principal de recálculo por rodada
CREATE OR REPLACE FUNCTION public.recalc_round_aggregates(p_round_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
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
  v_late_points INT;
  v_absence_points INT;
  v_card_points INT;
  v_punishment_points INT;
  v_total_points INT;
  v_attendance_status TEXT;
BEGIN
  -- Validar acesso admin
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado');
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
    v_goal_difference := 0;
    v_clean_sheets := 0;
    v_is_substitute := false;
    v_lates := 0;
    v_absences := 0;
    v_player_original_team := player_record.original_team;
    
    -- Verificar se é substituto
    SELECT EXISTS(
      SELECT 1 FROM public.match_absence_substitutes mas
      JOIN public.matches m ON m.id = mas.match_id
      WHERE m.round_id = p_round_id AND mas.substitute_id = player_record.player_id
    ) INTO v_is_substitute;
    
    -- Verificar status de presença
    SELECT status INTO v_attendance_status
    FROM public.round_absences
    WHERE round_id = p_round_id AND player_id = player_record.player_id
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
      WHERE m.round_id = p_round_id 
        AND m.status = 'finished'
        AND (m.team_home = v_player_original_team OR m.team_away = v_player_original_team)
    LOOP
      IF v_player_original_team = match_record.team_home THEN
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
      
      -- Saldo TOTAL (soma todos os resultados)
      v_goal_difference := v_goal_difference + (v_team_goals - v_opponent_goals);
      
      -- Clean sheet
      IF v_opponent_goals = 0 THEN
        v_clean_sheets := v_clean_sheets + 1;
      END IF;
    END LOOP;
    
    -- Contar gols
    SELECT COUNT(*) INTO v_goals_count
    FROM public.goals g
    JOIN public.matches m ON m.id = g.match_id
    WHERE m.round_id = p_round_id 
      AND g.player_id = player_record.player_id
      AND g.is_own_goal = false;
    
    -- Contar assistências
    SELECT COUNT(*) INTO v_assists_count
    FROM public.assists a
    JOIN public.goals g ON g.id = a.goal_id
    JOIN public.matches m ON m.id = g.match_id
    WHERE m.round_id = p_round_id 
      AND a.player_id = player_record.player_id;
    
    -- Contar cartões
    SELECT 
      COALESCE(COUNT(*) FILTER (WHERE card_type = 'amarelo'), 0),
      COALESCE(COUNT(*) FILTER (WHERE card_type = 'azul'), 0)
    INTO v_yellow_cards, v_blue_cards
    FROM public.cards c
    JOIN public.matches m ON m.id = c.match_id
    WHERE m.round_id = p_round_id AND c.player_id = player_record.player_id;
    
    -- Somar punições
    SELECT COALESCE(SUM(points), 0) INTO v_punishments_sum
    FROM public.punishments
    WHERE round_id = p_round_id AND player_id = player_record.player_id;
    
    -- ============================================
    -- CÁLCULO DE PONTOS - REGRAS 2026
    -- ============================================
    IF NOT v_is_substitute AND v_absences = 0 THEN
      v_presence_points := 3;                              -- Presença: +3
      v_victory_points := v_victories * 3;                 -- Vitória: +3
      v_draw_points := v_draws * 1;                        -- Empate: +1
      -- Saldo só conta se TOTAL for positivo
      v_goal_diff_points := CASE WHEN v_goal_difference > 0 THEN v_goal_difference ELSE 0 END;
      v_clean_sheet_points := v_clean_sheets * 2;          -- Clean Sheet: +2
    ELSE
      v_presence_points := 0;
      v_victory_points := 0;
      v_draw_points := 0;
      v_goal_diff_points := 0;
      v_clean_sheet_points := 0;
    END IF;
    
    -- Penalidades
    v_late_points := v_lates * -10;                        -- Atraso: -10
    v_absence_points := v_absences * -20;                  -- Falta: -20
    v_card_points := (v_yellow_cards * -1) + (v_blue_cards * -2);  -- Amarelo: -1, Azul: -2
    v_punishment_points := v_punishments_sum;
    
    -- Total
    v_total_points := 
      v_presence_points + v_victory_points + v_draw_points +
      v_goal_diff_points + v_clean_sheet_points +
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
      player_record.player_id, p_round_id, 
      v_victories, v_draws, v_defeats,
      v_yellow_cards, v_blue_cards, v_lates, v_absences, 
      (SELECT COUNT(*) FROM public.punishments WHERE round_id = p_round_id AND player_id = player_record.player_id),
      v_goal_difference, v_clean_sheets, v_is_substitute,
      v_presence_points, v_victory_points, v_draw_points, 0,
      v_late_points, v_absence_points, v_punishment_points, v_card_points,
      v_goal_diff_points + v_clean_sheet_points,
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
  
  -- Atualizar rankings agregados
  PERFORM public.recalc_all_player_rankings();
  
  RETURN json_build_object('success', true, 'message', 'Rodada recalculada com Regras 2026');
END;
$$;

-- 2. Função de recálculo de rankings agregados
CREATE OR REPLACE FUNCTION public.recalc_all_player_rankings()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  profile_record RECORD;
  v_total_points INT;
  v_vitorias INT;
  v_empates INT;
  v_derrotas INT;
  v_presencas INT;
  v_faltas INT;
  v_atrasos INT;
  v_punicoes INT;
  v_amarelos INT;
  v_azuis INT;
  v_saldo INT;
  v_clean_sheets INT;
  v_gols INT;
  v_assistencias INT;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  FOR profile_record IN
    SELECT 
      pr.id as profile_id,
      COALESCE(pr.nickname, pr.name) as display_name,
      pr.email
    FROM public.profiles pr
    WHERE pr.is_player = true 
      AND pr.status = 'aprovado'
      AND (pr.is_guest = false OR pr.is_guest IS NULL)
  LOOP
    -- Agregar de player_round_stats
    SELECT 
      COALESCE(SUM(total_points), 0),
      COALESCE(SUM(victories), 0),
      COALESCE(SUM(draws), 0),
      COALESCE(SUM(defeats), 0),
      COALESCE(COUNT(DISTINCT round_id) FILTER (WHERE presence_points > 0), 0),
      COALESCE(SUM(absences), 0),
      COALESCE(SUM(lates), 0),
      COALESCE(SUM(punishments), 0),
      COALESCE(SUM(yellow_cards), 0),
      COALESCE(SUM(blue_cards), 0),
      COALESCE(SUM(goal_difference), 0),
      COALESCE(SUM(clean_sheets), 0),
      COALESCE(SUM(goals), 0),
      COALESCE(SUM(assists), 0)
    INTO v_total_points, v_vitorias, v_empates, v_derrotas, v_presencas,
         v_faltas, v_atrasos, v_punicoes, v_amarelos, v_azuis,
         v_saldo, v_clean_sheets, v_gols, v_assistencias
    FROM public.player_round_stats
    WHERE player_id = profile_record.profile_id;

    -- Upsert player_rankings
    INSERT INTO public.player_rankings (
      player_id, nickname, email,
      gols, assistencias, vitorias, empates, derrotas,
      presencas, faltas, atrasos, punicoes,
      cartoes_amarelos, cartoes_azuis, saldo_gols, clean_sheets, pontos_totais
    ) VALUES (
      profile_record.profile_id,
      profile_record.display_name,
      profile_record.email,
      v_gols, v_assistencias, v_vitorias, v_empates, v_derrotas,
      v_presencas, v_faltas, v_atrasos, v_punicoes,
      v_amarelos, v_azuis, v_saldo, v_clean_sheets, v_total_points
    )
    ON CONFLICT (player_id) DO UPDATE SET
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
      saldo_gols = EXCLUDED.saldo_gols,
      clean_sheets = EXCLUDED.clean_sheets,
      pontos_totais = EXCLUDED.pontos_totais,
      nickname = EXCLUDED.nickname,
      updated_at = NOW();
  END LOOP;

  RETURN json_build_object('success', true, 'message', 'Rankings agregados recalculados');
END;
$function$;

-- 3. Função helper para recalcular todas as rodadas de 2026
CREATE OR REPLACE FUNCTION public.recalc_2026_rounds()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  round_record RECORD;
  rounds_processed INT := 0;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  FOR round_record IN
    SELECT r.id, r.round_number
    FROM public.rounds r
    WHERE r.scheduled_date >= '2026-01-01'
      AND r.scheduled_date <= '2026-12-31'
    ORDER BY r.round_number
  LOOP
    PERFORM public.recalc_round_aggregates(round_record.id);
    rounds_processed := rounds_processed + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true, 
    'message', 'Rodadas de 2026 recalculadas',
    'rounds_processed', rounds_processed
  );
END;
$$;

-- 4. Permissões
GRANT EXECUTE ON FUNCTION public.recalc_round_aggregates(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_all_player_rankings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_2026_rounds() TO authenticated;
