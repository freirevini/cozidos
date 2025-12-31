-- Trigger function to auto-recalculate stats when round is finalized
CREATE OR REPLACE FUNCTION public.auto_recalc_on_round_finalize()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only trigger when status changes TO 'finalizada'
  IF NEW.status = 'finalizada' AND (OLD.status IS NULL OR OLD.status != 'finalizada') THEN
    -- Call the existing recalc function
    PERFORM public.recalc_round_aggregates(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_auto_recalc_on_finalize ON public.rounds;
CREATE TRIGGER trg_auto_recalc_on_finalize
  AFTER UPDATE OF status ON public.rounds
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_recalc_on_round_finalize();

COMMENT ON FUNCTION public.auto_recalc_on_round_finalize() IS 'Automatically recalculates player stats when a round is marked as finalizada';
