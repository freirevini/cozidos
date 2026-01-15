WITH raw_stats AS (
  SELECT 
    prs.round_id,
    r.round_number,
    p.nickname,
    prs.player_id,
    prs.is_substitute,
    -- Dados Armazenados
    prs.total_points as stored_total,
    prs.victory_points as stored_vic,
    prs.presence_points as stored_pres,
    prs.goal_points as stored_goals (Saldo + CS),
    prs.card_points as stored_cards,
    prs.absence_points as stored_abs,
    -- Recálculo ao Vivo
    (
      SELECT COALESCE(SUM(
        CASE 
          WHEN (m.score_home > m.score_away AND rtp.team_color = m.team_home) OR 
               (m.score_away > m.score_home AND rtp.team_color = m.team_away) THEN 1 
          ELSE 0 
        END
      ), 0)
      FROM matches m
      JOIN round_team_players rtp ON rtp.round_id = m.round_id AND rtp.player_id = prs.player_id
      WHERE m.round_id = prs.round_id AND m.status = 'finished'
      AND (m.team_home = rtp.team_color OR m.team_away = rtp.team_color)
    ) as calc_victories,
    
    (
      SELECT COALESCE(SUM(
        CASE 
          WHEN m.score_home = m.score_away THEN 1 
          ELSE 0 
        END
      ), 0)
      FROM matches m
      JOIN round_team_players rtp ON rtp.round_id = m.round_id AND rtp.player_id = prs.player_id
      WHERE m.round_id = prs.round_id AND m.status = 'finished'
      AND (m.team_home = rtp.team_color OR m.team_away = rtp.team_color)
    ) as calc_draws,

    (
      SELECT COALESCE(SUM(
        GREATEST(
          CASE 
            WHEN rtp.team_color = m.team_home THEN m.score_home - m.score_away
            ELSE m.score_away - m.score_home
          END, 0
        )
      ), 0)
      FROM matches m
      JOIN round_team_players rtp ON rtp.round_id = m.round_id AND rtp.player_id = prs.player_id
      WHERE m.round_id = prs.round_id AND m.status = 'finished'
      AND (m.team_home = rtp.team_color OR m.team_away = rtp.team_color)
    ) as calc_positive_gd,

    (
      SELECT COALESCE(SUM(
        CASE 
          WHEN (rtp.team_color = m.team_home AND m.score_away = 0) OR 
               (rtp.team_color = m.team_away AND m.score_home = 0) THEN 1 
          ELSE 0 
        END
      ), 0)
      FROM matches m
      JOIN round_team_players rtp ON rtp.round_id = m.round_id AND rtp.player_id = prs.player_id
      WHERE m.round_id = prs.round_id AND m.status = 'finished'
      AND (m.team_home = rtp.team_color OR m.team_away = rtp.team_color)
    ) as calc_clean_sheets,

    COALESCE((
      SELECT COUNT(*) FROM cards c 
      JOIN matches m ON m.id = c.match_id 
      WHERE m.round_id = prs.round_id AND c.player_id = prs.player_id AND c.card_type = 'amarelo'
    ), 0) as calc_yellow,

    COALESCE((
      SELECT COUNT(*) FROM cards c 
      JOIN matches m ON m.id = c.match_id 
      WHERE m.round_id = prs.round_id AND c.player_id = prs.player_id AND c.card_type = 'azul'
    ), 0) as calc_blue,

    COALESCE((
      SELECT COUNT(*) FROM round_absences ra 
      WHERE ra.round_id = prs.round_id AND ra.player_id = prs.player_id AND ra.status = 'falta'
    ), 0) as calc_absences,

    COALESCE((
      SELECT COUNT(*) FROM round_absences ra 
      WHERE ra.round_id = prs.round_id AND ra.player_id = prs.player_id AND ra.status = 'atrasado'
    ), 0) as calc_lates,

    COALESCE((
      SELECT SUM(points) FROM punishments pu 
      WHERE pu.round_id = prs.round_id AND pu.player_id = prs.player_id
    ), 0) as calc_punishments

  FROM player_round_stats prs
  JOIN rounds r ON r.id = prs.round_id
  JOIN profiles p ON p.id = prs.player_id
  WHERE r.scheduled_date >= '2026-01-01'
)
SELECT 
  round_number,
  nickname,
  stored_total,
  -- Cálculo Esperado (Regras Novas)
  (
    CASE WHEN is_substitute = true OR calc_absences > 0 THEN 0
    ELSE (
      3 + -- Presença
      (calc_victories * 3) +
      (calc_draws * 1) +
      calc_positive_gd +
      (calc_clean_sheets * 2)
    ) END
    + (calc_lates * -10)
    + (calc_absences * -20)
    + (calc_yellow * -1)
    + (calc_blue * -2)
    + calc_punishments
  ) as expected_total,
  
  -- Diferença
  stored_total - (
    CASE WHEN is_substitute = true OR calc_absences > 0 THEN 0
    ELSE (
      3 + 
      (calc_victories * 3) +
      (calc_draws * 1) +
      calc_positive_gd +
      (calc_clean_sheets * 2)
    ) END
    + (calc_lates * -10)
    + (calc_absences * -20)
    + (calc_yellow * -1)
    + (calc_blue * -2)
    + calc_punishments
  ) as diff,

  -- Detalhes para debug
  calc_victories as V,
  calc_draws as E,
  calc_positive_gd as GD,
  calc_clean_sheets as CS,
  calc_yellow as CA,
  calc_blue as CB,
  calc_absences as ABS

FROM raw_stats
ORDER BY round_number, nickname;
