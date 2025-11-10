-- Fix recalc_round_aggregates function to use correct Portuguese enum values for card_type
CREATE OR REPLACE FUNCTION public.recalc_round_aggregates(p_round_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    
    -- Count cards (FIXED: using Portuguese enum values)
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
$function$;