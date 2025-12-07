-- ETAPA 1: Schema e RPCs para fluxo de tokens e aprovação de jogadores

-- 1.1 Adicionar novos campos em profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS claim_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS claim_token_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by_admin_simple boolean DEFAULT false;

-- 1.2 Criar enum player_type_enum se não existir (já existe no schema)
-- Note: player_type_detail já existe com tipo player_type_enum

-- 1.3 Índice para busca por token
CREATE INDEX IF NOT EXISTS idx_profiles_claim_token 
  ON public.profiles(claim_token) WHERE claim_token IS NOT NULL;

-- ====================================================================
-- 2. FUNÇÃO: generate_claim_token - Gera token único com loop anti-colisão
-- ====================================================================
CREATE OR REPLACE FUNCTION public.generate_claim_token(p_profile_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token text;
  v_attempts int := 0;
  v_max_attempts int := 10;
BEGIN
  -- Validar admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem gerar tokens';
  END IF;

  -- Loop com tratamento de unique_violation
  LOOP
    -- Gerar token de 8 caracteres alfanuméricos
    v_token := upper(substring(md5(random()::text || clock_timestamp()::text || v_attempts::text) from 1 for 8));
    
    BEGIN
      -- Tentar atualizar profile com token
      UPDATE public.profiles 
      SET claim_token = v_token,
          claim_token_used_at = NULL
      WHERE id = p_profile_id;
      
      -- Se chegou aqui, sucesso - sair do loop
      EXIT;
      
    EXCEPTION WHEN unique_violation THEN
      -- Token duplicado, tentar novamente
      v_attempts := v_attempts + 1;
      IF v_attempts >= v_max_attempts THEN
        RAISE EXCEPTION 'Não foi possível gerar token único após % tentativas', v_max_attempts;
      END IF;
      CONTINUE;
    END;
  END LOOP;
  
  RETURN v_token;
END;
$$;

-- ====================================================================
-- 3. FUNÇÃO: claim_profile_with_token - Jogador usa token para reivindicar perfil
-- ====================================================================
CREATE OR REPLACE FUNCTION public.claim_profile_with_token(
  p_token text,
  p_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_target_profile RECORD;
  v_temp_profile RECORD;
BEGIN
  -- Validar parâmetros
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Token não informado'
    );
  END IF;
  
  IF p_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário não identificado'
    );
  END IF;

  -- Buscar perfil pelo token (case-insensitive)
  SELECT * INTO v_target_profile
  FROM profiles
  WHERE claim_token = upper(trim(p_token))
    AND user_id IS NULL
    AND claim_token_used_at IS NULL;
  
  IF v_target_profile IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Token inválido, já utilizado ou perfil já vinculado'
    );
  END IF;
  
  -- Buscar perfil temporário do user (criado pelo trigger)
  SELECT * INTO v_temp_profile
  FROM profiles
  WHERE user_id = p_user_id AND id != v_target_profile.id;
  
  -- Vincular user ao perfil alvo com is_player=true e status=aprovado
  UPDATE profiles SET
    user_id = p_user_id,
    is_player = true,
    status = 'aprovado'::player_status,
    is_approved = true,
    claim_token_used_at = now()
  WHERE id = v_target_profile.id;
  
  -- Deletar perfil temporário se existir
  IF v_temp_profile IS NOT NULL THEN
    DELETE FROM profiles WHERE id = v_temp_profile.id;
  END IF;
  
  -- Audit log
  INSERT INTO audit_log (action, actor_id, target_profile_id, metadata)
  VALUES (
    'profile_claimed_via_token',
    p_user_id,
    v_target_profile.id,
    jsonb_build_object(
      'token_used', upper(trim(p_token)),
      'temp_profile_deleted', v_temp_profile IS NOT NULL,
      'target_name', v_target_profile.name,
      'target_nickname', v_target_profile.nickname
    )
  );
  
  RETURN json_build_object(
    'success', true,
    'profile_id', v_target_profile.id,
    'nickname', COALESCE(v_target_profile.nickname, v_target_profile.name),
    'message', format('Perfil vinculado com sucesso! Bem-vindo, %s!', 
      COALESCE(v_target_profile.nickname, v_target_profile.name))
  );
END;
$$;

-- ====================================================================
-- 4. FUNÇÃO: admin_link_pending_to_profile - Admin vincula pendente a perfil admin-created
-- ====================================================================
CREATE OR REPLACE FUNCTION public.admin_link_pending_to_profile(
  p_pending_profile_id uuid,
  p_target_profile_id uuid,
  p_admin_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pending RECORD;
  v_target RECORD;
  v_merge_result json;
BEGIN
  -- Validar admin
  IF NOT is_admin(p_admin_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado');
  END IF;
  
  -- Buscar perfis
  SELECT * INTO v_pending FROM profiles WHERE id = p_pending_profile_id;
  SELECT * INTO v_target FROM profiles WHERE id = p_target_profile_id;
  
  IF v_pending IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Perfil pendente não encontrado');
  END IF;
  
  IF v_target IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Perfil alvo não encontrado');
  END IF;
  
  IF v_pending.user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Perfil pendente não tem conta de usuário vinculada');
  END IF;
  
  IF v_target.user_id IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Perfil alvo já está vinculado a outro usuário');
  END IF;
  
  -- Transferir user_id para o perfil alvo
  UPDATE profiles SET
    user_id = v_pending.user_id,
    status = 'aprovado'::player_status,
    is_player = true,
    is_approved = true
  WHERE id = p_target_profile_id;
  
  -- Mesclar dados (mover gols, assistências, etc do pendente para o alvo)
  SELECT merge_players(p_pending_profile_id, p_target_profile_id, p_admin_user_id)
  INTO v_merge_result;
  
  -- Audit log
  INSERT INTO audit_log (action, actor_id, target_profile_id, source_profile_id, metadata)
  VALUES (
    'admin_link_pending_to_profile',
    p_admin_user_id,
    p_target_profile_id,
    p_pending_profile_id,
    jsonb_build_object(
      'pending_name', v_pending.name,
      'pending_email', v_pending.email,
      'target_name', v_target.name,
      'target_nickname', v_target.nickname,
      'merge_result', v_merge_result
    )
  );
  
  RETURN json_build_object(
    'success', true,
    'message', format('Perfil %s vinculado ao jogador %s com sucesso!', 
      COALESCE(v_pending.name, v_pending.email), 
      COALESCE(v_target.nickname, v_target.name)),
    'merge_result', v_merge_result
  );
END;
$$;