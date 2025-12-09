-- Tabela de substituições
CREATE TABLE IF NOT EXISTS public.substitutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  team_color team_color NOT NULL,
  player_in_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  player_out_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  minute INTEGER NOT NULL CHECK (minute >= 0 AND minute <= 120),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_substitutions_match_id ON public.substitutions(match_id);
CREATE INDEX IF NOT EXISTS idx_substitutions_team_color ON public.substitutions(team_color);
CREATE INDEX IF NOT EXISTS idx_substitutions_minute ON public.substitutions(minute);

-- RLS
ALTER TABLE public.substitutions ENABLE ROW LEVEL SECURITY;

-- Política: todos podem ver substituições
CREATE POLICY "Substitutions are viewable by everyone"
  ON public.substitutions FOR SELECT
  USING (true);

-- Política: apenas admins podem inserir
CREATE POLICY "Only admins can insert substitutions"
  ON public.substitutions FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- Política: apenas admins podem atualizar
CREATE POLICY "Only admins can update substitutions"
  ON public.substitutions FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- Política: apenas admins podem deletar
CREATE POLICY "Only admins can delete substitutions"
  ON public.substitutions FOR DELETE
  USING (public.is_admin(auth.uid()));

-- ====================================================================
-- FUNÇÃO RPC: record_substitution - Registrar substituição
-- ====================================================================
CREATE OR REPLACE FUNCTION public.record_substitution(
  p_match_id uuid,
  p_team_color text,
  p_player_in_id uuid,
  p_player_out_id uuid,
  p_minute integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_substitution_id uuid;
  v_match_round_id uuid;
  v_actor_id uuid;
BEGIN
  -- Capturar actor_id para auditoria
  v_actor_id := auth.uid();
  
  -- Validar permissão admin
  IF NOT public.is_admin(v_actor_id) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado: apenas administradores podem registrar substituições');
  END IF;
  
  -- Validar match existe e obter round_id
  SELECT round_id INTO v_match_round_id
  FROM public.matches
  WHERE id = p_match_id;
  
  IF v_match_round_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Partida não encontrada');
  END IF;
  
  -- Validar team_color
  IF p_team_color NOT IN ('branco', 'vermelho', 'azul', 'laranja') THEN
    RETURN json_build_object('success', false, 'error', 'Cor de time inválida');
  END IF;
  
  -- Validar minuto
  IF p_minute < 0 OR p_minute > 120 THEN
    RETURN json_build_object('success', false, 'error', 'Minuto inválido (0-120)');
  END IF;
  
  -- Validar jogadores existem
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_player_in_id) THEN
    RETURN json_build_object('success', false, 'error', 'Jogador que entra não encontrado');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_player_out_id) THEN
    RETURN json_build_object('success', false, 'error', 'Jogador que sai não encontrado');
  END IF;
  
  -- Validar que são jogadores diferentes
  IF p_player_in_id = p_player_out_id THEN
    RETURN json_build_object('success', false, 'error', 'Jogador que entra e que sai devem ser diferentes');
  END IF;
  
  -- Validar que ambos os jogadores estão no time correto da rodada
  IF NOT EXISTS (
    SELECT 1 FROM public.round_team_players 
    WHERE round_id = v_match_round_id 
    AND team_color = p_team_color::team_color
    AND player_id = p_player_in_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Jogador que entra não está escalado neste time');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM public.round_team_players 
    WHERE round_id = v_match_round_id 
    AND team_color = p_team_color::team_color
    AND player_id = p_player_out_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Jogador que sai não está escalado neste time');
  END IF;
  
  -- Inserir substituição
  INSERT INTO public.substitutions (
    match_id,
    team_color,
    player_in_id,
    player_out_id,
    minute,
    created_by
  ) VALUES (
    p_match_id,
    p_team_color::team_color,
    p_player_in_id,
    p_player_out_id,
    p_minute,
    v_actor_id
  )
  RETURNING id INTO v_substitution_id;
  
  -- Registrar no audit_log
  INSERT INTO public.audit_log (action, actor_id, metadata)
  VALUES (
    'record_substitution',
    v_actor_id,
    jsonb_build_object(
      'substitution_id', v_substitution_id,
      'match_id', p_match_id,
      'team_color', p_team_color,
      'player_in_id', p_player_in_id,
      'player_out_id', p_player_out_id,
      'minute', p_minute
    )
  );
  
  RETURN json_build_object(
    'success', true,
    'substitution_id', v_substitution_id,
    'round_id', v_match_round_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Adicionar comentário para documentação
COMMENT ON FUNCTION public.record_substitution IS 'Registra substituição de jogadores durante uma partida';

