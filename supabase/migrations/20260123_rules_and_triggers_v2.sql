-- ============================================================
-- MIGRATION: Update Rules & Add Auto-Recalc Triggers
-- Data: 2026-01-23
-- ============================================================

-- 1. ATUALIZAR REGRAS NA FUNÇÃO DE CÁLCULO
-- Falta: -10 pontos (antes -20)
-- Atraso: -5 pontos (antes -10)
-- Cartões: Mantido individual (-1 Amarelo, -2 Azul)

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
  v_goal_balance_bonus INT;
  v_clean_sheets INT;
  v_is_substitute BOOLEAN;
  v_is_absent BOOLEAN;
  v_team_goals INT;
  v_opponent_goals INT;
  v_player_team TEXT;
  v_presence_points INT;
  v_victory_points INT;
  v_draw_points INT;
  v_goal_points INT;
  v_card_points INT;
  v_late_points INT;
  v_absence_points INT;
  v_total_points INT;
  v_player_count INT := 0;
BEGIN
  -- Verificar status da rodada
  SELECT status INTO v_round_status FROM rounds WHERE id = p_round_id;
  IF v_round_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Rodada não encontrada');
  END IF;
  IF v_round_status != 'finalizada' THEN
    RETURN json_build_object('success', false, 'error', 'Rodada não finalizada. Status: ' || v_round_status);
  END IF;

  -- Processar cada jogador da rodada
  FOR player_record IN 
    SELECT DISTINCT rtp.player_id, rtp.team_color::TEXT as original_team
    FROM round_team_players rtp 
    WHERE rtp.round_id = p_round_id
  LOOP
    v_player_count := v_player_count + 1;
    v_victories := 0; v_draws := 0; v_defeats := 0;
    v_goals_count := 0; v_assists_count := 0; v_own_goals_count := 0;
    v_yellow_cards := 0; v_blue_cards := 0; v_lates := 0; v_absences := 0;
    v_goal_difference := 0;
    v_goal_balance_bonus := 0;
    v_clean_sheets := 0; 
    v_is_substitute := false; v_is_absent := false;
    
    -- Verificar se é substituto
    SELECT EXISTS(
      SELECT 1 FROM match_absence_substitutes mas
      JOIN matches m ON m.id = mas.match_id
      WHERE mas.substitute_player_id = player_record.player_id AND m.round_id = p_round_id
    ) INTO v_is_substitute;
    
    -- Verificar atrasos e faltas
    SELECT 
      COALESCE(SUM(CASE WHEN status = 'atrasado' THEN 1 ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN status = 'falta' THEN 1 ELSE 0 END), 0)
    INTO v_lates, v_absences
    FROM round_absences
    WHERE round_id = p_round_id AND player_id = player_record.player_id;
    
    -- Se faltou, marcar como ausente
    IF v_absences > 0 THEN
      v_is_absent := true;
    END IF;
    
    -- Processar partidas (apenas se não faltou)
    IF NOT v_is_absent THEN
      FOR match_record IN
        SELECT id, team_home::TEXT as team_home, team_away::TEXT as team_away, 
               score_home, score_away 
        FROM matches 
        WHERE round_id = p_round_id AND status = 'finished'
      LOOP
        v_player_team := NULL;
        
        -- Verificar se foi substituto nesta partida
        SELECT mas.team_color::TEXT INTO v_player_team
        FROM match_absence_substitutes mas
        WHERE mas.match_id = match_record.id
          AND mas.substitute_player_id = player_record.player_id;
        
        -- Se não foi substituto, usar time original
        IF v_player_team IS NULL THEN
          IF player_record.original_team = match_record.team_home 
             OR player_record.original_team = match_record.team_away THEN
            v_player_team := player_record.original_team;
          END IF;
        END IF;
        
        -- Se jogador participou da partida
        IF v_player_team IS NOT NULL THEN
          IF v_player_team = match_record.team_home THEN
            v_team_goals := match_record.score_home;
            v_opponent_goals := match_record.score_away;
          ELSE
            v_team_goals := match_record.score_away;
            v_opponent_goals := match_record.score_home;
          END IF;
          
          v_goal_difference := v_goal_difference + (v_team_goals - v_opponent_goals);
          
          IF v_team_goals > v_opponent_goals THEN 
            v_victories := v_victories + 1;
            v_goal_balance_bonus := v_goal_balance_bonus + (v_team_goals - v_opponent_goals);
          ELSIF v_team_goals = v_opponent_goals THEN 
            v_draws := v_draws + 1;
          ELSE 
            v_defeats := v_defeats + 1;
          END IF;
          
          IF v_opponent_goals = 0 AND v_team_goals > 0 THEN 
            v_clean_sheets := v_clean_sheets + 1; 
          END IF;
        END IF;
      END LOOP;
    END IF;
    
    -- Contar estatísticas individuais
    SELECT COALESCE(COUNT(*), 0) INTO v_goals_count
    FROM goals g JOIN matches m ON m.id = g.match_id
    WHERE g.player_id = player_record.player_id AND m.round_id = p_round_id 
      AND m.status = 'finished' AND (g.is_own_goal IS NULL OR g.is_own_goal = false);
    
    SELECT COALESCE(COUNT(*), 0) INTO v_assists_count
    FROM assists a JOIN goals g ON g.id = a.goal_id JOIN matches m ON m.id = g.match_id
    WHERE a.player_id = player_record.player_id AND m.round_id = p_round_id AND m.status = 'finished';
    
    SELECT COALESCE(COUNT(*), 0) INTO v_own_goals_count
    FROM goals g JOIN matches m ON m.id = g.match_id
    WHERE g.player_id = player_record.player_id AND m.round_id = p_round_id 
      AND m.status = 'finished' AND g.is_own_goal = true;
    
    SELECT 
      COALESCE(SUM(CASE WHEN c.card_type::TEXT = 'amarelo' THEN 1 ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN c.card_type::TEXT = 'azul' THEN 1 ELSE 0 END), 0)
    INTO v_yellow_cards, v_blue_cards
    FROM cards c JOIN matches m ON m.id = c.match_id
    WHERE c.player_id = player_record.player_id AND m.round_id = p_round_id AND m.status = 'finished';
    
    -- ===== CALCULAR PONTOS (NOVAS REGRAS) =====
    
    IF v_is_absent THEN
      v_presence_points := 0;
      v_victory_points := 0;
      v_draw_points := 0;
      v_goal_points := 0;
      -- NOVA REGRA: Falta = -10 pontos
      v_absence_points := v_absences * -10;
    ELSIF v_is_substitute THEN
      v_presence_points := 0;
      v_victory_points := 0;
      v_draw_points := 0;
      v_goal_points := 0;
      v_absence_points := 0;
    ELSE
      v_presence_points := 3;
      v_victory_points := v_victories * 3;
      v_draw_points := v_draws * 1;
      v_goal_points := v_goal_balance_bonus + (v_clean_sheets * 2);
      v_absence_points := 0;
    END IF;
    
    v_card_points := (v_yellow_cards * -1) + (v_blue_cards * -2);
    -- NOVA REGRA: Atraso = -5 pontos
    v_late_points := v_lates * -5;
    
    v_total_points := v_presence_points + v_victory_points + v_draw_points 
                    + v_goal_points + v_card_points + v_late_points + v_absence_points;
    
    -- Upsert player_round_stats
    INSERT INTO player_round_stats (
      player_id, round_id,
      presence_points, victory_points, draw_points, defeat_points,
      goal_points, card_points, late_points, absence_points, punishment_points,
      total_points, victories, draws, defeats, lates, absences, punishments,
      yellow_cards, blue_cards, goals, assists, own_goals,
      goal_difference, clean_sheets, is_substitute
    ) VALUES (
      player_record.player_id, p_round_id,
      v_presence_points, v_victory_points, v_draw_points, 0,
      v_goal_points, v_card_points, v_late_points, v_absence_points, 0,
      v_total_points, v_victories, v_draws, v_defeats, v_lates, v_absences, 0,
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

  -- NENHUMA CHAMADA MANUAL DE REFRESH É NECESSÁRIA POIS player_rankings É VIEW
  
  RETURN json_build_object(
    'success', true, 
    'message', format('Recalculados %s jogadores. Regra: Falta -10, Atraso -5.', v_player_count),
    'players_processed', v_player_count
  );
END;
$$;

COMMENT ON FUNCTION public.recalc_round_aggregates IS 
'Regras 2026 Adjust: Falta -10, Atraso -5, Cartões Individual. Presença/Vitória/Empate normais.';


-- 2. FUNÇÃO GENÉRICA DE TRIGGER PARA RECÁLCULO
CREATE OR REPLACE FUNCTION public.trigger_recalc_round_on_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_round_id uuid;
  v_round_status text;
  v_match_id uuid;
BEGIN
  -- Determinar round_id e match_id dependendo da tabela
  IF TG_TABLE_NAME = 'round_absences' OR TG_TABLE_NAME = 'round_team_players' THEN
    v_round_id := COALESCE(NEW.round_id, OLD.round_id);
  
  ELSIF TG_TABLE_NAME = 'matches' THEN
    v_round_id := COALESCE(NEW.round_id, OLD.round_id);
  
  ELSIF TG_TABLE_NAME IN ('goals', 'cards', 'match_absence_substitutes' /*, 'assists' - assists tem goal_id, não match_id direto */) THEN
    v_match_id := COALESCE(NEW.match_id, OLD.match_id);
    SELECT round_id INTO v_round_id FROM matches WHERE id = v_match_id;
    
  ELSIF TG_TABLE_NAME = 'assists' THEN
    -- Para assistências, precisamos buscar o match_id através do goal_id
    IF NEW.goal_id IS NOT NULL THEN
      SELECT match_id INTO v_match_id FROM goals WHERE id = NEW.goal_id;
    ELSE
      SELECT match_id INTO v_match_id FROM goals WHERE id = OLD.goal_id;
    END IF;
    SELECT round_id INTO v_round_id FROM matches WHERE id = v_match_id;
  END IF;

  -- Se não achou round_id, sai
  IF v_round_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Validação crucial: Só recalcula se a rodada estiver FINALIZADA
  -- Se estiver "em_andamento" ou "a_iniciar", o cálculo será feito ao finalizar a rodada.
  SELECT status INTO v_round_status FROM rounds WHERE id = v_round_id;
  
  IF v_round_status = 'finalizada' THEN
    -- Dispara recálculo assíncrono ou síncrono da rodada
    -- Como é trigger, será síncrono na transação.
    PERFORM public.recalc_round_aggregates(v_round_id);
  END IF;

  RETURN NULL;
END;
$$;


-- 3. APLICAR TRIGGERS
-- Remove triggers antigos se existirem para evitar duplicidade
DROP TRIGGER IF EXISTS trg_recalc_on_absence ON round_absences;
DROP TRIGGER IF EXISTS trg_recalc_on_team_player ON round_team_players;
DROP TRIGGER IF EXISTS trg_recalc_on_match ON matches;
DROP TRIGGER IF EXISTS trg_recalc_on_goal ON goals;
DROP TRIGGER IF EXISTS trg_recalc_on_card ON cards;
DROP TRIGGER IF EXISTS trg_recalc_on_substitution ON match_absence_substitutes;
DROP TRIGGER IF EXISTS trg_recalc_on_assist ON assists;

-- Criar Triggers
CREATE TRIGGER trg_recalc_on_absence
  AFTER INSERT OR UPDATE OR DELETE ON round_absences
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recalc_round_on_change();

CREATE TRIGGER trg_recalc_on_team_player
  AFTER INSERT OR DELETE ON round_team_players
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recalc_round_on_change();

CREATE TRIGGER trg_recalc_on_match
  AFTER UPDATE OF score_home, score_away, status ON matches
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recalc_round_on_change();

CREATE TRIGGER trg_recalc_on_goal
  AFTER INSERT OR UPDATE OR DELETE ON goals
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recalc_round_on_change();

CREATE TRIGGER trg_recalc_on_card
  AFTER INSERT OR UPDATE OR DELETE ON cards
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recalc_round_on_change();

CREATE TRIGGER trg_recalc_on_substitution
  AFTER INSERT OR UPDATE OR DELETE ON match_absence_substitutes
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recalc_round_on_change();
  
CREATE TRIGGER trg_recalc_on_assist
  AFTER INSERT OR UPDATE OR DELETE ON assists
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recalc_round_on_change();
