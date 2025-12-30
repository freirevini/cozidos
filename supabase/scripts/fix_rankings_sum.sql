-- =============================================================
-- CORREÇÃO: Atualizar Rankings Somando Todos os Anos
-- Execute este script no SQL Editor do Supabase
-- =============================================================

-- Limpar e recalcular rankings com dados corretos de player_round_stats
TRUNCATE TABLE player_rankings;

-- Inserir rankings calculados corretamente (somando todos os anos)
INSERT INTO player_rankings (player_id, nickname, email, gols, assistencias, vitorias, empates, derrotas, presencas, pontos_totais)
SELECT 
  p.id,
  COALESCE(p.nickname, p.name),
  p.email,
  COALESCE(SUM(prs.goals), 0) as gols,
  COALESCE(SUM(prs.assists), 0) as assistencias,
  COALESCE(SUM(prs.victories), 0) as vitorias,
  COALESCE(SUM(prs.draws), 0) as empates,
  COALESCE(SUM(prs.defeats), 0) as derrotas,
  COALESCE(SUM(prs.presence_points), 0) as presencas,
  COALESCE(SUM(prs.total_points), 0) as pontos_totais
FROM profiles p
LEFT JOIN player_round_stats prs ON prs.player_id = p.id
WHERE p.is_player = true AND p.status = 'aprovado'
GROUP BY p.id, p.nickname, p.name, p.email;

-- Verificar resultado (deve somar 2025 + 2026)
SELECT nickname, gols, assistencias, vitorias, empates, derrotas, pontos_totais
FROM player_rankings
WHERE nickname IN ('PEDRO', 'LUKINHA', 'SIDAO')
ORDER BY pontos_totais DESC;

-- Valores esperados:
-- PEDRO:   67 + 2 = 69 gols,  36 + 1 = 37 assists,  85 + 1 = 86 vitórias
-- LUKINHA: 138 + 3 = 141 gols, 73 + 2 = 75 assists, 64 + 1 = 65 vitórias
-- SIDAO:   109 + 1 = 110 gols, 41 + 0 = 41 assists, 72 + 0 = 72 vitórias
