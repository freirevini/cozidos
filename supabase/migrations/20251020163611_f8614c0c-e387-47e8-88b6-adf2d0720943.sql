-- Add birth_date and age_years to players table
ALTER TABLE public.players 
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS age_years INTEGER;

-- Add unique constraint to assists table (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'assists_goal_player_unique'
  ) THEN
    ALTER TABLE public.assists
    ADD CONSTRAINT assists_goal_player_unique UNIQUE (goal_id, player_id);
  END IF;
END $$;

-- Function to calculate age in years (America/Sao_Paulo timezone)
CREATE OR REPLACE FUNCTION public.calculate_age_years(birth_date DATE)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  today_local DATE;
BEGIN
  IF birth_date IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get current date in America/Sao_Paulo timezone
  today_local := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;
  
  RETURN DATE_PART('year', AGE(today_local, birth_date));
END;
$$;

-- Function to set player birth date with validation
CREATE OR REPLACE FUNCTION public.set_player_birth_date(p_player_id UUID, p_birth_date DATE)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today_local DATE;
  calculated_age INTEGER;
BEGIN
  -- Validate admin access
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado: apenas administradores podem executar esta função');
  END IF;

  today_local := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;
  
  -- Validate: no future dates
  IF p_birth_date > today_local THEN
    RETURN json_build_object('success', false, 'error', 'Data de nascimento não pode ser no futuro');
  END IF;
  
  -- Validate: not before 1900
  IF p_birth_date < '1900-01-01'::DATE THEN
    RETURN json_build_object('success', false, 'error', 'Data de nascimento não pode ser anterior a 1900');
  END IF;
  
  -- Calculate age
  calculated_age := public.calculate_age_years(p_birth_date);
  
  -- Update player
  UPDATE public.players
  SET birth_date = p_birth_date,
      age_years = calculated_age,
      updated_at = NOW()
  WHERE id = p_player_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Jogador não encontrado');
  END IF;
  
  RETURN json_build_object('success', true, 'age_years', calculated_age);
END;
$$;

-- Trigger to auto-update age_years when birth_date changes
CREATE OR REPLACE FUNCTION public.update_player_age()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.age_years := public.calculate_age_years(NEW.birth_date);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_player_age ON public.players;
CREATE TRIGGER trigger_update_player_age
  BEFORE INSERT OR UPDATE OF birth_date
  ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION public.update_player_age();

-- Function to close a single match (idempotent)
CREATE OR REPLACE FUNCTION public.close_match(p_match_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  match_status TEXT;
BEGIN
  -- Validate admin access
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  -- Get current status
  SELECT status INTO match_status FROM public.matches WHERE id = p_match_id;
  
  IF match_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Partida não encontrada');
  END IF;
  
  -- If already finished, return success (idempotent)
  IF match_status = 'finished' THEN
    RETURN json_build_object('success', true, 'message', 'Partida já estava encerrada', 'already_closed', true);
  END IF;
  
  -- Close the match
  UPDATE public.matches
  SET status = 'finished',
      finished_at = NOW(),
      match_timer_paused_at = NULL
  WHERE id = p_match_id;
  
  RETURN json_build_object('success', true, 'message', 'Partida encerrada com sucesso', 'already_closed', false);
END;
$$;

-- Function to close all matches in a round (with transaction)
CREATE OR REPLACE FUNCTION public.close_all_matches_by_round(p_round_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_matches INTEGER;
  closed_count INTEGER := 0;
  already_closed_count INTEGER := 0;
  match_record RECORD;
BEGIN
  -- Validate admin access
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  -- Count total matches
  SELECT COUNT(*) INTO total_matches FROM public.matches WHERE round_id = p_round_id;
  
  IF total_matches = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Nenhuma partida encontrada para esta rodada');
  END IF;
  
  -- Close each match
  FOR match_record IN 
    SELECT id, status FROM public.matches WHERE round_id = p_round_id
  LOOP
    IF match_record.status = 'finished' THEN
      already_closed_count := already_closed_count + 1;
    ELSE
      UPDATE public.matches
      SET status = 'finished',
          finished_at = NOW(),
          match_timer_paused_at = NULL
      WHERE id = match_record.id;
      
      closed_count := closed_count + 1;
    END IF;
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'total_matches', total_matches,
    'newly_closed', closed_count,
    'already_closed', already_closed_count,
    'message', format('Encerradas %s partidas. %s já estavam encerradas.', closed_count, already_closed_count)
  );
END;
$$;

-- Function to recalculate round aggregates (classification and statistics)
CREATE OR REPLACE FUNCTION public.recalc_round_aggregates(p_round_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  player_record RECORD;
  match_record RECORD;
  player_stats RECORD;
  victories INT;
  draws INT;
  defeats INT;
  goals_count INT;
  assists_count INT;
  yellow_cards INT;
  red_cards INT;
  lates INT;
  absences INT;
  punishments_sum INT;
  total_points INT;
BEGIN
  -- Validate admin access
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  -- Recalculate player_round_stats for this round
  FOR player_record IN 
    SELECT DISTINCT rtp.player_id 
    FROM public.round_team_players rtp 
    WHERE rtp.round_id = p_round_id
  LOOP
    -- Initialize counters
    victories := 0;
    draws := 0;
    defeats := 0;
    goals_count := 0;
    assists_count := 0;
    yellow_cards := 0;
    red_cards := 0;
    lates := 0;
    absences := 0;
    punishments_sum := 0;
    total_points := 0;
    
    -- Count victories, draws, defeats from matches
    FOR match_record IN
      SELECT m.id, m.team_home, m.team_away, m.score_home, m.score_away, rtp.team_color
      FROM public.matches m
      JOIN public.round_team_players rtp ON rtp.round_id = m.round_id
      WHERE m.round_id = p_round_id 
        AND rtp.player_id = player_record.player_id
        AND m.status = 'finished'
        AND (m.team_home = rtp.team_color OR m.team_away = rtp.team_color)
    LOOP
      IF match_record.team_color = match_record.team_home THEN
        IF match_record.score_home > match_record.score_away THEN
          victories := victories + 1;
        ELSIF match_record.score_home = match_record.score_away THEN
          draws := draws + 1;
        ELSE
          defeats := defeats + 1;
        END IF;
      ELSE
        IF match_record.score_away > match_record.score_home THEN
          victories := victories + 1;
        ELSIF match_record.score_away = match_record.score_home THEN
          draws := draws + 1;
        ELSE
          defeats := defeats + 1;
        END IF;
      END IF;
    END LOOP;
    
    -- Count goals (excluding own goals)
    SELECT COUNT(*) INTO goals_count
    FROM public.goals g
    JOIN public.matches m ON m.id = g.match_id
    WHERE m.round_id = p_round_id 
      AND g.player_id = player_record.player_id
      AND g.is_own_goal = false;
    
    -- Count assists
    SELECT COUNT(*) INTO assists_count
    FROM public.assists a
    JOIN public.goals g ON g.id = a.goal_id
    JOIN public.matches m ON m.id = g.match_id
    WHERE m.round_id = p_round_id 
      AND a.player_id = player_record.player_id;
    
    -- Count cards
    SELECT 
      COALESCE(COUNT(*) FILTER (WHERE card_type = 'amarelo'), 0),
      COALESCE(COUNT(*) FILTER (WHERE card_type = 'vermelho'), 0)
    INTO yellow_cards, red_cards
    FROM public.cards c
    JOIN public.matches m ON m.id = c.match_id
    WHERE m.round_id = p_round_id 
      AND c.player_id = player_record.player_id;
    
    -- Count attendance issues
    SELECT 
      COALESCE(COUNT(*) FILTER (WHERE status = 'atrasado'), 0),
      COALESCE(COUNT(*) FILTER (WHERE status = 'ausente'), 0)
    INTO lates, absences
    FROM public.player_attendance
    WHERE round_id = p_round_id 
      AND player_id = player_record.player_id;
    
    -- Sum punishment points
    SELECT COALESCE(SUM(points), 0) INTO punishments_sum
    FROM public.punishments
    WHERE round_id = p_round_id 
      AND player_id = player_record.player_id;
    
    -- Calculate points (existing rules)
    total_points := 
      (victories * 10) +        -- vitória = 10
      (draws * 5) +             -- empate = 5
      (defeats * 0) +           -- derrota = 0
      (goals_count * 1) +       -- gol = 1
      (assists_count * 2) +     -- assistência = 2
      (lates * -5) +            -- atraso = -5
      (absences * -10) +        -- falta = -10
      punishments_sum;          -- punições (já em valor negativo)
    
    -- Upsert player_round_stats
    INSERT INTO public.player_round_stats (
      player_id, round_id, victories, draws, defeats,
      yellow_cards, red_cards, lates, absences, punishments,
      presence_points, victory_points, draw_points, defeat_points,
      late_points, absence_points, punishment_points, card_points,
      goal_points, total_points
    ) VALUES (
      player_record.player_id, p_round_id, victories, draws, defeats,
      yellow_cards, red_cards, lates, absences, 
      (SELECT COUNT(*) FROM public.punishments WHERE round_id = p_round_id AND player_id = player_record.player_id),
      10, -- presence base points
      victories * 10, draws * 5, defeats * 0,
      lates * -5, absences * -10, punishments_sum, 
      (yellow_cards + red_cards) * -1,
      goals_count * 1,
      total_points
    )
    ON CONFLICT (player_id, round_id) 
    DO UPDATE SET
      victories = EXCLUDED.victories,
      draws = EXCLUDED.draws,
      defeats = EXCLUDED.defeats,
      yellow_cards = EXCLUDED.yellow_cards,
      red_cards = EXCLUDED.red_cards,
      lates = EXCLUDED.lates,
      absences = EXCLUDED.absences,
      punishments = EXCLUDED.punishments,
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
  
  -- Update player_rankings (aggregated across all rounds)
  FOR player_stats IN
    SELECT 
      p.id as player_id,
      COALESCE(pr.nickname, p.name) as nickname,
      pr.email,
      COALESCE(SUM(prs.victories), 0) as total_victories,
      COALESCE(SUM(prs.draws), 0) as total_draws,
      COALESCE(SUM(prs.defeats), 0) as total_defeats,
      COALESCE((SELECT COUNT(*) FROM public.goals g JOIN public.matches m ON m.id = g.match_id WHERE g.player_id = p.id AND g.is_own_goal = false), 0) as total_gols,
      COALESCE((SELECT COUNT(*) FROM public.assists a WHERE a.player_id = p.id), 0) as total_assistencias,
      COALESCE(SUM(prs.yellow_cards), 0) as total_yellow,
      COALESCE(SUM(prs.red_cards), 0) as total_red,
      COALESCE(SUM(prs.lates), 0) as total_lates,
      COALESCE(SUM(prs.absences), 0) as total_absences,
      COALESCE(SUM(prs.punishments), 0) as total_punishments,
      COALESCE(COUNT(DISTINCT prs.round_id), 0) as total_presences,
      COALESCE(SUM(prs.total_points), 0) as total_points
    FROM public.players p
    LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
    LEFT JOIN public.player_round_stats prs ON prs.player_id = p.id
    GROUP BY p.id, pr.nickname, pr.email, p.name
  LOOP
    INSERT INTO public.player_rankings (
      player_id, nickname, email,
      vitorias, empates, derrotas,
      gols, assistencias,
      cartoes_amarelos, cartoes_vermelhos,
      atrasos, faltas, punicoes,
      presencas, pontos_totais
    ) VALUES (
      player_stats.player_id,
      player_stats.nickname,
      player_stats.email,
      player_stats.total_victories,
      player_stats.total_draws,
      player_stats.total_defeats,
      player_stats.total_gols,
      player_stats.total_assistencias,
      player_stats.total_yellow,
      player_stats.total_red,
      player_stats.total_lates,
      player_stats.total_absences,
      player_stats.total_punishments,
      player_stats.total_presences,
      player_stats.total_points
    )
    ON CONFLICT (player_id)
    DO UPDATE SET
      vitorias = EXCLUDED.vitorias,
      empates = EXCLUDED.empates,
      derrotas = EXCLUDED.derrotas,
      gols = EXCLUDED.gols,
      assistencias = EXCLUDED.assistencias,
      cartoes_amarelos = EXCLUDED.cartoes_amarelos,
      cartoes_vermelhos = EXCLUDED.cartoes_vermelhos,
      atrasos = EXCLUDED.atrasos,
      faltas = EXCLUDED.faltas,
      punicoes = EXCLUDED.punicoes,
      presencas = EXCLUDED.presencas,
      pontos_totais = EXCLUDED.pontos_totais,
      updated_at = NOW();
  END LOOP;
  
  RETURN json_build_object('success', true, 'message', 'Estatísticas recalculadas com sucesso');
END;
$$;