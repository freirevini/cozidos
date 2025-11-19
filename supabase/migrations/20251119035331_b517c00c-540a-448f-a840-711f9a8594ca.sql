-- Criar tabela de ajustes manuais de classificação
CREATE TABLE IF NOT EXISTS public.player_ranking_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN (
    'gols', 'assistencias', 'vitorias', 'empates', 'derrotas',
    'presencas', 'faltas', 'atrasos', 'punicoes',
    'cartoes_amarelos', 'cartoes_azuis'
  )),
  adjustment_value INTEGER NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_adjustments_player_id ON public.player_ranking_adjustments(player_id);
CREATE INDEX IF NOT EXISTS idx_adjustments_type ON public.player_ranking_adjustments(adjustment_type);

-- RLS Policies
ALTER TABLE public.player_ranking_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view adjustments"
  ON public.player_ranking_adjustments
  FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert adjustments"
  ON public.player_ranking_adjustments
  FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update adjustments"
  ON public.player_ranking_adjustments
  FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete adjustments"
  ON public.player_ranking_adjustments
  FOR DELETE
  USING (is_admin(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_adjustments_updated_at
  BEFORE UPDATE ON public.player_ranking_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Atualizar função recalc_all_player_rankings para considerar ajustes
CREATE OR REPLACE FUNCTION public.recalc_all_player_rankings()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Validar acesso admin
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  -- Recalcular player_rankings para todos os jogadores aprovados
  -- INCLUINDO ajustes manuais
  INSERT INTO public.player_rankings (
    player_id, nickname, email,
    gols, assistencias,
    vitorias, empates, derrotas,
    presencas, faltas, atrasos, punicoes,
    cartoes_amarelos, cartoes_azuis,
    pontos_totais
  )
  SELECT 
    pr.id as player_id,
    COALESCE(pr.nickname, pr.name) as nickname,
    pr.email,
    -- Gols = eventos reais + ajustes
    COALESCE((SELECT COUNT(*) FROM public.goals g JOIN public.matches m ON m.id = g.match_id WHERE g.player_id = pr.id AND g.is_own_goal = false), 0)
    + COALESCE((SELECT SUM(adjustment_value) FROM public.player_ranking_adjustments WHERE player_id = pr.id AND adjustment_type = 'gols'), 0) as gols,
    
    -- Assistências = eventos reais + ajustes
    COALESCE((SELECT COUNT(*) FROM public.assists a WHERE a.player_id = pr.id), 0)
    + COALESCE((SELECT SUM(adjustment_value) FROM public.player_ranking_adjustments WHERE player_id = pr.id AND adjustment_type = 'assistencias'), 0) as assistencias,
    
    -- Vitórias = stats + ajustes
    COALESCE(SUM(prs.victories), 0)
    + COALESCE((SELECT SUM(adjustment_value) FROM public.player_ranking_adjustments WHERE player_id = pr.id AND adjustment_type = 'vitorias'), 0) as vitorias,
    
    -- Empates = stats + ajustes
    COALESCE(SUM(prs.draws), 0)
    + COALESCE((SELECT SUM(adjustment_value) FROM public.player_ranking_adjustments WHERE player_id = pr.id AND adjustment_type = 'empates'), 0) as empates,
    
    -- Derrotas = stats + ajustes
    COALESCE(SUM(prs.defeats), 0)
    + COALESCE((SELECT SUM(adjustment_value) FROM public.player_ranking_adjustments WHERE player_id = pr.id AND adjustment_type = 'derrotas'), 0) as derrotas,
    
    -- Presenças = stats + ajustes
    COALESCE(COUNT(DISTINCT prs.round_id) FILTER (WHERE prs.presence_points > 0), 0)
    + COALESCE((SELECT SUM(adjustment_value) FROM public.player_ranking_adjustments WHERE player_id = pr.id AND adjustment_type = 'presencas'), 0) as presencas,
    
    -- Faltas = stats + ajustes
    COALESCE(SUM(prs.absences), 0)
    + COALESCE((SELECT SUM(adjustment_value) FROM public.player_ranking_adjustments WHERE player_id = pr.id AND adjustment_type = 'faltas'), 0) as faltas,
    
    -- Atrasos = stats + ajustes
    COALESCE(SUM(prs.lates), 0)
    + COALESCE((SELECT SUM(adjustment_value) FROM public.player_ranking_adjustments WHERE player_id = pr.id AND adjustment_type = 'atrasos'), 0) as atrasos,
    
    -- Punições = stats + ajustes
    COALESCE(SUM(prs.punishments), 0)
    + COALESCE((SELECT SUM(adjustment_value) FROM public.player_ranking_adjustments WHERE player_id = pr.id AND adjustment_type = 'punicoes'), 0) as punicoes,
    
    -- Cartões amarelos = stats + ajustes
    COALESCE(SUM(prs.yellow_cards), 0)
    + COALESCE((SELECT SUM(adjustment_value) FROM public.player_ranking_adjustments WHERE player_id = pr.id AND adjustment_type = 'cartoes_amarelos'), 0) as cartoes_amarelos,
    
    -- Cartões azuis = stats + ajustes
    COALESCE(SUM(prs.blue_cards), 0)
    + COALESCE((SELECT SUM(adjustment_value) FROM public.player_ranking_adjustments WHERE player_id = pr.id AND adjustment_type = 'cartoes_azuis'), 0) as cartoes_azuis,
    
    -- Pontos totais = stats
    COALESCE(SUM(prs.total_points), 0) as pontos_totais
  FROM public.profiles pr
  LEFT JOIN public.player_round_stats prs ON prs.player_id = pr.id
  WHERE pr.is_player = true AND pr.status = 'aprovado'
  GROUP BY pr.id, pr.nickname, pr.name, pr.email
  ON CONFLICT (player_id)
  DO UPDATE SET
    gols = EXCLUDED.gols,
    assistencias = EXCLUDED.assistencias,
    vitorias = EXCLUDED.vitorias,
    empates = EXCLUDED.empates,
    derrotas = EXCLUDED.derrotas,
    presencas = EXCLUDED.presencas,
    faltas = EXCLUDED.faltas,
    atrasos = EXCLUDED.atrasos,
    punicoes = EXCLUDED.punicoes,
    cartoes_amarelos = EXCLUDED.cartoes_amarelos,
    cartoes_azuis = EXCLUDED.cartoes_azuis,
    pontos_totais = EXCLUDED.pontos_totais,
    nickname = EXCLUDED.nickname,
    updated_at = NOW();
    
  RETURN json_build_object('success', true, 'message', 'Rankings recalculados com ajustes aplicados');
END;
$$;

-- Função para aplicar ajuste manual
CREATE OR REPLACE FUNCTION public.apply_ranking_adjustment(
  p_player_id UUID,
  p_adjustment_type TEXT,
  p_new_total INTEGER,
  p_reason TEXT DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_real INTEGER;
  v_current_adjustment INTEGER;
  v_current_total INTEGER;
  v_new_adjustment INTEGER;
BEGIN
  -- Validar acesso admin
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  -- Calcular valor real dos eventos (sem ajustes)
  CASE p_adjustment_type
    WHEN 'gols' THEN
      SELECT COUNT(*) INTO v_current_real
      FROM public.goals g
      JOIN public.matches m ON m.id = g.match_id
      WHERE g.player_id = p_player_id AND g.is_own_goal = false;
      
    WHEN 'assistencias' THEN
      SELECT COUNT(*) INTO v_current_real
      FROM public.assists
      WHERE player_id = p_player_id;
      
    WHEN 'vitorias' THEN
      SELECT COALESCE(SUM(victories), 0) INTO v_current_real
      FROM public.player_round_stats
      WHERE player_id = p_player_id;
      
    WHEN 'empates' THEN
      SELECT COALESCE(SUM(draws), 0) INTO v_current_real
      FROM public.player_round_stats
      WHERE player_id = p_player_id;
      
    WHEN 'derrotas' THEN
      SELECT COALESCE(SUM(defeats), 0) INTO v_current_real
      FROM public.player_round_stats
      WHERE player_id = p_player_id;
      
    WHEN 'presencas' THEN
      SELECT COUNT(DISTINCT round_id) INTO v_current_real
      FROM public.player_round_stats
      WHERE player_id = p_player_id AND presence_points > 0;
      
    WHEN 'faltas' THEN
      SELECT COALESCE(SUM(absences), 0) INTO v_current_real
      FROM public.player_round_stats
      WHERE player_id = p_player_id;
      
    WHEN 'atrasos' THEN
      SELECT COALESCE(SUM(lates), 0) INTO v_current_real
      FROM public.player_round_stats
      WHERE player_id = p_player_id;
      
    WHEN 'punicoes' THEN
      SELECT COALESCE(SUM(punishments), 0) INTO v_current_real
      FROM public.player_round_stats
      WHERE player_id = p_player_id;
      
    WHEN 'cartoes_amarelos' THEN
      SELECT COALESCE(SUM(yellow_cards), 0) INTO v_current_real
      FROM public.player_round_stats
      WHERE player_id = p_player_id;
      
    WHEN 'cartoes_azuis' THEN
      SELECT COALESCE(SUM(blue_cards), 0) INTO v_current_real
      FROM public.player_round_stats
      WHERE player_id = p_player_id;
      
    ELSE
      RETURN json_build_object('success', false, 'error', 'Tipo de ajuste inválido');
  END CASE;

  -- Buscar ajuste atual
  SELECT COALESCE(SUM(adjustment_value), 0) INTO v_current_adjustment
  FROM public.player_ranking_adjustments
  WHERE player_id = p_player_id AND adjustment_type = p_adjustment_type;

  -- Calcular total atual
  v_current_total := v_current_real + v_current_adjustment;

  -- Calcular novo ajuste necessário
  v_new_adjustment := p_new_total - v_current_real;

  -- Deletar ajustes anteriores deste tipo para este jogador
  DELETE FROM public.player_ranking_adjustments
  WHERE player_id = p_player_id AND adjustment_type = p_adjustment_type;

  -- Inserir novo ajuste apenas se diferente de zero
  IF v_new_adjustment != 0 THEN
    INSERT INTO public.player_ranking_adjustments (
      player_id,
      adjustment_type,
      adjustment_value,
      reason,
      created_by
    ) VALUES (
      p_player_id,
      p_adjustment_type,
      v_new_adjustment,
      COALESCE(p_reason, format('Ajuste manual: %s → %s (real: %s, ajuste: %s)',
        v_current_total, p_new_total, v_current_real, v_new_adjustment)),
      auth.uid()
    );
  END IF;

  -- Recalcular rankings
  PERFORM public.recalc_all_player_rankings();

  RETURN json_build_object(
    'success', true,
    'real_value', v_current_real,
    'old_adjustment', v_current_adjustment,
    'new_adjustment', v_new_adjustment,
    'old_total', v_current_total,
    'new_total', p_new_total
  );
END;
$$;