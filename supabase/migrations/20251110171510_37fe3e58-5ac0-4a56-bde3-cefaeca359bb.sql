-- Step 1: Rename enum value from 'vermelho' to 'azul'
ALTER TYPE card_type RENAME VALUE 'vermelho' TO 'azul';

-- Step 2: Rename columns in player_round_stats
ALTER TABLE player_round_stats RENAME COLUMN red_cards TO blue_cards;

-- Step 3: Rename columns in player_rankings
ALTER TABLE player_rankings RENAME COLUMN cartoes_vermelhos TO cartoes_azuis;

-- Step 4: Update recalc_round_aggregates function with NEW scoring rules
CREATE OR REPLACE FUNCTION public.recalc_round_aggregates(p_round_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  profile_record RECORD;
  match_record RECORD;
  victories INT;
  draws INT;
  defeats INT;
  goals_count INT;
  assists_count INT;
  yellow_cards INT;
  blue_cards INT;
  lates INT;
  absences INT;
  punishments_sum INT;
  presence_points INT;
  victory_points INT;
  draw_points INT;
  defeat_points INT;
  late_points INT;
  absence_points INT;
  punishment_points INT;
  card_points INT;
  goal_points INT;
  assist_points INT;
  total_points INT;
  attendance_status_val TEXT;
BEGIN
  -- Validate admin access
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  -- Recalculate player_round_stats for this round (using profiles.id)
  FOR profile_record IN 
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
    blue_cards := 0;
    lates := 0;
    absences := 0;
    punishments_sum := 0;
    presence_points := 10; -- Default presence
    
    -- Check attendance status
    SELECT status INTO attendance_status_val
    FROM public.player_attendance
    WHERE round_id = p_round_id AND player_id = profile_record.player_id
    LIMIT 1;
    
    -- Adjust presence points based on attendance
    IF attendance_status_val = 'falta' THEN
      presence_points := 0;
      absences := 1;
    ELSIF attendance_status_val = 'atrasado' THEN
      presence_points := 10;
      lates := 1;
    ELSE
      presence_points := 10;
    END IF;
    
    -- Count victories, draws, defeats from matches
    FOR match_record IN
      SELECT m.id, m.team_home, m.team_away, m.score_home, m.score_away, rtp.team_color
      FROM public.matches m
      JOIN public.round_team_players rtp ON rtp.round_id = m.round_id
      WHERE m.round_id = p_round_id 
        AND rtp.player_id = profile_record.player_id
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
      AND g.player_id = profile_record.player_id
      AND g.is_own_goal = false;
    
    -- Count assists
    SELECT COUNT(*) INTO assists_count
    FROM public.assists a
    JOIN public.goals g ON g.id = a.goal_id
    JOIN public.matches m ON m.id = g.match_id
    WHERE m.round_id = p_round_id 
      AND a.player_id = profile_record.player_id;
    
    -- Count cards
    SELECT 
      COALESCE(COUNT(*) FILTER (WHERE card_type = 'amarelo'), 0),
      COALESCE(COUNT(*) FILTER (WHERE card_type = 'azul'), 0)
    INTO yellow_cards, blue_cards
    FROM public.cards c
    JOIN public.matches m ON m.id = c.match_id
    WHERE m.round_id = p_round_id 
      AND c.player_id = profile_record.player_id;
    
    -- Sum punishment points
    SELECT COALESCE(SUM(points), 0) INTO punishments_sum
    FROM public.punishments
    WHERE round_id = p_round_id 
      AND player_id = profile_record.player_id;
    
    -- Calculate individual point components (NEW RULES)
    victory_points := victories * 3;        -- Changed from 10 to 3
    draw_points := draws * 1;               -- Changed from 5 to 1
    defeat_points := defeats * 0;
    goal_points := goals_count * 1;
    assist_points := assists_count * 2;     -- Maintained
    late_points := lates * -5;
    absence_points := absences * -10;
    card_points := (yellow_cards * -1) + (blue_cards * -2);  -- Blue card now -2
    punishment_points := punishments_sum;
    
    -- Calculate total points (including ALL components)
    total_points := 
      presence_points +
      victory_points +
      draw_points +
      defeat_points +
      goal_points +
      assist_points +
      late_points +
      absence_points +
      card_points +
      punishment_points;
    
    -- Upsert player_round_stats
    INSERT INTO public.player_round_stats (
      player_id, round_id, victories, draws, defeats,
      yellow_cards, blue_cards, lates, absences, punishments,
      presence_points, victory_points, draw_points, defeat_points,
      late_points, absence_points, punishment_points, card_points,
      goal_points, total_points
    ) VALUES (
      profile_record.player_id, p_round_id, victories, draws, defeats,
      yellow_cards, blue_cards, lates, absences, 
      (SELECT COUNT(*) FROM public.punishments WHERE round_id = p_round_id AND player_id = profile_record.player_id),
      presence_points, victory_points, draw_points, defeat_points,
      late_points, absence_points, punishment_points, card_points,
      goal_points, total_points
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
  
  -- Update player_rankings (aggregated across all rounds, anchored by profiles.id)
  FOR profile_record IN
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
      COALESCE(SUM(prs.total_points), 0) as total_points
    FROM public.profiles pr
    LEFT JOIN public.player_round_stats prs ON prs.player_id = pr.id
    WHERE pr.is_player = true AND pr.status = 'aprovado'
    GROUP BY pr.id, pr.nickname, pr.name, pr.email
  LOOP
    INSERT INTO public.player_rankings (
      player_id, nickname, email,
      vitorias, empates, derrotas,
      gols, assistencias,
      cartoes_amarelos, cartoes_azuis,
      atrasos, faltas, punicoes,
      presencas, pontos_totais
    ) VALUES (
      profile_record.profile_id,
      profile_record.display_name,
      profile_record.email,
      profile_record.total_victories,
      profile_record.total_draws,
      profile_record.total_defeats,
      profile_record.total_gols,
      profile_record.total_assistencias,
      profile_record.total_yellow,
      profile_record.total_blue,
      profile_record.total_lates,
      profile_record.total_absences,
      profile_record.total_punishments,
      profile_record.total_presences,
      profile_record.total_points
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
      pontos_totais = EXCLUDED.pontos_totais,
      nickname = EXCLUDED.nickname,
      updated_at = NOW();
  END LOOP;
  
  RETURN json_build_object('success', true, 'message', 'Estatísticas recalculadas com sucesso');
END;
$$;

-- Step 5: Update recalc_all_player_rankings function with NEW scoring rules
CREATE OR REPLACE FUNCTION public.recalc_all_player_rankings()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Validate admin access
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  -- Recalculate player_rankings for all approved players
  INSERT INTO public.player_rankings (
    player_id, nickname, email,
    vitorias, empates, derrotas,
    gols, assistencias,
    cartoes_amarelos, cartoes_azuis,
    atrasos, faltas, punicoes,
    presencas, pontos_totais
  )
  SELECT 
    pr.id as player_id,
    COALESCE(pr.nickname, pr.name) as nickname,
    pr.email,
    COALESCE(SUM(prs.victories), 0) as vitorias,
    COALESCE(SUM(prs.draws), 0) as empates,
    COALESCE(SUM(prs.defeats), 0) as derrotas,
    COALESCE((SELECT COUNT(*) FROM public.goals g JOIN public.matches m ON m.id = g.match_id WHERE g.player_id = pr.id AND g.is_own_goal = false), 0) as gols,
    COALESCE((SELECT COUNT(*) FROM public.assists a WHERE a.player_id = pr.id), 0) as assistencias,
    COALESCE(SUM(prs.yellow_cards), 0) as cartoes_amarelos,
    COALESCE(SUM(prs.blue_cards), 0) as cartoes_azuis,
    COALESCE(SUM(prs.lates), 0) as atrasos,
    COALESCE(SUM(prs.absences), 0) as faltas,
    COALESCE(SUM(prs.punishments), 0) as punicoes,
    COALESCE(COUNT(DISTINCT prs.round_id) FILTER (WHERE prs.presence_points > 0), 0) as presencas,
    COALESCE(SUM(prs.total_points), 0) as pontos_totais
  FROM public.profiles pr
  LEFT JOIN public.player_round_stats prs ON prs.player_id = pr.id
  WHERE pr.is_player = true AND pr.status = 'aprovado'
  GROUP BY pr.id, pr.nickname, pr.name, pr.email
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
    pontos_totais = EXCLUDED.pontos_totais,
    nickname = EXCLUDED.nickname,
    updated_at = NOW();
    
  RETURN json_build_object('success', true, 'message', 'Rankings recalculados com sucesso');
END;
$$;