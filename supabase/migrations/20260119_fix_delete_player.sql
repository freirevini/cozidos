-- ============================================================
-- CORREÇÃO: Função delete_player_complete
-- Problema: Perfis sem email retornavam "não encontrado"
-- ============================================================

CREATE OR REPLACE FUNCTION delete_player_complete(p_profile_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_nickname text;
  v_profile_exists boolean;
BEGIN
  -- Verificar se é admin
  IF NOT is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado: apenas administradores');
  END IF;

  -- Verificar se perfil existe (não depende de email)
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = p_profile_id) INTO v_profile_exists;
  
  IF NOT v_profile_exists THEN
    RETURN json_build_object('success', false, 'error', 'Perfil não encontrado com ID: ' || p_profile_id);
  END IF;

  -- Buscar dados do perfil para log
  SELECT user_id, COALESCE(nickname, name) INTO v_user_id, v_nickname
  FROM profiles
  WHERE id = p_profile_id;

  -- Deletar perfil (CASCADE remove tudo relacionado automaticamente)
  DELETE FROM profiles WHERE id = p_profile_id;

  RETURN json_build_object(
    'success', true, 
    'deleted_profile', true,
    'deleted_nickname', v_nickname,
    'had_user_id', v_user_id IS NOT NULL,
    'message', 'Perfil "' || v_nickname || '" e todos os dados relacionados foram removidos'
  );
END;
$$;

-- Comentário
COMMENT ON FUNCTION delete_player_complete IS 'Exclui perfil e todos dados relacionados via CASCADE. Verificação corrigida para não depender de email.';

-- Garantir permissões
GRANT EXECUTE ON FUNCTION public.delete_player_complete(uuid) TO authenticated;
