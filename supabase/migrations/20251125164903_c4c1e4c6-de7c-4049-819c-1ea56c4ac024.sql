-- Função para reset completo da classificação (zera TUDO)
CREATE OR REPLACE FUNCTION public.reset_full_classification()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Validar acesso admin
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado: apenas administradores podem executar esta função');
  END IF;

  -- Limpar ajustes manuais
  TRUNCATE TABLE public.player_ranking_adjustments;
  
  -- Limpar estatísticas por rodada
  TRUNCATE TABLE public.player_round_stats;
  
  -- Limpar classificação geral
  TRUNCATE TABLE public.player_rankings;
  
  RETURN json_build_object('success', true, 'message', 'Classificação completa resetada com sucesso');
END;
$$;

-- Atualizar função de recálculo após exclusão de rodada para considerar ajustes
CREATE OR REPLACE FUNCTION public.recalc_rankings_on_round_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Usar a função completa que considera ajustes manuais
  PERFORM public.recalc_all_player_rankings();
  RETURN OLD;
END;
$$;