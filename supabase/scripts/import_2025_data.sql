-- =============================================================
-- SCRIPT DE IMPORTAÇÃO - TEMPORADA 2025
-- Execute este script no SQL Editor do Supabase
-- =============================================================

-- PASSO 1: Adicionar coluna is_historical (se não existir)
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS is_historical boolean DEFAULT false;

-- PASSO 2: Criar rodada histórica de 2025
INSERT INTO rounds (round_number, scheduled_date, status, is_historical)
VALUES (0, '2025-12-31', 'completed', true)
ON CONFLICT DO NOTHING;

-- Capturar o ID da rodada histórica
DO $$
DECLARE
  v_round_id uuid;
  v_player_id uuid;
BEGIN
  -- Buscar ou criar rodada histórica 2025
  SELECT id INTO v_round_id FROM rounds WHERE scheduled_date = '2025-12-31' AND is_historical = true LIMIT 1;
  
  IF v_round_id IS NULL THEN
    INSERT INTO rounds (round_number, scheduled_date, status, is_historical)
    VALUES (0, '2025-12-31', 'completed', true)
    RETURNING id INTO v_round_id;
  END IF;

  RAISE NOTICE 'Rodada histórica ID: %', v_round_id;

  -- =====================================================
  -- INSERIR DADOS DOS JOGADORES
  -- Formato: (token, presencas, gols, assistencias, vitorias, empates, derrotas)
  -- =====================================================

  -- PEDRO (B67A3F56)
  SELECT id INTO v_player_id FROM profiles WHERE claim_token = 'B67A3F56';
  IF v_player_id IS NOT NULL THEN
    INSERT INTO player_round_stats (player_id, round_id, goals, assists, victories, draws, defeats)
    VALUES (v_player_id, v_round_id, 67, 36, 85, 28, 58)
    ON CONFLICT DO NOTHING;
  END IF;

  -- PENSADOR (1490987B)
  SELECT id INTO v_player_id FROM profiles WHERE claim_token = '1490987B';
  IF v_player_id IS NOT NULL THEN
    INSERT INTO player_round_stats (player_id, round_id, goals, assists, victories, draws, defeats)
    VALUES (v_player_id, v_round_id, 63, 21, 68, 78, 78)
    ON CONFLICT DO NOTHING;
  END IF;

  -- SIDAO (13D10F08)
  SELECT id INTO v_player_id FROM profiles WHERE claim_token = '13D10F08';
  IF v_player_id IS NOT NULL THEN
    INSERT INTO player_round_stats (player_id, round_id, goals, assists, victories, draws, defeats)
    VALUES (v_player_id, v_round_id, 109, 41, 72, 30, 73)
    ON CONFLICT DO NOTHING;
  END IF;

  -- LUKINHA (201FEAA1)
  SELECT id INTO v_player_id FROM profiles WHERE claim_token = '201FEAA1';
  IF v_player_id IS NOT NULL THEN
    INSERT INTO player_round_stats (player_id, round_id, goals, assists, victories, draws, defeats)
    VALUES (v_player_id, v_round_id, 138, 73, 64, 35, 64)
    ON CONFLICT DO NOTHING;
  END IF;

  -- HENRIQUE (E2CE9822)
  SELECT id INTO v_player_id FROM profiles WHERE claim_token = 'E2CE9822';
  IF v_player_id IS NOT NULL THEN
    INSERT INTO player_round_stats (player_id, round_id, goals, assists, victories, draws, defeats)
    VALUES (v_player_id, v_round_id, 1, 14, 77, 24, 35)
    ON CONFLICT DO NOTHING;
  END IF;

  -- BETO (8C3E6766)
  SELECT id INTO v_player_id FROM profiles WHERE claim_token = '8C3E6766';
  IF v_player_id IS NOT NULL THEN
    INSERT INTO player_round_stats (player_id, round_id, goals, assists, victories, draws, defeats)
    VALUES (v_player_id, v_round_id, 32, 25, 54, 32, 82)
    ON CONFLICT DO NOTHING;
  END IF;

  -- ANDRE (30228C8D)
  SELECT id INTO v_player_id FROM profiles WHERE claim_token = '30228C8D';
  IF v_player_id IS NOT NULL THEN
    INSERT INTO player_round_stats (player_id, round_id, goals, assists, victories, draws, defeats)
    VALUES (v_player_id, v_round_id, 90, 45, 61, 28, 61)
    ON CONFLICT DO NOTHING;
  END IF;

  -- EDU (16E2C1BA)
  SELECT id INTO v_player_id FROM profiles WHERE claim_token = '16E2C1BA';
  IF v_player_id IS NOT NULL THEN
    INSERT INTO player_round_stats (player_id, round_id, goals, assists, victories, draws, defeats)
    VALUES (v_player_id, v_round_id, 63, 34, 62, 24, 74)
    ON CONFLICT DO NOTHING;
  END IF;

  -- HARD (013B0B47)
  SELECT id INTO v_player_id FROM profiles WHERE claim_token = '013B0B47';
  IF v_player_id IS NOT NULL THEN
    INSERT INTO player_round_stats (player_id, round_id, goals, assists, victories, draws, defeats)
    VALUES (v_player_id, v_round_id, 57, 47, 68, 16, 58)
    ON CONFLICT DO NOTHING;
  END IF;

  -- GABIGOL (EB04A06E)
  SELECT id INTO v_player_id FROM profiles WHERE claim_token = 'EB04A06E';
  IF v_player_id IS NOT NULL THEN
    INSERT INTO player_round_stats (player_id, round_id, goals, assists, victories, draws, defeats)
    VALUES (v_player_id, v_round_id, 102, 26, 55, 27, 80)
    ON CONFLICT DO NOTHING;
  END IF;

  -- HEVERTON (5E1075C8)
  SELECT id INTO v_player_id FROM profiles WHERE claim_token = '5E1075C8';
  IF v_player_id IS NOT NULL THEN
    INSERT INTO player_round_stats (player_id, round_id, goals, assists, victories, draws, defeats)
    VALUES (v_player_id, v_round_id, 78, 42, 63, 23, 62)
    ON CONFLICT DO NOTHING;
  END IF;

  -- PALMEIRAS (279FFC08)
  SELECT id INTO v_player_id FROM profiles WHERE claim_token = '279FFC08';
  IF v_player_id IS NOT NULL THEN
    INSERT INTO player_round_stats (player_id, round_id, goals, assists, victories, draws, defeats)
    VALUES (v_player_id, v_round_id, 47, 24, 63, 20, 59)
    ON CONFLICT DO NOTHING;
  END IF;

  -- MARCIO (50C90588)
  SELECT id INTO v_player_id FROM profiles WHERE claim_token = '50C90588';
  IF v_player_id IS NOT NULL THEN
    INSERT INTO player_round_stats (player_id, round_id, goals, assists, victories, draws, defeats)
    VALUES (v_player_id, v_round_id, 46, 28, 58, 24, 52)
    ON CONFLICT DO NOTHING;
  END IF;

  -- RONAN (DEC2503D)
  SELECT id INTO v_player_id FROM profiles WHERE claim_token = 'DEC2503D';
  IF v_player_id IS NOT NULL THEN
    INSERT INTO player_round_stats (player_id, round_id, goals, assists, victories, draws, defeats)
    VALUES (v_player_id, v_round_id, 44, 23, 51, 25, 54)
    ON CONFLICT DO NOTHING;
  END IF;

  -- SPINOLA (32F06C42)
  SELECT id INTO v_player_id FROM profiles WHERE claim_token = '32F06C42';
  IF v_player_id IS NOT NULL THEN
    INSERT INTO player_round_stats (player_id, round_id, goals, assists, victories, draws, defeats)
    VALUES (v_player_id, v_round_id, 36, 14, 53, 18, 40)
    ON CONFLICT DO NOTHING;
  END IF;

  -- CAIO (64461CA7)
  SELECT id INTO v_player_id FROM profiles WHERE claim_token = '64461CA7';
  IF v_player_id IS NOT NULL THEN
    INSERT INTO player_round_stats (player_id, round_id, goals, assists, victories, draws, defeats)
    VALUES (v_player_id, v_round_id, 112, 29, 45, 50, 41)
    ON CONFLICT DO NOTHING;
  END IF;

  -- LUCATO (FD0C062A)
  SELECT id INTO v_player_id FROM profiles WHERE claim_token = 'FD0C062A';
  IF v_player_id IS NOT NULL THEN
    INSERT INTO player_round_stats (player_id, round_id, goals, assists, victories, draws, defeats)
    VALUES (v_player_id, v_round_id, 96, 42, 59, 11, 32)
    ON CONFLICT DO NOTHING;
  END IF;

  -- VITOR (45B70F49)
  SELECT id INTO v_player_id FROM profiles WHERE claim_token = '45B70F49';
  IF v_player_id IS NOT NULL THEN
    INSERT INTO player_round_stats (player_id, round_id, goals, assists, victories, draws, defeats)
    VALUES (v_player_id, v_round_id, 65, 15, 49, 17, 64)
    ON CONFLICT DO NOTHING;
  END IF;

  -- BRENO (B18F0C16)
  SELECT id INTO v_player_id FROM profiles WHERE claim_token = 'B18F0C16';
  IF v_player_id IS NOT NULL THEN
    INSERT INTO player_round_stats (player_id, round_id, goals, assists, victories, draws, defeats)
    VALUES (v_player_id, v_round_id, 64, 28, 49, 16, 41)
    ON CONFLICT DO NOTHING;
  END IF;

  -- BRUNO (A012C958)
  SELECT id INTO v_player_id FROM profiles WHERE claim_token = 'A012C958';
  IF v_player_id IS NOT NULL THEN
    INSERT INTO player_round_stats (player_id, round_id, goals, assists, victories, draws, defeats)
    VALUES (v_player_id, v_round_id, 29, 23, 41, 19, 34)
    ON CONFLICT DO NOTHING;
  END IF;

  -- NANTES (EDD98391)
  SELECT id INTO v_player_id FROM profiles WHERE claim_token = 'EDD98391';
  IF v_player_id IS NOT NULL THEN
    INSERT INTO player_round_stats (player_id, round_id, goals, assists, victories, draws, defeats)
    VALUES (v_player_id, v_round_id, 44, 23, 42, 13, 55)
    ON CONFLICT DO NOTHING;
  END IF;

  -- CARVALHO (8703E3EB)
  SELECT id INTO v_player_id FROM profiles WHERE claim_token = '8703E3EB';
  IF v_player_id IS NOT NULL THEN
    INSERT INTO player_round_stats (player_id, round_id, goals, assists, victories, draws, defeats)
    VALUES (v_player_id, v_round_id, 43, 12, 38, 12, 44)
    ON CONFLICT DO NOTHING;
  END IF;

  -- VINI (6B391249)
  SELECT id INTO v_player_id FROM profiles WHERE claim_token = '6B391249';
  IF v_player_id IS NOT NULL THEN
    INSERT INTO player_round_stats (player_id, round_id, goals, assists, victories, draws, defeats)
    VALUES (v_player_id, v_round_id, 37, 16, 0, 38, 387)
    ON CONFLICT DO NOTHING;
  END IF;

  -- LUCAO (18326642)
  SELECT id INTO v_player_id FROM profiles WHERE claim_token = '18326642';
  IF v_player_id IS NOT NULL THEN
    INSERT INTO player_round_stats (player_id, round_id, goals, assists, victories, draws, defeats)
    VALUES (v_player_id, v_round_id, 16, 6, 28, 11, 29)
    ON CONFLICT DO NOTHING;
  END IF;

  -- IURI (70558352)
  SELECT id INTO v_player_id FROM profiles WHERE claim_token = '70558352';
  IF v_player_id IS NOT NULL THEN
    INSERT INTO player_round_stats (player_id, round_id, goals, assists, victories, draws, defeats)
    VALUES (v_player_id, v_round_id, 0, 0, 21, 7, 20)
    ON CONFLICT DO NOTHING;
  END IF;

  -- IAGO (304E4932)
  SELECT id INTO v_player_id FROM profiles WHERE claim_token = '304E4932';
  IF v_player_id IS NOT NULL THEN
    INSERT INTO player_round_stats (player_id, round_id, goals, assists, victories, draws, defeats)
    VALUES (v_player_id, v_round_id, 0, 0, 13, 3, 8)
    ON CONFLICT DO NOTHING;
  END IF;

  -- FELIPE (177A9E99)
  SELECT id INTO v_player_id FROM profiles WHERE claim_token = '177A9E99';
  IF v_player_id IS NOT NULL THEN
    INSERT INTO player_round_stats (player_id, round_id, goals, assists, victories, draws, defeats)
    VALUES (v_player_id, v_round_id, 8, 3, 12, 4, 8)
    ON CONFLICT DO NOTHING;
  END IF;

  RAISE NOTICE 'Importação concluída! Execute recalc_all_player_rankings() para atualizar totais.';
END $$;

-- PASSO 3: Recalcular rankings
SELECT recalc_all_player_rankings();

-- PASSO 4: Verificar resultados
SELECT p.nickname, p.claim_token, prs.goals, prs.assists, prs.victories, prs.draws, prs.defeats
FROM player_round_stats prs
JOIN profiles p ON p.id = prs.player_id
JOIN rounds r ON r.id = prs.round_id
WHERE r.is_historical = true
ORDER BY prs.victories DESC;
