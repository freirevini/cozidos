-- Migration: Data Integrity Improvements
-- 1. Add CASCADE to assists→goals FK
-- 2. Create function to recalculate match score
-- 3. Create function to delete goal with cascade
-- 4. Add team_color to cards table

-- =============================================
-- FASE 1: CASCADE em assists→goals
-- =============================================

-- Drop existing constraint and recreate with CASCADE
ALTER TABLE public.assists 
DROP CONSTRAINT IF EXISTS assists_goal_id_fkey;

ALTER TABLE public.assists
ADD CONSTRAINT assists_goal_id_fkey
FOREIGN KEY (goal_id) REFERENCES public.goals(id)
ON DELETE CASCADE;

-- =============================================
-- FASE 2: Função para recalcular placar da partida
-- =============================================

CREATE OR REPLACE FUNCTION public.recalc_match_score(p_match_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_score_home INT;
  v_score_away INT;
  v_team_home TEXT;
  v_team_away TEXT;
BEGIN
  -- Get team colors for this match
  SELECT team_home, team_away INTO v_team_home, v_team_away
  FROM public.matches
  WHERE id = p_match_id;

  IF v_team_home IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Partida não encontrada');
  END IF;

  -- Calculate score_home: 
  -- Goals from home team (not own goal) + Own goals from away team
  SELECT COUNT(*) INTO v_score_home
  FROM public.goals
  WHERE match_id = p_match_id
    AND (
      (team_color::text = v_team_home AND NOT is_own_goal)
      OR
      (team_color::text = v_team_away AND is_own_goal)
    );

  -- Calculate score_away:
  -- Goals from away team (not own goal) + Own goals from home team
  SELECT COUNT(*) INTO v_score_away
  FROM public.goals
  WHERE match_id = p_match_id
    AND (
      (team_color::text = v_team_away AND NOT is_own_goal)
      OR
      (team_color::text = v_team_home AND is_own_goal)
    );

  -- Update match score
  UPDATE public.matches
  SET score_home = v_score_home,
      score_away = v_score_away
  WHERE id = p_match_id;

  RETURN json_build_object(
    'success', true,
    'score_home', v_score_home,
    'score_away', v_score_away
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalc_match_score(UUID) TO authenticated;

-- =============================================
-- FASE 3: Função para deletar gol com recálculo automático
-- =============================================

CREATE OR REPLACE FUNCTION public.delete_goal_and_recalc(
  p_goal_id UUID,
  p_match_id UUID
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result json;
BEGIN
  -- Validate admin access
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  -- Delete the goal (CASCADE will delete assists)
  DELETE FROM public.goals WHERE id = p_goal_id;

  -- Recalculate match score
  SELECT public.recalc_match_score(p_match_id) INTO v_result;

  RETURN json_build_object(
    'success', true,
    'message', 'Gol deletado e placar recalculado',
    'new_score', v_result
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_goal_and_recalc(UUID, UUID) TO authenticated;

-- =============================================
-- FASE 4: Adicionar team_color a cards
-- =============================================

ALTER TABLE public.cards
ADD COLUMN IF NOT EXISTS team_color team_color;

-- =============================================
-- FASE 5: Trigger para manter placar sincronizado
-- =============================================

CREATE OR REPLACE FUNCTION sync_match_score_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_match_id UUID;
BEGIN
  -- Get the match_id from OLD (for DELETE) or NEW (for INSERT)
  v_match_id := COALESCE(OLD.match_id, NEW.match_id);
  
  -- Recalculate score
  PERFORM public.recalc_match_score(v_match_id);
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for INSERT and DELETE on goals
DROP TRIGGER IF EXISTS trg_sync_score_after_goal ON public.goals;

CREATE TRIGGER trg_sync_score_after_goal
AFTER INSERT OR DELETE ON public.goals
FOR EACH ROW EXECUTE FUNCTION sync_match_score_trigger();

-- =============================================
-- Comments
-- =============================================

COMMENT ON FUNCTION public.recalc_match_score IS 'Recalcula o placar de uma partida baseado nos gols registrados';
COMMENT ON FUNCTION public.delete_goal_and_recalc IS 'Deleta um gol e recalcula o placar automaticamente';
COMMENT ON TRIGGER trg_sync_score_after_goal ON public.goals IS 'Mantém score_home e score_away sincronizados com tabela goals';
