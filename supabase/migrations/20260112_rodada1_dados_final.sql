-- =============================================
-- SCRIPT FINAL: RODADA 1 - INSERÇÃO COMPLETA
-- Execute este script no Supabase SQL Editor
-- =============================================

-- IDs de Referência:
-- Round ID: 1a9ebe1c-87b7-4ad2-9771-f3a3265ff6ea
-- 
-- Match IDs:
-- Jogo 1: 28d5c4f4-a6d8-403d-8dac-2f1de945e0ca (Azul x Branco)
-- Jogo 2: ae3138f1-3454-4e7a-9490-7bdf40f39d5f (Preto x Azul)
-- Jogo 3: 6af5ce31-1f68-44a4-9aed-73066cf51614 (Laranja x Preto)
-- Jogo 4: f2e07d25-7645-40f7-8ddc-098c7d0887cf (Branco x Laranja)
-- Jogo 5: e8f0ff20-93dc-4e4a-a714-e87f8311a494 (Azul x Branco)
-- Jogo 6: ffdd6501-5048-4679-bb22-e517d088b94d (Preto x Laranja)
-- Jogo 7: 718c92a2-21a8-42e6-b47a-f7180154ce98 (Branco x Preto)
-- Jogo 8: 57e0b651-e3bb-411b-a3de-ae5bdf8ecde3 (Laranja x Azul)

-- =============================================
-- PASSO 1: CRIAR CONVIDADO "GABRIEL"
-- =============================================

INSERT INTO profiles (id, nickname, name, is_guest, is_player, level)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Gabriel',
  'Gabriel (Convidado)',
  true,
  false,
  'iniciante'
);

-- Adicionar Gabriel ao time Azul
INSERT INTO round_team_players (round_id, player_id, team_color)
VALUES (
  '1a9ebe1c-87b7-4ad2-9771-f3a3265ff6ea',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'azul'
);

-- =============================================
-- PASSO 2: REGISTRAR AUSÊNCIAS
-- =============================================

-- Ausência do Ronan
INSERT INTO round_absences (round_id, player_id, original_team_color, status)
VALUES (
  '1a9ebe1c-87b7-4ad2-9771-f3a3265ff6ea',
  'b5ff2ccb-1372-4a87-b425-b094818319b0', -- Ronan
  'azul',
  'falta'
) ON CONFLICT DO NOTHING;

-- Ausência do Thayson
INSERT INTO round_absences (round_id, player_id, original_team_color, status)
VALUES (
  '1a9ebe1c-87b7-4ad2-9771-f3a3265ff6ea',
  'eafa5227-dbe2-4988-94f0-c82a6e74581f', -- Thayson
  'azul',
  'falta'
) ON CONFLICT DO NOTHING;

-- =============================================
-- JOGO 1: Azul 1 x 4 Branco
-- Match ID: 28d5c4f4-a6d8-403d-8dac-2f1de945e0ca
-- =============================================

-- Gol Contra Luciano 4' (Luciano do Azul faz gol contra = ponto Branco)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('28d5c4f4-a6d8-403d-8dac-2f1de945e0ca', '863c1418-e6ce-4c67-8436-d44e7f856ae6', 'azul', 4, true);

-- Lucato 5' (Azul)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('28d5c4f4-a6d8-403d-8dac-2f1de945e0ca', '49651798-83b9-4a7f-9134-8a43cd866d67', 'azul', 5, false);

-- Beto 6' (Branco)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('28d5c4f4-a6d8-403d-8dac-2f1de945e0ca', 'c59443d4-2139-4971-abf2-849ac611c5b5', 'branco', 6, false);

-- Beto 8' (Branco) com assist Sidao
WITH new_goal AS (
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES ('28d5c4f4-a6d8-403d-8dac-2f1de945e0ca', 'c59443d4-2139-4971-abf2-849ac611c5b5', 'branco', 8, false)
  RETURNING id
)
INSERT INTO assists (goal_id, player_id)
SELECT id, '22fc8e7c-a5d4-4ddd-82f0-48fcac5f9168' FROM new_goal;

-- Sidao 9' (Branco) com assist Pedro
WITH new_goal AS (
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES ('28d5c4f4-a6d8-403d-8dac-2f1de945e0ca', '22fc8e7c-a5d4-4ddd-82f0-48fcac5f9168', 'branco', 9, false)
  RETURNING id
)
INSERT INTO assists (goal_id, player_id)
SELECT id, 'a249329a-357b-4e77-a503-43f805d8fdf1' FROM new_goal;

-- =============================================
-- JOGO 2: Preto 2 x 7 Azul
-- Match ID: ae3138f1-3454-4e7a-9490-7bdf40f39d5f
-- =============================================

-- PRETO (2 gols):
-- Heverton 1' (Preto)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('ae3138f1-3454-4e7a-9490-7bdf40f39d5f', 'c426c775-0103-4668-84b8-388cfb5c84dd', 'preto', 1, false);

-- André 2' (Preto)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('ae3138f1-3454-4e7a-9490-7bdf40f39d5f', '052dbd77-f37b-4f5b-8fb5-a00f447530a6', 'preto', 2, false);

-- AZUL (7 gols):
-- Edu 1' (Azul)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('ae3138f1-3454-4e7a-9490-7bdf40f39d5f', '85c5884d-9a59-4925-bb60-bfd5b4355ae8', 'azul', 3, false);

-- Gabriel 2' (Azul) com assist Lucato [ALTERADO de Thayson para Gabriel]
WITH new_goal AS (
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES ('ae3138f1-3454-4e7a-9490-7bdf40f39d5f', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'azul', 4, false)
  RETURNING id
)
INSERT INTO assists (goal_id, player_id)
SELECT id, '49651798-83b9-4a7f-9134-8a43cd866d67' FROM new_goal;

-- Lucato 2' (Azul)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('ae3138f1-3454-4e7a-9490-7bdf40f39d5f', '49651798-83b9-4a7f-9134-8a43cd866d67', 'azul', 5, false);

-- Gol Contra Luciano 10' (Luciano do Preto faz gol contra = ponto Azul)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('ae3138f1-3454-4e7a-9490-7bdf40f39d5f', '863c1418-e6ce-4c67-8436-d44e7f856ae6', 'preto', 10, true);

-- Gol Contra Fabiano 11' (Fabiano do Preto faz gol contra = ponto Azul)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('ae3138f1-3454-4e7a-9490-7bdf40f39d5f', '39ea869a-d2fe-4812-b0a1-a6ca9a34bcd1', 'preto', 11, true);

-- Lucato 12' (Azul) com assist Lucao
WITH new_goal AS (
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES ('ae3138f1-3454-4e7a-9490-7bdf40f39d5f', '49651798-83b9-4a7f-9134-8a43cd866d67', 'azul', 12, false)
  RETURNING id
)
INSERT INTO assists (goal_id, player_id)
SELECT id, '6f7c2683-1723-4c3e-9ade-4ab8771bbce8' FROM new_goal;

-- Lucato 12' (Azul) com assist Gabigol
WITH new_goal AS (
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES ('ae3138f1-3454-4e7a-9490-7bdf40f39d5f', '49651798-83b9-4a7f-9134-8a43cd866d67', 'azul', 12, false)
  RETURNING id
)
INSERT INTO assists (goal_id, player_id)
SELECT id, '77088ce1-7396-4db2-9dcf-f4d4af3eb04e' FROM new_goal;

-- =============================================
-- JOGO 3: Laranja 5 x 1 Preto
-- Match ID: 6af5ce31-1f68-44a4-9aed-73066cf51614
-- =============================================

-- LARANJA (5 gols):
-- Luizinho 1' (Laranja)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('6af5ce31-1f68-44a4-9aed-73066cf51614', '6b3f0712-38a6-4fc1-8085-6b6d05370100', 'laranja', 1, false);

-- Lukinha 3' (Laranja)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('6af5ce31-1f68-44a4-9aed-73066cf51614', 'bdadb07c-4f76-45ae-8687-af376cff1ae3', 'laranja', 3, false);

-- Vitor 7' (Laranja) com assist Luizinho
WITH new_goal AS (
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES ('6af5ce31-1f68-44a4-9aed-73066cf51614', '0da5a415-95ce-4e00-aee0-1bfb23b65c73', 'laranja', 7, false)
  RETURNING id
)
INSERT INTO assists (goal_id, player_id)
SELECT id, '6b3f0712-38a6-4fc1-8085-6b6d05370100' FROM new_goal;

-- Luizinho 9' (Laranja)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('6af5ce31-1f68-44a4-9aed-73066cf51614', '6b3f0712-38a6-4fc1-8085-6b6d05370100', 'laranja', 9, false);

-- Lukinha 9' (Laranja) com assist Luizinho
WITH new_goal AS (
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES ('6af5ce31-1f68-44a4-9aed-73066cf51614', 'bdadb07c-4f76-45ae-8687-af376cff1ae3', 'laranja', 10, false)
  RETURNING id
)
INSERT INTO assists (goal_id, player_id)
SELECT id, '6b3f0712-38a6-4fc1-8085-6b6d05370100' FROM new_goal;

-- PRETO (1 gol):
-- Heverton 5' (Preto)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('6af5ce31-1f68-44a4-9aed-73066cf51614', 'c426c775-0103-4668-84b8-388cfb5c84dd', 'preto', 5, false);

-- =============================================
-- JOGO 4: Branco 4 x 1 Laranja
-- Match ID: f2e07d25-7645-40f7-8ddc-098c7d0887cf
-- =============================================

-- LARANJA (1 gol):
-- Lukinha 1' (Laranja) com assist Luizinho
WITH new_goal AS (
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES ('f2e07d25-7645-40f7-8ddc-098c7d0887cf', 'bdadb07c-4f76-45ae-8687-af376cff1ae3', 'laranja', 1, false)
  RETURNING id
)
INSERT INTO assists (goal_id, player_id)
SELECT id, '6b3f0712-38a6-4fc1-8085-6b6d05370100' FROM new_goal;

-- BRANCO (4 gols):
-- Bruno 2' (Branco)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('f2e07d25-7645-40f7-8ddc-098c7d0887cf', '159b6365-91d1-420d-9378-3e1910aa8ea0', 'branco', 2, false);

-- Pedro 8' (Branco) com assist Beto
WITH new_goal AS (
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES ('f2e07d25-7645-40f7-8ddc-098c7d0887cf', 'a249329a-357b-4e77-a503-43f805d8fdf1', 'branco', 8, false)
  RETURNING id
)
INSERT INTO assists (goal_id, player_id)
SELECT id, 'c59443d4-2139-4971-abf2-849ac611c5b5' FROM new_goal;

-- Sidao 11' (Branco) com assist Beto
WITH new_goal AS (
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES ('f2e07d25-7645-40f7-8ddc-098c7d0887cf', '22fc8e7c-a5d4-4ddd-82f0-48fcac5f9168', 'branco', 11, false)
  RETURNING id
)
INSERT INTO assists (goal_id, player_id)
SELECT id, 'c59443d4-2139-4971-abf2-849ac611c5b5' FROM new_goal;

-- Pedro 12' (Branco) com assist Sidao
WITH new_goal AS (
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES ('f2e07d25-7645-40f7-8ddc-098c7d0887cf', 'a249329a-357b-4e77-a503-43f805d8fdf1', 'branco', 12, false)
  RETURNING id
)
INSERT INTO assists (goal_id, player_id)
SELECT id, '22fc8e7c-a5d4-4ddd-82f0-48fcac5f9168' FROM new_goal;

-- =============================================
-- JOGO 5: Azul 2 x 2 Branco
-- Match ID: e8f0ff20-93dc-4e4a-a714-e87f8311a494
-- =============================================

-- AZUL (2 gols):
-- Lucato 2' (Azul)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('e8f0ff20-93dc-4e4a-a714-e87f8311a494', '49651798-83b9-4a7f-9134-8a43cd866d67', 'azul', 2, false);

-- Lucato 6' (Azul)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('e8f0ff20-93dc-4e4a-a714-e87f8311a494', '49651798-83b9-4a7f-9134-8a43cd866d67', 'azul', 6, false);

-- BRANCO (2 gols):
-- Sidao 6' (Branco) com assist Carvalho
WITH new_goal AS (
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES ('e8f0ff20-93dc-4e4a-a714-e87f8311a494', '22fc8e7c-a5d4-4ddd-82f0-48fcac5f9168', 'branco', 7, false)
  RETURNING id
)
INSERT INTO assists (goal_id, player_id)
SELECT id, '63c83094-16a3-4d7f-bcbc-1aa6b41effb3' FROM new_goal;

-- Pedro 7' (Branco)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('e8f0ff20-93dc-4e4a-a714-e87f8311a494', 'a249329a-357b-4e77-a503-43f805d8fdf1', 'branco', 8, false);

-- =============================================
-- JOGO 6: Preto 1 x 6 Laranja
-- Match ID: ffdd6501-5048-4679-bb22-e517d088b94d
-- =============================================

-- PRETO (1 gol):
-- André 1' (Preto)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('ffdd6501-5048-4679-bb22-e517d088b94d', '052dbd77-f37b-4f5b-8fb5-a00f447530a6', 'preto', 1, false);

-- LARANJA (6 gols):
-- Luizinho 2' (Laranja)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('ffdd6501-5048-4679-bb22-e517d088b94d', '6b3f0712-38a6-4fc1-8085-6b6d05370100', 'laranja', 2, false);

-- Marcio 2' (Laranja)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('ffdd6501-5048-4679-bb22-e517d088b94d', '74d0fabe-5220-4a66-aee5-6b96be76d040', 'laranja', 3, false);

-- Luizinho 5' (Laranja)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('ffdd6501-5048-4679-bb22-e517d088b94d', '6b3f0712-38a6-4fc1-8085-6b6d05370100', 'laranja', 5, false);

-- Vitor 9' (Laranja)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('ffdd6501-5048-4679-bb22-e517d088b94d', '0da5a415-95ce-4e00-aee0-1bfb23b65c73', 'laranja', 9, false);

-- Lukinha 10' (Laranja)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('ffdd6501-5048-4679-bb22-e517d088b94d', 'bdadb07c-4f76-45ae-8687-af376cff1ae3', 'laranja', 10, false);

-- Marcio 11' (Laranja)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('ffdd6501-5048-4679-bb22-e517d088b94d', '74d0fabe-5220-4a66-aee5-6b96be76d040', 'laranja', 11, false);

-- =============================================
-- JOGO 7: Branco 4 x 3 Preto
-- Match ID: 718c92a2-21a8-42e6-b47a-f7180154ce98
-- =============================================

-- PRETO (3 gols):
-- Heverton 1' (Preto)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('718c92a2-21a8-42e6-b47a-f7180154ce98', 'c426c775-0103-4668-84b8-388cfb5c84dd', 'preto', 1, false);

-- André 2' (Preto)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('718c92a2-21a8-42e6-b47a-f7180154ce98', '052dbd77-f37b-4f5b-8fb5-a00f447530a6', 'preto', 2, false);

-- Heverton 3' (Preto) com assist Pensador
WITH new_goal AS (
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES ('718c92a2-21a8-42e6-b47a-f7180154ce98', 'c426c775-0103-4668-84b8-388cfb5c84dd', 'preto', 3, false)
  RETURNING id
)
INSERT INTO assists (goal_id, player_id)
SELECT id, 'd7198423-a532-4884-9476-001589a4acfe' FROM new_goal;

-- BRANCO (4 gols):
-- Bruno 7' (Branco)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('718c92a2-21a8-42e6-b47a-f7180154ce98', '159b6365-91d1-420d-9378-3e1910aa8ea0', 'branco', 7, false);

-- Sidao 8' (Branco)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('718c92a2-21a8-42e6-b47a-f7180154ce98', '22fc8e7c-a5d4-4ddd-82f0-48fcac5f9168', 'branco', 8, false);

-- Sidao 10' (Branco)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('718c92a2-21a8-42e6-b47a-f7180154ce98', '22fc8e7c-a5d4-4ddd-82f0-48fcac5f9168', 'branco', 10, false);

-- Pedro 12' (Branco)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('718c92a2-21a8-42e6-b47a-f7180154ce98', 'a249329a-357b-4e77-a503-43f805d8fdf1', 'branco', 12, false);

-- =============================================
-- JOGO 8: Laranja 6 x 3 Azul
-- Match ID: 57e0b651-e3bb-411b-a3de-ae5bdf8ecde3
-- =============================================

-- LARANJA (6 gols):
-- Luizinho 1' (Laranja) com assist Lukinha
WITH new_goal AS (
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES ('57e0b651-e3bb-411b-a3de-ae5bdf8ecde3', '6b3f0712-38a6-4fc1-8085-6b6d05370100', 'laranja', 1, false)
  RETURNING id
)
INSERT INTO assists (goal_id, player_id)
SELECT id, 'bdadb07c-4f76-45ae-8687-af376cff1ae3' FROM new_goal;

-- Lukinha 2' (Laranja) com assist Vitor
WITH new_goal AS (
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES ('57e0b651-e3bb-411b-a3de-ae5bdf8ecde3', 'bdadb07c-4f76-45ae-8687-af376cff1ae3', 'laranja', 2, false)
  RETURNING id
)
INSERT INTO assists (goal_id, player_id)
SELECT id, '0da5a415-95ce-4e00-aee0-1bfb23b65c73' FROM new_goal;

-- Lukinha 6' (Laranja) com assist Luizinho
WITH new_goal AS (
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES ('57e0b651-e3bb-411b-a3de-ae5bdf8ecde3', 'bdadb07c-4f76-45ae-8687-af376cff1ae3', 'laranja', 7, false)
  RETURNING id
)
INSERT INTO assists (goal_id, player_id)
SELECT id, '6b3f0712-38a6-4fc1-8085-6b6d05370100' FROM new_goal;

-- Luizinho 9' (Laranja)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('57e0b651-e3bb-411b-a3de-ae5bdf8ecde3', '6b3f0712-38a6-4fc1-8085-6b6d05370100', 'laranja', 9, false);

-- Palmeiras 10' (Laranja)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('57e0b651-e3bb-411b-a3de-ae5bdf8ecde3', '02d3406e-3678-4176-b3c4-c63132314a86', 'laranja', 10, false);

-- Vitor 10' (Laranja) com assist Luizinho
WITH new_goal AS (
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES ('57e0b651-e3bb-411b-a3de-ae5bdf8ecde3', '0da5a415-95ce-4e00-aee0-1bfb23b65c73', 'laranja', 11, false)
  RETURNING id
)
INSERT INTO assists (goal_id, player_id)
SELECT id, '6b3f0712-38a6-4fc1-8085-6b6d05370100' FROM new_goal;

-- AZUL (3 gols):
-- Edu 4' (Azul)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('57e0b651-e3bb-411b-a3de-ae5bdf8ecde3', '85c5884d-9a59-4925-bb60-bfd5b4355ae8', 'azul', 4, false);

-- Lucato 6' (Azul)
INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
VALUES ('57e0b651-e3bb-411b-a3de-ae5bdf8ecde3', '49651798-83b9-4a7f-9134-8a43cd866d67', 'azul', 6, false);

-- Gabigol 9' (Azul) com assist Edu
WITH new_goal AS (
  INSERT INTO goals (match_id, player_id, team_color, minute, is_own_goal)
  VALUES ('57e0b651-e3bb-411b-a3de-ae5bdf8ecde3', '77088ce1-7396-4db2-9dcf-f4d4af3eb04e', 'azul', 8, false)
  RETURNING id
)
INSERT INTO assists (goal_id, player_id)
SELECT id, '85c5884d-9a59-4925-bb60-bfd5b4355ae8' FROM new_goal;

-- =============================================
-- PASSO 3: ATUALIZAR PLACARES E FINALIZAR
-- =============================================

-- Atualizar placares de todas as partidas
SELECT recalc_match_score('28d5c4f4-a6d8-403d-8dac-2f1de945e0ca'); -- Jogo 1
SELECT recalc_match_score('ae3138f1-3454-4e7a-9490-7bdf40f39d5f'); -- Jogo 2
SELECT recalc_match_score('6af5ce31-1f68-44a4-9aed-73066cf51614'); -- Jogo 3
SELECT recalc_match_score('f2e07d25-7645-40f7-8ddc-098c7d0887cf'); -- Jogo 4
SELECT recalc_match_score('e8f0ff20-93dc-4e4a-a714-e87f8311a494'); -- Jogo 5
SELECT recalc_match_score('ffdd6501-5048-4679-bb22-e517d088b94d'); -- Jogo 6
SELECT recalc_match_score('718c92a2-21a8-42e6-b47a-f7180154ce98'); -- Jogo 7
SELECT recalc_match_score('57e0b651-e3bb-411b-a3de-ae5bdf8ecde3'); -- Jogo 8

-- Encerrar todas as partidas
UPDATE matches
SET status = 'finished',
    finished_at = NOW(),
    started_at = NOW() - interval '12 minutes'
WHERE round_id = '1a9ebe1c-87b7-4ad2-9771-f3a3265ff6ea';

-- Recalcular estatísticas
SELECT recalc_round_aggregates('1a9ebe1c-87b7-4ad2-9771-f3a3265ff6ea');
SELECT recalc_all_player_rankings();

-- Finalizar a rodada
UPDATE rounds
SET status = 'finalizada',
    completed_at = NOW()
WHERE id = '1a9ebe1c-87b7-4ad2-9771-f3a3265ff6ea';

-- =============================================
-- VERIFICAÇÃO FINAL
-- =============================================

SELECT 
  m.match_number as "Jogo",
  m.team_home as "Casa",
  m.score_home as "Gols Casa",
  m.score_away as "Gols Fora",
  m.team_away as "Fora",
  m.status
FROM matches m
WHERE round_id = '1a9ebe1c-87b7-4ad2-9771-f3a3265ff6ea'
ORDER BY m.match_number;
