-- Migration: Nova Pontuação 2026
-- Regras:
--   - Presença (time original): +3
--   - Vitória: +3
--   - Empate: +1
--   - Saldo de Gols: +N (apenas se positivo)
--   - Clean Sheet: +2
--   - Atraso: -10
--   - Cartão Amarelo: -5
--   - Cartão Azul: -20
--   - Substitutos (jogando por outro time): 0 pontos de ranking

-- 1. Adicionar novas colunas em player_round_stats
ALTER TABLE public.player_round_stats 
ADD COLUMN IF NOT EXISTS goal_difference INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS clean_sheets INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_substitute BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.player_round_stats.goal_difference IS 'Saldo de gols acumulado na rodada';
COMMENT ON COLUMN public.player_round_stats.clean_sheets IS 'Número de partidas sem sofrer gols';
COMMENT ON COLUMN public.player_round_stats.is_substitute IS 'Se jogou como substituto (time diferente do original)';

-- 2. Adicionar novas colunas em player_rankings (agregado)
ALTER TABLE public.player_rankings 
ADD COLUMN IF NOT EXISTS saldo_gols INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS clean_sheets INT DEFAULT 0;

COMMENT ON COLUMN public.player_rankings.saldo_gols IS 'Saldo de gols total (apenas positivos)';
COMMENT ON COLUMN public.player_rankings.clean_sheets IS 'Total de partidas sem sofrer gols';

-- 3. Reescrever recalc_round_aggregates com NOVA PONTUAÇÃO 2026
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
  -- Validate admin access
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
    v_goals_count := 0;
    v_assists_count := 0;
    v_yellow_cards := 0;
    v_blue_cards := 0;
    v_lates := 0;
    v_absences := 0;
    v_punishments_sum := 0;
    v_goal_difference := 0;
    v_clean_sheets := 0;
    v_is_substitute := false;
    v_player_original_team := player_record.original_team;
    
    -- Verificar se é substituto (jogou por time diferente do original)
    -- Um jogador é substituto se aparece na tabela match_absence_substitutes
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
    
    -- Ajustar presença baseado em attendance
    IF v_attendance_status = 'falta' THEN
      v_absences := 1;
    ELSIF v_attendance_status = 'atrasado' THEN
      v_lates := 1;
    END IF;
    
    -- Calcular vitórias, empates, derrotas, saldo e clean sheets por partida
    FOR match_record IN
      SELECT m.id, m.team_home, m.team_away, m.score_home, m.score_away
      FROM public.matches m
      WHERE m.round_id = p_round_id 
        AND m.status = 'finished'
        AND (m.team_home = v_player_original_team OR m.team_away = v_player_original_team)
    LOOP
      -- Determinar gols do time do jogador e do adversário
      IF v_player_original_team = match_record.team_home THEN
        v_team_goals := match_record.score_home;
        v_opponent_goals := match_record.score_away;
      ELSE
        v_team_goals := match_record.score_away;
        v_opponent_goals := match_record.score_home;
      END IF;
      
      -- Contabilizar resultado
      IF v_team_goals > v_opponent_goals THEN
        v_victories := v_victories + 1;
      ELSIF v_team_goals = v_opponent_goals THEN
        v_draws := v_draws + 1;
      ELSE
        v_defeats := v_defeats + 1;
      END IF;
      
      -- Acumular saldo de gols
      v_goal_difference := v_goal_difference + (v_team_goals - v_opponent_goals);
      
      -- Clean sheet (não sofreu gols)
      IF v_opponent_goals = 0 THEN
        v_clean_sheets := v_clean_sheets + 1;
      END IF;
    END LOOP;
    
    -- Contar gols (excluindo gols contra)
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
    WHERE m.round_id = p_round_id 
      AND c.player_id = player_record.player_id;
    
    -- Somar punições
    SELECT COALESCE(SUM(points), 0) INTO v_punishments_sum
    FROM public.punishments
    WHERE round_id = p_round_id 
      AND player_id = player_record.player_id;
    
    -- ============================================
    -- NOVA PONTUAÇÃO 2026
    -- ============================================
    
    -- Pontos apenas para jogadores do time ORIGINAL (não substitutos)
    IF NOT v_is_substitute AND v_absences = 0 THEN
      -- Presença base: +3
      v_presence_points := 3;
      -- Vitória: +3 cada
      v_victory_points := v_victories * 3;
      -- Empate: +1 cada
      v_draw_points := v_draws * 1;
      -- Saldo de gols: apenas se POSITIVO
      v_goal_diff_points := GREATEST(v_goal_difference, 0);
      -- Clean sheet: +2 cada
      v_clean_sheet_points := v_clean_sheets * 2;
    ELSE
      -- Substitutos e faltantes: 0 pontos de ranking coletivo
      v_presence_points := 0;
      v_victory_points := 0;
      v_draw_points := 0;
      v_goal_diff_points := 0;
      v_clean_sheet_points := 0;
    END IF;
    
    -- Penalidades (SEMPRE aplicam, mesmo para substitutos)
    v_late_points := v_lates * -10;          -- Atraso: -10
    v_absence_points := v_absences * -10;    -- Falta: -10 (já não ganha presença)
    v_card_points := (v_yellow_cards * -5) + (v_blue_cards * -20);  -- Amarelo: -5, Azul: -20
    v_punishment_points := v_punishments_sum;
    
    -- Calcular total
    v_total_points := 
      v_presence_points +
      v_victory_points +
      v_draw_points +
      v_goal_diff_points +
      v_clean_sheet_points +
      v_late_points +
      v_absence_points +
      v_card_points +
      v_punishment_points;
    
    -- Upsert player_round_stats
    INSERT INTO public.player_round_stats (
      player_id, round_id, 
      victories, draws, defeats,
      yellow_cards, blue_cards, 
      lates, absences, punishments,
      goal_difference, clean_sheets, is_substitute,
      presence_points, victory_points, draw_points, defeat_points,
      late_points, absence_points, punishment_points, card_points,
      goal_points, total_points
    ) VALUES (
      player_record.player_id, p_round_id, 
      v_victories, v_draws, v_defeats,
      v_yellow_cards, v_blue_cards, 
      v_lates, v_absences, 
      (SELECT COUNT(*) FROM public.punishments WHERE round_id = p_round_id AND player_id = player_record.player_id),
      v_goal_difference, v_clean_sheets, v_is_substitute,
      v_presence_points, v_victory_points, v_draw_points, 0,
      v_late_points, v_absence_points, v_punishment_points, v_card_points,
      v_goal_diff_points + v_clean_sheet_points, -- goal_points agora inclui saldo + clean sheet
      v_total_points
    )
    ON CONFLICT (player_id, round_id) 
    DO UPDATE SET
      victories = EXCLUDED.victories,
      draws = EXCLUDED.draws,
      defeats = EXCLUDED.defeats,
      yellow_cards = EXCLUDED.yellow_cards,
      blue_cards = EXCLUDED.blue_cards,
      lates = EXCLUDED.lates,
      absences = EXCLUDED.absences,
      punishments = EXCLUDED.punishments,
      goal_difference = EXCLUDED.goal_difference,
      clean_sheets = EXCLUDED.clean_sheets,
      is_substitute = EXCLUDED.is_substitute,
      presence_points = EXCLUDED.presence_points,
      victory_points = EXCLUDED.victory_points,
      draw_points = EXCLUDED.draw_points,
      defeat_points = EXCLUDED.defeat_points,
      late_points = EXCLUDED.late_points,
      absence_points = EXCLUDED.absence_points,
      punishment_points = EXCLUDED.punishment_points,
      card_points = EXCLUDED.card_points,
      goal_points = EXCLUDED.goal_points,
      total_points = EXCLUDED.total_points;
  END LOOP;
  
  -- Atualizar player_rankings (agregado de todas as rodadas)
  FOR player_record IN
    SELECT 
      pr.id as profile_id,
      COALESCE(pr.nickname, pr.name) as display_name,
      pr.email,
      COALESCE(SUM(prs.victories), 0) as total_victories,
      COALESCE(SUM(prs.draws), 0) as total_draws,
      COALESCE(SUM(prs.defeats), 0) as total_defeats,
      COALESCE((SELECT COUNT(*) FROM public.goals g JOIN public.matches m ON m.id = g.match_id WHERE g.player_id = pr.id AND g.is_own_goal = false), 0) as total_gols,
      COALESCE((SELECT COUNT(*) FROM public.assists a WHERE a.player_id = pr.id), 0) as total_assistencias,
      COALESCE(SUM(prs.yellow_cards), 0) as total_yellow,
      COALESCE(SUM(prs.blue_cards), 0) as total_blue,
      COALESCE(SUM(prs.lates), 0) as total_lates,
      COALESCE(SUM(prs.absences), 0) as total_absences,
      COALESCE(SUM(prs.punishments), 0) as total_punishments,
      COALESCE(COUNT(DISTINCT prs.round_id) FILTER (WHERE prs.presence_points > 0), 0) as total_presences,
      -- Nova: saldo de gols total (apenas positivos de cada rodada)
      COALESCE(SUM(GREATEST(prs.goal_difference, 0)), 0) as total_goal_diff,
      -- Nova: clean sheets total
      COALESCE(SUM(prs.clean_sheets), 0) as total_clean_sheets,
      COALESCE(SUM(prs.total_points), 0) as total_points
    FROM public.profiles pr
    LEFT JOIN public.player_round_stats prs ON prs.player_id = pr.id
    WHERE pr.is_player = true 
      AND pr.status = 'aprovado'
      AND (pr.is_guest = false OR pr.is_guest IS NULL)
    GROUP BY pr.id, pr.nickname, pr.name, pr.email
  LOOP
    INSERT INTO public.player_rankings (
      player_id, nickname, email,
      vitorias, empates, derrotas,
      gols, assistencias,
      cartoes_amarelos, cartoes_azuis,
      atrasos, faltas, punicoes,
      presencas, saldo_gols, clean_sheets, pontos_totais
    ) VALUES (
      player_record.profile_id,
      player_record.display_name,
      player_record.email,
      player_record.total_victories,
      player_record.total_draws,
      player_record.total_defeats,
      player_record.total_gols,
      player_record.total_assistencias,
      player_record.total_yellow,
      player_record.total_blue,
      player_record.total_lates,
      player_record.total_absences,
      player_record.total_punishments,
      player_record.total_presences,
      player_record.total_goal_diff,
      player_record.total_clean_sheets,
      player_record.total_points
    )
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
      saldo_gols = EXCLUDED.saldo_gols,
      clean_sheets = EXCLUDED.clean_sheets,
      pontos_totais = EXCLUDED.pontos_totais,
      nickname = EXCLUDED.nickname,
      updated_at = NOW();
  END LOOP;
  
  RETURN json_build_object('success', true, 'message', 'Estatísticas recalculadas com Nova Pontuação 2026');
END;
$$;

-- 4. Atualizar recalc_all_player_rankings para usar nova fórmula
CREATE OR REPLACE FUNCTION public.recalc_all_player_rankings()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  profile_record RECORD;
  v_real_gols INT;
  v_real_assistencias INT;
  v_real_vitorias INT;
  v_real_empates INT;
  v_real_derrotas INT;
  v_real_presencas INT;
  v_real_faltas INT;
  v_real_atrasos INT;
  v_real_punicoes INT;
  v_real_amarelos INT;
  v_real_azuis INT;
  v_real_saldo INT;
  v_real_clean_sheets INT;
  v_adjustment INT;
  v_current_ranking RECORD;
  v_final_gols INT;
  v_final_assistencias INT;
  v_final_vitorias INT;
  v_final_empates INT;
  v_final_derrotas INT;
  v_final_presencas INT;
  v_final_faltas INT;
  v_final_atrasos INT;
  v_final_punicoes INT;
  v_final_amarelos INT;
  v_final_azuis INT;
  v_final_saldo INT;
  v_final_clean_sheets INT;
  v_final_pontos INT;
BEGIN
  -- Validate admin access
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  -- Processar cada jogador aprovado (EXCLUINDO avulsos)
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
    -- Calcular valores REAIS dos eventos
    SELECT COALESCE(COUNT(*), 0) INTO v_real_gols
    FROM public.goals g
    JOIN public.matches m ON m.id = g.match_id
    WHERE g.player_id = profile_record.profile_id AND g.is_own_goal = false;
    
    SELECT COALESCE(COUNT(*), 0) INTO v_real_assistencias
    FROM public.assists
    WHERE player_id = profile_record.profile_id;
    
    SELECT 
      COALESCE(SUM(victories), 0),
      COALESCE(SUM(draws), 0),
      COALESCE(SUM(defeats), 0),
      COALESCE(COUNT(DISTINCT round_id) FILTER (WHERE presence_points > 0), 0),
      COALESCE(SUM(absences), 0),
      COALESCE(SUM(lates), 0),
      COALESCE(SUM(punishments), 0),
      COALESCE(SUM(yellow_cards), 0),
      COALESCE(SUM(blue_cards), 0),
      COALESCE(SUM(GREATEST(goal_difference, 0)), 0),
      COALESCE(SUM(clean_sheets), 0)
    INTO v_real_vitorias, v_real_empates, v_real_derrotas, v_real_presencas,
         v_real_faltas, v_real_atrasos, v_real_punicoes, v_real_amarelos, v_real_azuis,
         v_real_saldo, v_real_clean_sheets
    FROM public.player_round_stats
    WHERE player_id = profile_record.profile_id;

    -- Buscar ranking atual
    SELECT * INTO v_current_ranking
    FROM public.player_rankings
    WHERE player_id = profile_record.profile_id;

    -- Aplicar ajustes manuais
    v_final_gols := v_real_gols + COALESCE((
      SELECT SUM(adjustment_value) FROM player_ranking_adjustments 
      WHERE player_id = profile_record.profile_id AND adjustment_type = 'gols'
    ), 0);
    
    v_final_assistencias := v_real_assistencias + COALESCE((
      SELECT SUM(adjustment_value) FROM player_ranking_adjustments 
      WHERE player_id = profile_record.profile_id AND adjustment_type = 'assistencias'
    ), 0);
    
    v_final_vitorias := v_real_vitorias + COALESCE((
      SELECT SUM(adjustment_value) FROM player_ranking_adjustments 
      WHERE player_id = profile_record.profile_id AND adjustment_type = 'vitorias'
    ), 0);
    
    v_final_empates := v_real_empates + COALESCE((
      SELECT SUM(adjustment_value) FROM player_ranking_adjustments 
      WHERE player_id = profile_record.profile_id AND adjustment_type = 'empates'
    ), 0);
    
    v_final_derrotas := v_real_derrotas + COALESCE((
      SELECT SUM(adjustment_value) FROM player_ranking_adjustments 
      WHERE player_id = profile_record.profile_id AND adjustment_type = 'derrotas'
    ), 0);
    
    v_final_presencas := v_real_presencas + COALESCE((
      SELECT SUM(adjustment_value) FROM player_ranking_adjustments 
      WHERE player_id = profile_record.profile_id AND adjustment_type = 'presencas'
    ), 0);
    
    v_final_faltas := v_real_faltas + COALESCE((
      SELECT SUM(adjustment_value) FROM player_ranking_adjustments 
      WHERE player_id = profile_record.profile_id AND adjustment_type = 'faltas'
    ), 0);
    
    v_final_atrasos := v_real_atrasos + COALESCE((
      SELECT SUM(adjustment_value) FROM player_ranking_adjustments 
      WHERE player_id = profile_record.profile_id AND adjustment_type = 'atrasos'
    ), 0);
    
    v_final_punicoes := v_real_punicoes + COALESCE((
      SELECT SUM(adjustment_value) FROM player_ranking_adjustments 
      WHERE player_id = profile_record.profile_id AND adjustment_type = 'punicoes'
    ), 0);
    
    v_final_amarelos := v_real_amarelos + COALESCE((
      SELECT SUM(adjustment_value) FROM player_ranking_adjustments 
      WHERE player_id = profile_record.profile_id AND adjustment_type = 'cartoes_amarelos'
    ), 0);
    
    v_final_azuis := v_real_azuis + COALESCE((
      SELECT SUM(adjustment_value) FROM player_ranking_adjustments 
      WHERE player_id = profile_record.profile_id AND adjustment_type = 'cartoes_azuis'
    ), 0);

    v_final_saldo := v_real_saldo;
    v_final_clean_sheets := v_real_clean_sheets;

    -- PRESERVAR dados importados
    IF v_current_ranking IS NOT NULL THEN
      IF v_final_gols = 0 AND v_current_ranking.gols > 0 THEN
        v_final_gols := v_current_ranking.gols;
      END IF;
      IF v_final_assistencias = 0 AND v_current_ranking.assistencias > 0 THEN
        v_final_assistencias := v_current_ranking.assistencias;
      END IF;
      IF v_final_vitorias = 0 AND v_current_ranking.vitorias > 0 THEN
        v_final_vitorias := v_current_ranking.vitorias;
      END IF;
      IF v_final_empates = 0 AND v_current_ranking.empates > 0 THEN
        v_final_empates := v_current_ranking.empates;
      END IF;
      IF v_final_derrotas = 0 AND v_current_ranking.derrotas > 0 THEN
        v_final_derrotas := v_current_ranking.derrotas;
      END IF;
      IF v_final_presencas = 0 AND v_current_ranking.presencas > 0 THEN
        v_final_presencas := v_current_ranking.presencas;
      END IF;
      IF v_final_faltas = 0 AND v_current_ranking.faltas > 0 THEN
        v_final_faltas := v_current_ranking.faltas;
      END IF;
      IF v_final_atrasos = 0 AND v_current_ranking.atrasos > 0 THEN
        v_final_atrasos := v_current_ranking.atrasos;
      END IF;
      IF v_final_punicoes = 0 AND v_current_ranking.punicoes > 0 THEN
        v_final_punicoes := v_current_ranking.punicoes;
      END IF;
      IF v_final_amarelos = 0 AND v_current_ranking.cartoes_amarelos > 0 THEN
        v_final_amarelos := v_current_ranking.cartoes_amarelos;
      END IF;
      IF v_final_azuis = 0 AND v_current_ranking.cartoes_azuis > 0 THEN
        v_final_azuis := v_current_ranking.cartoes_azuis;
      END IF;
    END IF;

    -- ============================================
    -- NOVA PONTUAÇÃO 2026
    -- ============================================
    v_final_pontos := 
      (v_final_presencas * 3) +           -- Presença: +3 cada
      (v_final_vitorias * 3) +            -- Vitória: +3 cada
      (v_final_empates * 1) +             -- Empate: +1 cada
      v_final_saldo +                      -- Saldo de gols (já filtrado para apenas positivos)
      (v_final_clean_sheets * 2) +        -- Clean sheet: +2 cada
      (v_final_atrasos * -10) +           -- Atraso: -10
      (v_final_faltas * -10) +            -- Falta: -10
      (v_final_amarelos * -5) +           -- Amarelo: -5
      (v_final_azuis * -20) +             -- Azul: -20
      (v_final_punicoes);                  -- Punições variáveis

    -- Ajuste de pontos totais
    v_final_pontos := v_final_pontos + COALESCE((
      SELECT SUM(adjustment_value) FROM player_ranking_adjustments 
      WHERE player_id = profile_record.profile_id AND adjustment_type = 'pontos_totais'
    ), 0);

    -- Preservar pontos se maior
    IF v_current_ranking IS NOT NULL AND v_current_ranking.pontos_totais > v_final_pontos THEN
      v_final_pontos := v_current_ranking.pontos_totais;
    END IF;

    -- Upsert no player_rankings
    INSERT INTO public.player_rankings (
      player_id, nickname, email,
      gols, assistencias, vitorias, empates, derrotas,
      presencas, faltas, atrasos, punicoes,
      cartoes_amarelos, cartoes_azuis, saldo_gols, clean_sheets, pontos_totais
    ) VALUES (
      profile_record.profile_id,
      profile_record.display_name,
      profile_record.email,
      v_final_gols, v_final_assistencias, v_final_vitorias, v_final_empates, v_final_derrotas,
      v_final_presencas, v_final_faltas, v_final_atrasos, v_final_punicoes,
      v_final_amarelos, v_final_azuis, v_final_saldo, v_final_clean_sheets, v_final_pontos
    )
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
      saldo_gols = EXCLUDED.saldo_gols,
      clean_sheets = EXCLUDED.clean_sheets,
      pontos_totais = EXCLUDED.pontos_totais,
      nickname = EXCLUDED.nickname,
      updated_at = NOW();
  END LOOP;
  
  RETURN json_build_object('success', true, 'message', 'Rankings recalculados com Nova Pontuação 2026');
END;
$function$;

-- 5. Grant permissions
GRANT EXECUTE ON FUNCTION public.recalc_round_aggregates(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_all_player_rankings() TO authenticated;

-- 6. Criar função para recalcular APENAS rodadas de 2026
CREATE OR REPLACE FUNCTION public.recalc_2026_rounds()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  round_record RECORD;
  rounds_processed INT := 0;
  round_result json;
BEGIN
  -- Validate admin access
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  -- Processar cada rodada de 2026 que já foi finalizada ou tem partidas
  FOR round_record IN
    SELECT r.id, r.round_number
    FROM public.rounds r
    WHERE r.scheduled_date >= '2026-01-01'
      AND r.scheduled_date <= '2026-12-31'
      AND (r.is_historical IS NULL OR r.is_historical = false)
    ORDER BY r.round_number
  LOOP
    -- Recalcular estatísticas da rodada com as novas regras
    SELECT public.recalc_round_aggregates(round_record.id) INTO round_result;
    rounds_processed := rounds_processed + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true, 
    'message', 'Rodadas de 2026 recalculadas com Nova Pontuação',
    'rounds_processed', rounds_processed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalc_2026_rounds() TO authenticated;

-- 7. Executar recálculo automaticamente para todas as rodadas de 2026
-- NOTA: Esta execução será feita pelo admin ao aplicar a migration
-- Para executar manualmente, rode: SELECT public.recalc_2026_rounds();
