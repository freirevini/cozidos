-- =============================================================
-- TESTE: Criar Rodada 2026 e Validar Separação de Dados
-- Execute este script no SQL Editor do Supabase
-- =============================================================

-- PASSO 1: Verificar estado atual das rodadas
SELECT id, round_number, scheduled_date, status, is_historical 
FROM rounds 
ORDER BY scheduled_date DESC;

-- PASSO 2: Criar rodada de teste em 2026 (não histórica)
INSERT INTO rounds (round_number, scheduled_date, status, is_historical)
VALUES (1, '2026-01-05', 'finalizada', false)
ON CONFLICT DO NOTHING
RETURNING id;

-- PASSO 3: Inserir dados de teste para 3 jogadores na rodada 2026
-- (valores pequenos para fácil verificação)
WITH round_2026 AS (
  SELECT id FROM rounds WHERE scheduled_date = '2026-01-05' LIMIT 1
)
INSERT INTO player_round_stats (player_id, round_id, goals, assists, victories, draws, defeats, presence_points, total_points)
SELECT p.id, r.id, stats.gols, stats.assists, stats.vitorias, stats.empates, stats.derrotas, 1, stats.pontos
FROM round_2026 r
CROSS JOIN (VALUES
  ('B67A3F56', 2, 1, 1, 0, 0, 1, 16),    -- PEDRO: +2 gols, +1 assist, +1 vitória
  ('201FEAA1', 3, 2, 1, 0, 0, 1, 22),    -- LUKINHA: +3 gols, +2 assists, +1 vitória
  ('13D10F08', 1, 0, 0, 1, 0, 1, 11)     -- SIDAO: +1 gol, +0 assists, +0 vitória, +1 empate
) AS stats(token, gols, assists, vitorias, empates, derrotas, presenca, pontos)
JOIN profiles p ON p.claim_token = stats.token
ON CONFLICT DO NOTHING;

-- PASSO 4: Verificar dados separados por ano

-- 4a. Dados de 2025 (rodada histórica) - devem permanecer iguais
SELECT 'Dados 2025' as periodo, p.nickname, prs.goals, prs.assists, prs.victories, prs.total_points
FROM player_round_stats prs
JOIN rounds r ON r.id = prs.round_id
JOIN profiles p ON p.id = prs.player_id
WHERE r.is_historical = true AND p.nickname IN ('PEDRO', 'LUKINHA', 'SIDAO')
ORDER BY prs.total_points DESC;

-- 4b. Dados de 2026 (rodada de teste)
SELECT 'Dados 2026' as periodo, p.nickname, prs.goals, prs.assists, prs.victories, prs.total_points
FROM player_round_stats prs
JOIN rounds r ON r.id = prs.round_id
JOIN profiles p ON p.id = prs.player_id
WHERE r.scheduled_date = '2026-01-05' AND p.nickname IN ('PEDRO', 'LUKINHA', 'SIDAO')
ORDER BY prs.total_points DESC;

-- PASSO 5: Verificar totais no ranking (deve somar 2025 + 2026)
SELECT nickname, gols, assistencias, vitorias, pontos_totais
FROM player_rankings
WHERE nickname IN ('PEDRO', 'LUKINHA', 'SIDAO')
ORDER BY pontos_totais DESC;

-- Valores esperados após soma:
-- PEDRO:   2025 (67 gols) + 2026 (2 gols) = 69 gols
-- LUKINHA: 2025 (138 gols) + 2026 (3 gols) = 141 gols
-- SIDAO:   2025 (109 gols) + 2026 (1 gol) = 110 gols
