-- =====================================================
-- 1. TABELA AUDIT_LOG
-- =====================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  actor_id uuid,
  target_profile_id uuid,
  source_profile_id uuid,
  metadata jsonb DEFAULT '{}',
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para consultas
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON public.audit_log(target_profile_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at DESC);

-- RLS para audit_log
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit_log"
ON public.audit_log FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "System can insert audit_log"
ON public.audit_log FOR INSERT
WITH CHECK (true);

-- =====================================================
-- 2. FUNÇÃO RPC: link_player_to_user
-- =====================================================
CREATE OR REPLACE FUNCTION public.link_player_to_user(
  p_profile_id uuid,
  p_user_id uuid,
  p_actor_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing_profile RECORD;
  v_temp_profile RECORD;
BEGIN
  -- Buscar perfil alvo (criado pelo admin, sem user_id)
  SELECT * INTO v_existing_profile
  FROM public.profiles
  WHERE id = p_profile_id AND user_id IS NULL;
  
  IF v_existing_profile IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Perfil não encontrado ou já vinculado a um usuário'
    );
  END IF;
  
  -- Verificar se já existe perfil temporário para este user_id
  SELECT * INTO v_temp_profile
  FROM public.profiles
  WHERE user_id = p_user_id AND id != p_profile_id;
  
  -- Atualizar perfil existente com user_id
  UPDATE public.profiles
  SET 
    user_id = p_user_id,
    status = 'aprovado'::public.player_status
  WHERE id = p_profile_id;
  
  -- Deletar perfil temporário se existir
  IF v_temp_profile IS NOT NULL THEN
    DELETE FROM public.profiles WHERE id = v_temp_profile.id;
  END IF;
  
  -- Registrar no audit_log
  INSERT INTO public.audit_log (action, actor_id, target_profile_id, metadata)
  VALUES (
    'link_player_to_user',
    COALESCE(p_actor_id, auth.uid()),
    p_profile_id,
    jsonb_build_object(
      'user_id', p_user_id,
      'temp_profile_deleted', v_temp_profile IS NOT NULL,
      'temp_profile_id', v_temp_profile.id
    )
  );
  
  RETURN json_build_object(
    'success', true,
    'message', 'Jogador vinculado com sucesso',
    'profile_id', p_profile_id,
    'temp_deleted', v_temp_profile IS NOT NULL
  );
END;
$$;

-- =====================================================
-- 3. FUNÇÃO RPC: merge_players
-- =====================================================
CREATE OR REPLACE FUNCTION public.merge_players(
  p_source_id uuid,
  p_target_id uuid,
  p_actor_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_source RECORD;
  v_target RECORD;
  v_goals_moved int := 0;
  v_assists_moved int := 0;
  v_cards_moved int := 0;
  v_stats_moved int := 0;
  v_attendance_moved int := 0;
  v_team_players_moved int := 0;
  v_punishments_moved int := 0;
BEGIN
  -- Validar permissão admin
  IF NOT public.is_admin(COALESCE(p_actor_id, auth.uid())) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado: apenas administradores podem executar merge');
  END IF;

  -- Buscar perfis
  SELECT * INTO v_source FROM public.profiles WHERE id = p_source_id;
  SELECT * INTO v_target FROM public.profiles WHERE id = p_target_id;
  
  IF v_source IS NULL OR v_target IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Perfil fonte ou destino não encontrado');
  END IF;
  
  IF p_source_id = p_target_id THEN
    RETURN json_build_object('success', false, 'error', 'Perfil fonte e destino são o mesmo');
  END IF;

  -- Mover goals
  UPDATE public.goals SET player_id = p_target_id WHERE player_id = p_source_id;
  GET DIAGNOSTICS v_goals_moved = ROW_COUNT;
  
  -- Mover assists
  UPDATE public.assists SET player_id = p_target_id WHERE player_id = p_source_id;
  GET DIAGNOSTICS v_assists_moved = ROW_COUNT;
  
  -- Mover cards
  UPDATE public.cards SET player_id = p_target_id WHERE player_id = p_source_id;
  GET DIAGNOSTICS v_cards_moved = ROW_COUNT;
  
  -- Mover punishments
  UPDATE public.punishments SET player_id = p_target_id WHERE player_id = p_source_id;
  GET DIAGNOSTICS v_punishments_moved = ROW_COUNT;
  
  -- Mover player_attendance (com ON CONFLICT para evitar duplicatas)
  UPDATE public.player_attendance SET player_id = p_target_id 
  WHERE player_id = p_source_id 
  AND NOT EXISTS (
    SELECT 1 FROM public.player_attendance pa2 
    WHERE pa2.player_id = p_target_id AND pa2.round_id = player_attendance.round_id
  );
  GET DIAGNOSTICS v_attendance_moved = ROW_COUNT;
  
  -- Remover attendance duplicados restantes do source
  DELETE FROM public.player_attendance WHERE player_id = p_source_id;
  
  -- Mover round_team_players (com verificação de duplicatas)
  UPDATE public.round_team_players SET player_id = p_target_id 
  WHERE player_id = p_source_id
  AND NOT EXISTS (
    SELECT 1 FROM public.round_team_players rtp2 
    WHERE rtp2.player_id = p_target_id AND rtp2.round_id = round_team_players.round_id
  );
  GET DIAGNOSTICS v_team_players_moved = ROW_COUNT;
  
  -- Remover team_players duplicados restantes do source
  DELETE FROM public.round_team_players WHERE player_id = p_source_id;
  
  -- Mover player_round_stats (com verificação de duplicatas)
  UPDATE public.player_round_stats SET player_id = p_target_id 
  WHERE player_id = p_source_id
  AND NOT EXISTS (
    SELECT 1 FROM public.player_round_stats prs2 
    WHERE prs2.player_id = p_target_id AND prs2.round_id = player_round_stats.round_id
  );
  GET DIAGNOSTICS v_stats_moved = ROW_COUNT;
  
  -- Remover stats duplicados restantes do source
  DELETE FROM public.player_round_stats WHERE player_id = p_source_id;
  
  -- Mover ranking_adjustments
  UPDATE public.player_ranking_adjustments SET player_id = p_target_id WHERE player_id = p_source_id;
  
  -- Remover player_rankings do source (será recalculado)
  DELETE FROM public.player_rankings WHERE player_id = p_source_id;
  
  -- Registrar no audit_log ANTES de deletar source
  INSERT INTO public.audit_log (action, actor_id, target_profile_id, source_profile_id, metadata)
  VALUES (
    'merge_players',
    COALESCE(p_actor_id, auth.uid()),
    p_target_id,
    p_source_id,
    jsonb_build_object(
      'source_email', v_source.email,
      'source_name', v_source.name,
      'target_email', v_target.email,
      'target_name', v_target.name,
      'goals_moved', v_goals_moved,
      'assists_moved', v_assists_moved,
      'cards_moved', v_cards_moved,
      'punishments_moved', v_punishments_moved,
      'attendance_moved', v_attendance_moved,
      'team_players_moved', v_team_players_moved,
      'stats_moved', v_stats_moved
    )
  );
  
  -- Deletar perfil fonte
  DELETE FROM public.profiles WHERE id = p_source_id;
  
  -- Recalcular rankings
  PERFORM public.recalc_all_player_rankings();
  
  RETURN json_build_object(
    'success', true,
    'message', 'Merge realizado com sucesso',
    'records_moved', jsonb_build_object(
      'goals', v_goals_moved,
      'assists', v_assists_moved,
      'cards', v_cards_moved,
      'punishments', v_punishments_moved,
      'attendance', v_attendance_moved,
      'team_players', v_team_players_moved,
      'stats', v_stats_moved
    )
  );
END;
$$;

-- =====================================================
-- 4. FUNÇÃO RPC: find_matching_profiles
-- =====================================================
CREATE OR REPLACE FUNCTION public.find_matching_profiles(
  p_email text,
  p_birth_date date DEFAULT NULL,
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL
)
RETURNS TABLE (
  profile_id uuid,
  name text,
  email text,
  birth_date date,
  player_id text,
  user_id uuid,
  match_score int,
  match_reason text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_normalized_email text;
  v_player_key text;
BEGIN
  v_normalized_email := LOWER(TRIM(p_email));
  
  -- Gerar player_key se tiver email e data de nascimento
  IF p_birth_date IS NOT NULL THEN
    v_player_key := public.generate_player_key(v_normalized_email, p_birth_date);
  END IF;

  RETURN QUERY
  SELECT 
    p.id as profile_id,
    p.name,
    p.email,
    p.birth_date,
    p.player_id,
    p.user_id,
    CASE
      -- Match exato por player_id = 100%
      WHEN v_player_key IS NOT NULL AND p.player_id = v_player_key THEN 100
      -- Match exato por email = 95%
      WHEN LOWER(TRIM(p.email)) = v_normalized_email THEN 95
      -- Match por nome completo + data nascimento = 80%
      WHEN p_first_name IS NOT NULL 
           AND p_last_name IS NOT NULL 
           AND p_birth_date IS NOT NULL
           AND LOWER(p.first_name) = LOWER(TRIM(p_first_name))
           AND LOWER(p.last_name) = LOWER(TRIM(p_last_name))
           AND p.birth_date = p_birth_date THEN 80
      -- Match por sobrenome + data nascimento = 70%
      WHEN p_last_name IS NOT NULL 
           AND p_birth_date IS NOT NULL
           AND LOWER(p.last_name) = LOWER(TRIM(p_last_name))
           AND p.birth_date = p_birth_date THEN 70
      ELSE 0
    END as match_score,
    CASE
      WHEN v_player_key IS NOT NULL AND p.player_id = v_player_key THEN 'player_id_exact'
      WHEN LOWER(TRIM(p.email)) = v_normalized_email THEN 'email_exact'
      WHEN p_first_name IS NOT NULL 
           AND p_last_name IS NOT NULL 
           AND p_birth_date IS NOT NULL
           AND LOWER(p.first_name) = LOWER(TRIM(p_first_name))
           AND LOWER(p.last_name) = LOWER(TRIM(p_last_name))
           AND p.birth_date = p_birth_date THEN 'full_name_birthdate'
      WHEN p_last_name IS NOT NULL 
           AND p_birth_date IS NOT NULL
           AND LOWER(p.last_name) = LOWER(TRIM(p_last_name))
           AND p.birth_date = p_birth_date THEN 'lastname_birthdate'
      ELSE 'no_match'
    END as match_reason
  FROM public.profiles p
  WHERE p.is_player = true
    AND p.user_id IS NULL  -- Apenas perfis não vinculados
    AND (
      -- Qualquer critério de match
      (v_player_key IS NOT NULL AND p.player_id = v_player_key)
      OR LOWER(TRIM(p.email)) = v_normalized_email
      OR (
        p_first_name IS NOT NULL 
        AND p_last_name IS NOT NULL 
        AND p_birth_date IS NOT NULL
        AND LOWER(p.first_name) = LOWER(TRIM(p_first_name))
        AND LOWER(p.last_name) = LOWER(TRIM(p_last_name))
        AND p.birth_date = p_birth_date
      )
      OR (
        p_last_name IS NOT NULL 
        AND p_birth_date IS NOT NULL
        AND LOWER(p.last_name) = LOWER(TRIM(p_last_name))
        AND p.birth_date = p_birth_date
      )
    )
  ORDER BY match_score DESC
  LIMIT 5;
END;
$$;