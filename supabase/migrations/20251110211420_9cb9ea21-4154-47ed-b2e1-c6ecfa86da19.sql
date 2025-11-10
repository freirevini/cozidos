-- FASE 2 e 5: Atualizar FKs para ON DELETE CASCADE e criar funções de exclusão

-- 2.1. Atualizar FK de goals para CASCADE
ALTER TABLE goals
  DROP CONSTRAINT IF EXISTS goals_player_id_fkey,
  ADD CONSTRAINT goals_player_id_fkey 
    FOREIGN KEY (player_id) 
    REFERENCES profiles(id) 
    ON DELETE CASCADE;

-- 2.2. Atualizar FK de assists para CASCADE
ALTER TABLE assists
  DROP CONSTRAINT IF EXISTS assists_player_id_fkey,
  ADD CONSTRAINT assists_player_id_fkey 
    FOREIGN KEY (player_id) 
    REFERENCES profiles(id) 
    ON DELETE CASCADE;

-- 2.3. Atualizar FK de cards para CASCADE
ALTER TABLE cards
  DROP CONSTRAINT IF EXISTS cards_player_id_fkey,
  ADD CONSTRAINT cards_player_id_fkey 
    FOREIGN KEY (player_id) 
    REFERENCES profiles(id) 
    ON DELETE CASCADE;

-- 2.4. Atualizar FK de punishments para CASCADE
ALTER TABLE punishments
  DROP CONSTRAINT IF EXISTS punishments_player_id_fkey,
  ADD CONSTRAINT punishments_player_id_fkey 
    FOREIGN KEY (player_id) 
    REFERENCES profiles(id) 
    ON DELETE CASCADE;

-- 2.5. Atualizar FK de player_round_stats para CASCADE
ALTER TABLE player_round_stats
  DROP CONSTRAINT IF EXISTS player_round_stats_player_id_fkey,
  ADD CONSTRAINT player_round_stats_player_id_fkey 
    FOREIGN KEY (player_id) 
    REFERENCES profiles(id) 
    ON DELETE CASCADE;

-- 2.6. Atualizar FK de player_attendance para CASCADE
ALTER TABLE player_attendance
  DROP CONSTRAINT IF EXISTS player_attendance_player_id_fkey,
  ADD CONSTRAINT player_attendance_player_id_fkey 
    FOREIGN KEY (player_id) 
    REFERENCES profiles(id) 
    ON DELETE CASCADE;

-- 2.7. Atualizar FK de round_team_players para CASCADE
ALTER TABLE round_team_players
  DROP CONSTRAINT IF EXISTS round_team_players_player_id_fkey,
  ADD CONSTRAINT round_team_players_player_id_fkey 
    FOREIGN KEY (player_id) 
    REFERENCES profiles(id) 
    ON DELETE CASCADE;

-- 2.8. Atualizar FK de player_rankings para CASCADE
ALTER TABLE player_rankings
  DROP CONSTRAINT IF EXISTS player_rankings_player_id_fkey,
  ADD CONSTRAINT player_rankings_player_id_fkey 
    FOREIGN KEY (player_id) 
    REFERENCES profiles(id) 
    ON DELETE CASCADE;

-- 2.9. Função para exclusão completa de jogador (retorna user_id para exclusão de auth)
CREATE OR REPLACE FUNCTION delete_player_complete(p_profile_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
BEGIN
  -- Verificar se é admin
  IF NOT is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  -- Buscar user_id e email
  SELECT user_id, email INTO v_user_id, v_email
  FROM profiles
  WHERE id = p_profile_id;

  IF v_email IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Perfil não encontrado');
  END IF;

  -- Deletar perfil (CASCADE remove tudo relacionado automaticamente)
  DELETE FROM profiles WHERE id = p_profile_id;

  RETURN json_build_object(
    'success', true, 
    'deleted_profile', true,
    'user_id', v_user_id,
    'message', 'Perfil e todos os dados relacionados foram removidos'
  );
END;
$$;