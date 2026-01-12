-- =============================================
-- SCRIPT COMPLETO: RODADA 1 - INSERÇÃO DE GOLS E FINALIZAÇÃO
-- Data: 08/01/2026
-- =============================================

-- =============================================
-- PASSO 0: DEFINIR VARIÁVEIS (EXECUTE PRIMEIRO PARA OBTER IDS)
-- =============================================

-- Execute estas queries para obter os IDs necessários:
/*
SELECT id as round_id FROM rounds WHERE round_number = 1 ORDER BY created_at DESC LIMIT 1;

SELECT id, match_number, team_home, team_away FROM matches WHERE round_id = 'SEU_ROUND_ID' ORDER BY match_number;

SELECT id, nickname FROM profiles WHERE nickname ILIKE ANY(ARRAY[
  'Edu', 'Thayson', 'Lucato', 'Luciano', 'Fabiano', 'Lucao', 'Gabigol', 
  'Beto', 'Sidao', 'Pedro', 'Bruno', 'Lukinha', 'Luizinho', 'Carvalho', 
  'Vitor', 'Marcio', 'Heverton', 'André', 'Pensador', 'Palmeiras', 'Ronan'
]);
*/

-- =============================================
-- PASSO 1: CRIAR CONVIDADO "GABRIEL" NO LUGAR DE RONAN
-- =============================================

DO $$
DECLARE
  v_round_id UUID;
  v_gabriel_id UUID;
BEGIN
  -- Obter round_id
  SELECT id INTO v_round_id FROM rounds WHERE round_number = 1 ORDER BY created_at DESC LIMIT 1;

  -- Criar perfil do convidado Gabriel
  INSERT INTO profiles (id, nickname, name, is_guest, is_player, level)
  VALUES (gen_random_uuid(), 'Gabriel', 'Gabriel (Convidado)', true, false, 'iniciante')
  RETURNING id INTO v_gabriel_id;

  -- Adicionar Gabriel ao time Azul (se Ronan era do Azul) ou ao time apropriado
  INSERT INTO round_team_players (round_id, player_id, team_color)
  VALUES (v_round_id, v_gabriel_id, 'azul');

  RAISE NOTICE 'Gabriel criado com ID: %', v_gabriel_id;
END $$;

-- =============================================
-- PASSO 2: REGISTRAR AUSÊNCIAS
-- =============================================

DO $$
DECLARE
  v_round_id UUID;
  v_ronan_id UUID;
  v_thayson_id UUID;
BEGIN
  SELECT id INTO v_round_id FROM rounds WHERE round_number = 1 ORDER BY created_at DESC LIMIT 1;
  SELECT id INTO v_ronan_id FROM profiles WHERE nickname ILIKE 'Ronan' LIMIT 1;
  SELECT id INTO v_thayson_id FROM profiles WHERE nickname ILIKE 'Thayson' LIMIT 1;

  -- Registrar ausência do Ronan
  IF v_ronan_id IS NOT NULL THEN
    INSERT INTO round_absences (round_id, player_id, original_team_color, status)
    VALUES (v_round_id, v_ronan_id, 'azul', 'falta')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Registrar ausência do Thayson  
  IF v_thayson_id IS NOT NULL THEN
    INSERT INTO round_absences (round_id, player_id, original_team_color, status)
    VALUES (v_round_id, v_thayson_id, 'azul', 'falta')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- =============================================
-- PASSO 3: INSERIR GOLS E ASSISTÊNCIAS
-- =============================================

-- ============ JOGO 1: Azul 1 x 4 Branco ============
DO $$
DECLARE
  v_match_id UUID;
  v_goal_id UUID;
  -- Player IDs
  p_lucato UUID; p_luciano UUID; p_beto UUID; p_sidao UUID; p_pedro UUID;
BEGIN
  SELECT id INTO v_match_id FROM matches m 
  JOIN rounds r ON m.round_id = r.id 
  WHERE r.round_number = 1 AND m.match_number = 1;

  SELECT id INTO p_lucato FROM profiles WHERE nickname ILIKE 'Lucato' LIMIT 1;
  SELECT id INTO p_luciano FROM profiles WHERE nickname ILIKE 'Luciano' LIMIT 1;
  SELECT id INTO p_beto FROM profiles WHERE nickname ILIKE 'Beto' LIMIT 1;
  SELECT id INTO p_sidao FROM profiles WHERE nickname ILIKE 'Sidao' LIMIT 1;
  SELECT id INTO p_pedro FROM profiles WHERE nickname ILIKE 'Pedro' LIMIT 1;

  -- Lucato 5' (Azul)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_lucato, 'azul', 5, false);

  -- Gol Contra Luciano 4' (Luciano do Azul faz gol contra = ponto Branco)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_luciano, 'azul', 4, true);

  -- Beto 6' (Branco)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_beto, 'branco', 6, false);

  -- Beto 8' (Branco) com assist Sidao
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_beto, 'branco', 8, false) RETURNING id INTO v_goal_id;
  INSERT INTO assists (goal_id, player_id) VALUES (v_goal_id, p_sidao);

  -- Sidao 9' (Branco) com assist Pedro
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_sidao, 'branco', 9, false) RETURNING id INTO v_goal_id;
  INSERT INTO assists (goal_id, player_id) VALUES (v_goal_id, p_pedro);

  -- Atualizar placar
  PERFORM recalc_match_score(v_match_id);
  
  RAISE NOTICE 'Jogo 1 inserido - Azul 1 x 4 Branco';
END $$;

-- ============ JOGO 2: Preto 2 x 7 Azul ============
DO $$
DECLARE
  v_match_id UUID;
  v_goal_id UUID;
  -- Player IDs
  p_heverton UUID; p_andre UUID; p_edu UUID; p_gabriel UUID; p_lucato UUID;
  p_luciano UUID; p_fabiano UUID; p_lucao UUID; p_gabigol UUID;
BEGIN
  SELECT id INTO v_match_id FROM matches m 
  JOIN rounds r ON m.round_id = r.id 
  WHERE r.round_number = 1 AND m.match_number = 2;

  SELECT id INTO p_heverton FROM profiles WHERE nickname ILIKE 'Heverton' LIMIT 1;
  SELECT id INTO p_andre FROM profiles WHERE nickname ILIKE 'André' OR nickname ILIKE 'Andre' LIMIT 1;
  SELECT id INTO p_edu FROM profiles WHERE nickname ILIKE 'Edu' LIMIT 1;
  SELECT id INTO p_gabriel FROM profiles WHERE nickname ILIKE 'Gabriel' AND is_guest = true LIMIT 1;
  SELECT id INTO p_lucato FROM profiles WHERE nickname ILIKE 'Lucato' LIMIT 1;
  SELECT id INTO p_luciano FROM profiles WHERE nickname ILIKE 'Luciano' LIMIT 1;
  SELECT id INTO p_fabiano FROM profiles WHERE nickname ILIKE 'Fabiano' LIMIT 1;
  SELECT id INTO p_lucao FROM profiles WHERE nickname ILIKE 'Lucao' LIMIT 1;
  SELECT id INTO p_gabigol FROM profiles WHERE nickname ILIKE 'Gabigol' LIMIT 1;

  -- PRETO (2 gols):
  -- Heverton (Preto)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_heverton, 'preto', 1, false);
  
  -- André (Preto)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_andre, 'preto', 2, false);

  -- AZUL (7 gols):
  -- Edu 1' (Azul)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_edu, 'azul', 1, false);

  -- Gabriel 2' (Azul) com assist Lucato [ALTERADO de Thayson para Gabriel]
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_gabriel, 'azul', 2, false) RETURNING id INTO v_goal_id;
  INSERT INTO assists (goal_id, player_id) VALUES (v_goal_id, p_lucato);

  -- Lucato 2' (Azul)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_lucato, 'azul', 3, false);

  -- Gol Contra Luciano 10' (Luciano do Preto faz gol contra = ponto Azul)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_luciano, 'preto', 10, true);

  -- Gol Contra Fabiano 11' (Fabiano do Preto faz gol contra = ponto Azul)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_fabiano, 'preto', 11, true);

  -- Lucato 12' (Azul) com assist Lucao
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_lucato, 'azul', 12, false) RETURNING id INTO v_goal_id;
  INSERT INTO assists (goal_id, player_id) VALUES (v_goal_id, p_lucao);

  -- Lucato 12' (Azul) com assist Gabigol
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_lucato, 'azul', 12, false) RETURNING id INTO v_goal_id;
  INSERT INTO assists (goal_id, player_id) VALUES (v_goal_id, p_gabigol);

  -- Atualizar placar
  PERFORM recalc_match_score(v_match_id);
  
  RAISE NOTICE 'Jogo 2 inserido - Preto 2 x 7 Azul';
END $$;

-- ============ JOGO 3: Laranja 5 x 1 Preto ============
DO $$
DECLARE
  v_match_id UUID;
  v_goal_id UUID;
  -- Player IDs
  p_luizinho UUID; p_lukinha UUID; p_vitor UUID; p_heverton UUID;
BEGIN
  SELECT id INTO v_match_id FROM matches m 
  JOIN rounds r ON m.round_id = r.id 
  WHERE r.round_number = 1 AND m.match_number = 3;

  SELECT id INTO p_luizinho FROM profiles WHERE nickname ILIKE 'Luizinho' LIMIT 1;
  SELECT id INTO p_lukinha FROM profiles WHERE nickname ILIKE 'Lukinha' LIMIT 1;
  SELECT id INTO p_vitor FROM profiles WHERE nickname ILIKE 'Vitor' LIMIT 1;
  SELECT id INTO p_heverton FROM profiles WHERE nickname ILIKE 'Heverton' LIMIT 1;

  -- LARANJA (5 gols):
  -- Luizinho 1' (Laranja)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_luizinho, 'laranja', 1, false);

  -- Lukinha 3' (Laranja)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_lukinha, 'laranja', 3, false);

  -- Vitor 7' (Laranja) com assist Luizinho
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_vitor, 'laranja', 7, false) RETURNING id INTO v_goal_id;
  INSERT INTO assists (goal_id, player_id) VALUES (v_goal_id, p_luizinho);

  -- Luizinho 9' (Laranja)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_luizinho, 'laranja', 9, false);

  -- Lukinha 9' (Laranja) com assist Luizinho
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_lukinha, 'laranja', 9, false) RETURNING id INTO v_goal_id;
  INSERT INTO assists (goal_id, player_id) VALUES (v_goal_id, p_luizinho);

  -- PRETO (1 gol):
  -- Heverton (Preto)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_heverton, 'preto', 5, false);

  -- Atualizar placar
  PERFORM recalc_match_score(v_match_id);
  
  RAISE NOTICE 'Jogo 3 inserido - Laranja 5 x 1 Preto';
END $$;

-- ============ JOGO 4: Branco 4 x 1 Laranja ============
DO $$
DECLARE
  v_match_id UUID;
  v_goal_id UUID;
  -- Player IDs
  p_bruno UUID; p_pedro UUID; p_beto UUID; p_sidao UUID; p_lukinha UUID; p_luizinho UUID;
BEGIN
  SELECT id INTO v_match_id FROM matches m 
  JOIN rounds r ON m.round_id = r.id 
  WHERE r.round_number = 1 AND m.match_number = 4;

  SELECT id INTO p_bruno FROM profiles WHERE nickname ILIKE 'Bruno' LIMIT 1;
  SELECT id INTO p_pedro FROM profiles WHERE nickname ILIKE 'Pedro' LIMIT 1;
  SELECT id INTO p_beto FROM profiles WHERE nickname ILIKE 'Beto' LIMIT 1;
  SELECT id INTO p_sidao FROM profiles WHERE nickname ILIKE 'Sidao' LIMIT 1;
  SELECT id INTO p_lukinha FROM profiles WHERE nickname ILIKE 'Lukinha' LIMIT 1;
  SELECT id INTO p_luizinho FROM profiles WHERE nickname ILIKE 'Luizinho' LIMIT 1;

  -- BRANCO (4 gols):
  -- Bruno 2' (Branco)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_bruno, 'branco', 2, false);

  -- Pedro 8' (Branco) com assist Beto
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_pedro, 'branco', 8, false) RETURNING id INTO v_goal_id;
  INSERT INTO assists (goal_id, player_id) VALUES (v_goal_id, p_beto);

  -- Sidao 11' (Branco) com assist Beto
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_sidao, 'branco', 11, false) RETURNING id INTO v_goal_id;
  INSERT INTO assists (goal_id, player_id) VALUES (v_goal_id, p_beto);

  -- Pedro 12' (Branco) com assist Sidao
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_pedro, 'branco', 12, false) RETURNING id INTO v_goal_id;
  INSERT INTO assists (goal_id, player_id) VALUES (v_goal_id, p_sidao);

  -- LARANJA (1 gol):
  -- Lukinha 1' (Laranja) com assist Luizinho
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_lukinha, 'laranja', 1, false) RETURNING id INTO v_goal_id;
  INSERT INTO assists (goal_id, player_id) VALUES (v_goal_id, p_luizinho);

  -- Atualizar placar
  PERFORM recalc_match_score(v_match_id);
  
  RAISE NOTICE 'Jogo 4 inserido - Branco 4 x 1 Laranja';
END $$;

-- ============ JOGO 5: Azul 2 x 2 Branco ============
DO $$
DECLARE
  v_match_id UUID;
  v_goal_id UUID;
  -- Player IDs
  p_lucato UUID; p_sidao UUID; p_carvalho UUID; p_pedro UUID;
BEGIN
  SELECT id INTO v_match_id FROM matches m 
  JOIN rounds r ON m.round_id = r.id 
  WHERE r.round_number = 1 AND m.match_number = 5;

  SELECT id INTO p_lucato FROM profiles WHERE nickname ILIKE 'Lucato' LIMIT 1;
  SELECT id INTO p_sidao FROM profiles WHERE nickname ILIKE 'Sidao' LIMIT 1;
  SELECT id INTO p_carvalho FROM profiles WHERE nickname ILIKE 'Carvalho' LIMIT 1;
  SELECT id INTO p_pedro FROM profiles WHERE nickname ILIKE 'Pedro' LIMIT 1;

  -- AZUL (2 gols):
  -- Lucato 2' (Azul)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_lucato, 'azul', 2, false);

  -- Lucato 6' (Azul)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_lucato, 'azul', 6, false);

  -- BRANCO (2 gols):
  -- Sidao 6' (Branco) com assist Carvalho
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_sidao, 'branco', 6, false) RETURNING id INTO v_goal_id;
  INSERT INTO assists (goal_id, player_id) VALUES (v_goal_id, p_carvalho);

  -- Pedro 7' (Branco)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_pedro, 'branco', 7, false);

  -- Atualizar placar
  PERFORM recalc_match_score(v_match_id);
  
  RAISE NOTICE 'Jogo 5 inserido - Azul 2 x 2 Branco';
END $$;

-- ============ JOGO 6: Preto 1 x 6 Laranja ============
DO $$
DECLARE
  v_match_id UUID;
  v_goal_id UUID;
  -- Player IDs
  p_andre UUID; p_luizinho UUID; p_marcio UUID; p_vitor UUID; p_lukinha UUID;
BEGIN
  SELECT id INTO v_match_id FROM matches m 
  JOIN rounds r ON m.round_id = r.id 
  WHERE r.round_number = 1 AND m.match_number = 6;

  SELECT id INTO p_andre FROM profiles WHERE nickname ILIKE 'André' OR nickname ILIKE 'Andre' LIMIT 1;
  SELECT id INTO p_luizinho FROM profiles WHERE nickname ILIKE 'Luizinho' LIMIT 1;
  SELECT id INTO p_marcio FROM profiles WHERE nickname ILIKE 'Marcio' LIMIT 1;
  SELECT id INTO p_vitor FROM profiles WHERE nickname ILIKE 'Vitor' LIMIT 1;
  SELECT id INTO p_lukinha FROM profiles WHERE nickname ILIKE 'Lukinha' LIMIT 1;

  -- PRETO (1 gol):
  -- André (Preto)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_andre, 'preto', 1, false);

  -- LARANJA (6 gols):
  -- Luizinho 2' (Laranja)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_luizinho, 'laranja', 2, false);

  -- Marcio 2' (Laranja)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_marcio, 'laranja', 3, false);

  -- Luizinho 5' (Laranja)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_luizinho, 'laranja', 5, false);

  -- Vitor 9' (Laranja)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_vitor, 'laranja', 9, false);

  -- Lukinha 10' (Laranja)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_lukinha, 'laranja', 10, false);

  -- Marcio 11' (Laranja)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_marcio, 'laranja', 11, false);

  -- Atualizar placar
  PERFORM recalc_match_score(v_match_id);
  
  RAISE NOTICE 'Jogo 6 inserido - Preto 1 x 6 Laranja';
END $$;

-- ============ JOGO 7: Branco 4 x 3 Preto ============
DO $$
DECLARE
  v_match_id UUID;
  v_goal_id UUID;
  -- Player IDs
  p_bruno UUID; p_sidao UUID; p_pedro UUID; p_heverton UUID; p_andre UUID; p_pensador UUID;
BEGIN
  SELECT id INTO v_match_id FROM matches m 
  JOIN rounds r ON m.round_id = r.id 
  WHERE r.round_number = 1 AND m.match_number = 7;

  SELECT id INTO p_bruno FROM profiles WHERE nickname ILIKE 'Bruno' LIMIT 1;
  SELECT id INTO p_sidao FROM profiles WHERE nickname ILIKE 'Sidao' LIMIT 1;
  SELECT id INTO p_pedro FROM profiles WHERE nickname ILIKE 'Pedro' LIMIT 1;
  SELECT id INTO p_heverton FROM profiles WHERE nickname ILIKE 'Heverton' LIMIT 1;
  SELECT id INTO p_andre FROM profiles WHERE nickname ILIKE 'André' OR nickname ILIKE 'Andre' LIMIT 1;
  SELECT id INTO p_pensador FROM profiles WHERE nickname ILIKE 'Pensador' LIMIT 1;

  -- BRANCO (4 gols):
  -- Bruno 7' (Branco)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_bruno, 'branco', 7, false);

  -- Sidao 8' (Branco)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_sidao, 'branco', 8, false);

  -- Sidao 10' (Branco)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_sidao, 'branco', 10, false);

  -- Pedro 12' (Branco)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_pedro, 'branco', 12, false);

  -- PRETO (3 gols):
  -- Heverton (Preto)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_heverton, 'preto', 1, false);

  -- André (Preto)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_andre, 'preto', 2, false);

  -- Heverton (Preto) com assist Pensador
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_heverton, 'preto', 3, false) RETURNING id INTO v_goal_id;
  INSERT INTO assists (goal_id, player_id) VALUES (v_goal_id, p_pensador);

  -- Atualizar placar
  PERFORM recalc_match_score(v_match_id);
  
  RAISE NOTICE 'Jogo 7 inserido - Branco 4 x 3 Preto';
END $$;

-- ============ JOGO 8: Laranja 6 x 3 Azul ============
DO $$
DECLARE
  v_match_id UUID;
  v_goal_id UUID;
  -- Player IDs
  p_luizinho UUID; p_lukinha UUID; p_vitor UUID; p_palmeiras UUID;
  p_edu UUID; p_lucato UUID; p_gabigol UUID;
BEGIN
  SELECT id INTO v_match_id FROM matches m 
  JOIN rounds r ON m.round_id = r.id 
  WHERE r.round_number = 1 AND m.match_number = 8;

  SELECT id INTO p_luizinho FROM profiles WHERE nickname ILIKE 'Luizinho' LIMIT 1;
  SELECT id INTO p_lukinha FROM profiles WHERE nickname ILIKE 'Lukinha' LIMIT 1;
  SELECT id INTO p_vitor FROM profiles WHERE nickname ILIKE 'Vitor' LIMIT 1;
  SELECT id INTO p_palmeiras FROM profiles WHERE nickname ILIKE 'Palmeiras' LIMIT 1;
  SELECT id INTO p_edu FROM profiles WHERE nickname ILIKE 'Edu' LIMIT 1;
  SELECT id INTO p_lucato FROM profiles WHERE nickname ILIKE 'Lucato' LIMIT 1;
  SELECT id INTO p_gabigol FROM profiles WHERE nickname ILIKE 'Gabigol' LIMIT 1;

  -- LARANJA (6 gols):
  -- Luizinho 1' (Laranja) com assist Lukinha
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_luizinho, 'laranja', 1, false) RETURNING id INTO v_goal_id;
  INSERT INTO assists (goal_id, player_id) VALUES (v_goal_id, p_lukinha);

  -- Lukinha 2' (Laranja) com assist Vitor
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_lukinha, 'laranja', 2, false) RETURNING id INTO v_goal_id;
  INSERT INTO assists (goal_id, player_id) VALUES (v_goal_id, p_vitor);

  -- Lukinha 6' (Laranja) com assist Luizinho
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_lukinha, 'laranja', 6, false) RETURNING id INTO v_goal_id;
  INSERT INTO assists (goal_id, player_id) VALUES (v_goal_id, p_luizinho);

  -- Luizinho 9' (Laranja)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_luizinho, 'laranja', 9, false);

  -- Palmeiras 10' (Laranja)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_palmeiras, 'laranja', 10, false);

  -- Vitor 10' (Laranja) com assist Luizinho
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_vitor, 'laranja', 10, false) RETURNING id INTO v_goal_id;
  INSERT INTO assists (goal_id, player_id) VALUES (v_goal_id, p_luizinho);

  -- AZUL (3 gols):
  -- Edu 4' (Azul)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_edu, 'azul', 4, false);

  -- Lucato 6' (Azul)
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_lucato, 'azul', 6, false);

  -- Gabigol 9' (Azul) com assist Edu
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES (v_match_id, p_gabigol, 'azul', 9, false) RETURNING id INTO v_goal_id;
  INSERT INTO assists (goal_id, player_id) VALUES (v_goal_id, p_edu);

  -- Atualizar placar
  PERFORM recalc_match_score(v_match_id);
  
  RAISE NOTICE 'Jogo 8 inserido - Laranja 6 x 3 Azul';
END $$;

-- =============================================
-- PASSO 4: FINALIZAR TODAS AS PARTIDAS E A RODADA
-- =============================================

DO $$
DECLARE
  v_round_id UUID;
BEGIN
  SELECT id INTO v_round_id FROM rounds WHERE round_number = 1 ORDER BY created_at DESC LIMIT 1;

  -- Encerrar todas as partidas
  UPDATE matches
  SET status = 'finished',
      finished_at = NOW()
  WHERE round_id = v_round_id AND status != 'finished';

  -- Recalcular estatísticas da rodada
  PERFORM recalc_round_aggregates(v_round_id);
  
  -- Recalcular rankings dos jogadores
  PERFORM recalc_all_player_rankings();

  -- Finalizar a rodada
  UPDATE rounds
  SET status = 'finalizada',
      completed_at = NOW()
  WHERE id = v_round_id;

  RAISE NOTICE 'Rodada 1 finalizada com sucesso!';
END $$;

-- =============================================
-- VERIFICAÇÃO FINAL
-- =============================================
/*
-- Execute para verificar os resultados:

SELECT 
  m.match_number as "Jogo",
  m.team_home as "Casa",
  m.score_home as "Gols Casa",
  m.team_away as "Fora", 
  m.score_away as "Gols Fora",
  m.status
FROM matches m
JOIN rounds r ON m.round_id = r.id
WHERE r.round_number = 1
ORDER BY m.match_number;

-- Verificar gols por partida:
SELECT 
  m.match_number,
  g.team_color,
  p.nickname,
  g.minute,
  g.is_own_goal,
  ap.nickname as assist
FROM goals g
JOIN matches m ON g.match_id = m.id
JOIN rounds r ON m.round_id = r.id
LEFT JOIN profiles p ON g.player_id = p.id
LEFT JOIN assists a ON a.goal_id = g.id
LEFT JOIN profiles ap ON a.player_id = ap.id
WHERE r.round_number = 1
ORDER BY m.match_number, g.minute;
*/
