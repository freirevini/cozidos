-- =============================================================
-- ATUALIZAÇÃO COMPLETA TEMPORADA 2025
-- Execute este script no SQL Editor do Supabase
-- =============================================================

-- PASSO 1: Limpar dados existentes da rodada histórica
DELETE FROM player_round_stats 
WHERE round_id IN (SELECT id FROM rounds WHERE is_historical = true AND scheduled_date = '2025-12-31');

-- PASSO 2: Inserir dados corrigidos na rodada histórica
WITH round_2025 AS (
  SELECT id FROM rounds WHERE scheduled_date = '2025-12-31' AND is_historical = true LIMIT 1
)
INSERT INTO player_round_stats (player_id, round_id, goals, assists, victories, draws, defeats, presence_points, total_points)
SELECT p.id, r.id, stats.gols, stats.assists, stats.vitorias, stats.empates, stats.derrotas, stats.presenca, stats.pontos
FROM round_2025 r
CROSS JOIN (VALUES
  -- (token, gols, assists, vitorias, empates, derrotas, presenca, pontos_totais)
  ('B67A3F56', 67, 36, 85, 28, 58, 41, 852),     -- PEDRO
  ('1490987B', 63, 21, 68, 36, 78, 44, 812),     -- PENSADOR
  ('13D10F08', 109, 41, 72, 30, 73, 43, 807),    -- SIDAO
  ('201FEAA1', 138, 73, 64, 35, 64, 40, 743),    -- LUKINHA
  ('E2CE9822', 1, 14, 77, 24, 35, 37, 741),      -- HENRIQUE
  ('8C3E6766', 32, 25, 54, 32, 82, 39, 712),     -- BETO
  ('30228C8D', 90, 45, 61, 28, 61, 36, 701),     -- ANDRE
  ('16E2C1BA', 63, 34, 62, 24, 74, 39, 698),     -- EDU
  ('013B0B47', 57, 47, 68, 16, 58, 35, 687),     -- HARD
  ('EB04A06E', 102, 26, 55, 27, 80, 39, 684),    -- GABIGOL
  ('5E1075C8', 78, 42, 63, 23, 62, 36, 670),     -- HEVERTON
  ('279FFC08', 47, 24, 63, 20, 59, 35, 663),     -- PALMEIRAS
  ('50C90588', 46, 28, 58, 24, 52, 35, 647),     -- MARCIO
  ('DEC2503D', 44, 23, 51, 25, 54, 31, 584),     -- RONAN
  ('32F06C42', 36, 14, 53, 18, 40, 28, 566),     -- SPINOLA
  ('64461CA7', 112, 29, 45, 50, 41, 26, 541),    -- CAIO
  ('FD0C062A', 96, 42, 59, 11, 32, 25, 530),     -- LUCATO
  ('45B70F49', 65, 15, 49, 17, 64, 32, 525),     -- VITOR
  ('B18F0C16', 64, 28, 49, 16, 41, 26, 511),     -- BRENO
  ('A012C958', 29, 23, 41, 19, 34, 23, 435),     -- BRUNO
  ('EDD98391', 44, 23, 42, 13, 55, 26, 425),     -- NANTES
  ('8703E3EB', 43, 12, 38, 12, 44, 23, 410),     -- CARVALHO
  ('6B391249', 37, 16, 39, 10, 38, 21, 387),     -- VINI
  ('18326642', 16, 6, 28, 11, 29, 17, 325),      -- LUCAO
  ('70558352', 0, 0, 21, 7, 20, 13, 215),        -- IURI
  ('304E4932', 0, 0, 13, 3, 8, 6, 152),          -- IAGO
  ('177A9E99', 8, 3, 12, 4, 8, 6, 145)           -- FELIPE
) AS stats(token, gols, assists, vitorias, empates, derrotas, presenca, pontos)
JOIN profiles p ON p.claim_token = stats.token;

-- PASSO 3: Atualizar player_rankings diretamente com os valores exatos
TRUNCATE TABLE player_rankings;

INSERT INTO player_rankings (player_id, nickname, email, gols, assistencias, vitorias, empates, derrotas, presencas, pontos_totais)
SELECT 
  p.id,
  COALESCE(p.nickname, p.name),
  p.email,
  stats.gols,
  stats.assists,
  stats.vitorias,
  stats.empates,
  stats.derrotas,
  stats.presenca,
  stats.pontos
FROM (VALUES
  ('B67A3F56', 67, 36, 85, 28, 58, 41, 852),
  ('1490987B', 63, 21, 68, 36, 78, 44, 812),
  ('13D10F08', 109, 41, 72, 30, 73, 43, 807),
  ('201FEAA1', 138, 73, 64, 35, 64, 40, 743),
  ('E2CE9822', 1, 14, 77, 24, 35, 37, 741),
  ('8C3E6766', 32, 25, 54, 32, 82, 39, 712),
  ('30228C8D', 90, 45, 61, 28, 61, 36, 701),
  ('16E2C1BA', 63, 34, 62, 24, 74, 39, 698),
  ('013B0B47', 57, 47, 68, 16, 58, 35, 687),
  ('EB04A06E', 102, 26, 55, 27, 80, 39, 684),
  ('5E1075C8', 78, 42, 63, 23, 62, 36, 670),
  ('279FFC08', 47, 24, 63, 20, 59, 35, 663),
  ('50C90588', 46, 28, 58, 24, 52, 35, 647),
  ('DEC2503D', 44, 23, 51, 25, 54, 31, 584),
  ('32F06C42', 36, 14, 53, 18, 40, 28, 566),
  ('64461CA7', 112, 29, 45, 50, 41, 26, 541),
  ('FD0C062A', 96, 42, 59, 11, 32, 25, 530),
  ('45B70F49', 65, 15, 49, 17, 64, 32, 525),
  ('B18F0C16', 64, 28, 49, 16, 41, 26, 511),
  ('A012C958', 29, 23, 41, 19, 34, 23, 435),
  ('EDD98391', 44, 23, 42, 13, 55, 26, 425),
  ('8703E3EB', 43, 12, 38, 12, 44, 23, 410),
  ('6B391249', 37, 16, 39, 10, 38, 21, 387),
  ('18326642', 16, 6, 28, 11, 29, 17, 325),
  ('70558352', 0, 0, 21, 7, 20, 13, 215),
  ('304E4932', 0, 0, 13, 3, 8, 6, 152),
  ('177A9E99', 8, 3, 12, 4, 8, 6, 145)
) AS stats(token, gols, assists, vitorias, empates, derrotas, presenca, pontos)
JOIN profiles p ON p.claim_token = stats.token;

-- PASSO 4: Verificar resultado
SELECT nickname, pontos_totais, gols, assistencias, vitorias, empates, derrotas, presencas
FROM player_rankings 
ORDER BY pontos_totais DESC;
