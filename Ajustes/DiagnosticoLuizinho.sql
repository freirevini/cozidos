-- =============================================
-- DIAGNÓSTICO: Conferência de pontos do jogador 'Luizinho'
-- Verifica se os pontos foram calculados corretamente com as regras 2026 v2
-- =============================================

-- 1. Buscar o ID e dados básicos do jogador
SELECT 
  p.id as player_id,
  p.nickname,
  p.name,
  pr.pontos_totais as ranking_total,
  pr.vitorias,
  pr.empates,
  pr.gols,
  pr.assistencias,
  pr.clean_sheets,
  pr.saldo_gols
FROM profiles p
LEFT JOIN player_rankings pr ON pr.player_id = p.id
WHERE p.nickname ILIKE '%luizinho%' OR p.name ILIKE '%luizinho%';

-- 2. Detalhe por rodada (player_round_stats)
SELECT 
  r.round_number,
  r.scheduled_date,
  prs.victories,
  prs.draws,
  prs.defeats,
  prs.goals as gols_individuais,
  prs.assists as assistencias,
  prs.goal_difference as saldo_gols,
  prs.clean_sheets,
  prs.presence_points,
  prs.victory_points,
  prs.draw_points,
  prs.goal_points as "gol_diff+clean+team_goals",
  prs.late_points,
  prs.absence_points,
  prs.card_points,
  prs.total_points,
  prs.is_substitute
FROM player_round_stats prs
JOIN rounds r ON r.id = prs.round_id
JOIN profiles p ON p.id = prs.player_id
WHERE (p.nickname ILIKE '%luizinho%' OR p.name ILIKE '%luizinho%')
  AND r.scheduled_date >= '2026-01-01'
ORDER BY r.round_number;

-- 3. Recalcular manualmente os pontos esperados para conferência
-- (Mostra os dados brutos das partidas do time do jogador)
WITH jogador AS (
  SELECT id FROM profiles WHERE nickname ILIKE '%luizinho%' OR name ILIKE '%luizinho%' LIMIT 1
),
jogador_times AS (
  SELECT DISTINCT rtp.round_id, rtp.team_color, r.round_number
  FROM round_team_players rtp
  JOIN jogador j ON j.id = rtp.player_id
  JOIN rounds r ON r.id = rtp.round_id
  WHERE r.scheduled_date >= '2026-01-01'
)
SELECT 
  jt.round_number,
  jt.team_color as time_jogador,
  m.match_number,
  m.team_home,
  m.team_away,
  m.score_home,
  m.score_away,
  CASE 
    WHEN jt.team_color::text = m.team_home::text THEN m.score_home
    ELSE m.score_away
  END as gols_time,
  CASE 
    WHEN jt.team_color::text = m.team_home::text THEN m.score_away
    ELSE m.score_home
  END as gols_adversario,
  CASE 
    WHEN jt.team_color::text = m.team_home::text AND m.score_home > m.score_away THEN 'VITÓRIA'
    WHEN jt.team_color::text = m.team_away::text AND m.score_away > m.score_home THEN 'VITÓRIA'
    WHEN m.score_home = m.score_away THEN 'EMPATE'
    ELSE 'DERROTA'
  END as resultado
FROM jogador_times jt
JOIN matches m ON m.round_id = jt.round_id 
  AND (m.team_home::text = jt.team_color::text OR m.team_away::text = jt.team_color::text)
WHERE m.status = 'finished'
ORDER BY jt.round_number, m.match_number;

-- 4. Resumo esperado por rodada (cálculo manual)
WITH jogador AS (
  SELECT id FROM profiles WHERE nickname ILIKE '%luizinho%' OR name ILIKE '%luizinho%' LIMIT 1
),
jogador_times AS (
  SELECT rtp.round_id, rtp.team_color::text as team_color, r.round_number
  FROM round_team_players rtp
  JOIN jogador j ON j.id = rtp.player_id
  JOIN rounds r ON r.id = rtp.round_id
  WHERE r.scheduled_date >= '2026-01-01'
),
partidas_info AS (
  SELECT 
    jt.round_number,
    jt.team_color,
    COUNT(*) as total_partidas,
    SUM(CASE 
      WHEN (jt.team_color = m.team_home::text AND m.score_home > m.score_away) 
        OR (jt.team_color = m.team_away::text AND m.score_away > m.score_home) THEN 1 ELSE 0 
    END) as vitorias,
    SUM(CASE WHEN m.score_home = m.score_away THEN 1 ELSE 0 END) as empates,
    SUM(CASE 
      WHEN jt.team_color = m.team_home::text THEN m.score_home
      ELSE m.score_away
    END) as gols_time_total,
    SUM(CASE 
      WHEN jt.team_color = m.team_home::text THEN m.score_home - m.score_away
      ELSE m.score_away - m.score_home
    END) as saldo_total,
    SUM(CASE 
      WHEN (jt.team_color = m.team_home::text AND m.score_away = 0) 
        OR (jt.team_color = m.team_away::text AND m.score_home = 0) THEN 1 ELSE 0 
    END) as clean_sheets
  FROM jogador_times jt
  JOIN matches m ON m.round_id = jt.round_id 
    AND (m.team_home::text = jt.team_color OR m.team_away::text = jt.team_color)
  WHERE m.status = 'finished'
  GROUP BY jt.round_number, jt.team_color
)
SELECT 
  round_number,
  team_color,
  vitorias,
  empates,
  gols_time_total as "gols_equipe",
  saldo_total as "saldo",
  clean_sheets,
  -- CÁLCULO ESPERADO
  3 as "presenca_esperado",
  vitorias * 3 as "vitorias_esperado",
  empates * 1 as "empates_esperado",
  CASE WHEN saldo_total > 0 THEN saldo_total ELSE 0 END as "saldo_esperado",
  clean_sheets * 2 as "clean_sheet_esperado",
  gols_time_total * 1 as "gols_equipe_esperado",
  -- TOTAL ESPERADO
  3 + (vitorias * 3) + (empates * 1) + 
  (CASE WHEN saldo_total > 0 THEN saldo_total ELSE 0 END) +
  (clean_sheets * 2) + (gols_time_total * 1) as "TOTAL_ESPERADO"
FROM partidas_info
ORDER BY round_number;

SELECT '=== FIM DO DIAGNÓSTICO ===' as info;
