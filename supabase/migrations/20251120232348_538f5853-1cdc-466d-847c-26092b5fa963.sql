-- Criar trigger automático para recalcular rankings quando adjustments mudam
CREATE OR REPLACE FUNCTION public.recalc_on_adjustment_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Recalcular todos os rankings automaticamente
  PERFORM public.recalc_all_player_rankings();
  RETURN NEW;
END;
$$;

-- Criar trigger AFTER INSERT, UPDATE ou DELETE em player_ranking_adjustments
DROP TRIGGER IF EXISTS trigger_recalc_on_adjustment ON public.player_ranking_adjustments;
CREATE TRIGGER trigger_recalc_on_adjustment
  AFTER INSERT OR UPDATE OR DELETE ON public.player_ranking_adjustments
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.recalc_on_adjustment_change();