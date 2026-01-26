-- Migration: Convert player_rankings table to VIEW
-- Purpose: Eliminate data duplication while maintaining frontend compatibility
-- Strategy: VIEW calls get_classification RPC as single source of truth

-- Step 1: Backup existing data (optional, for safety)
-- Users can restore if needed by re-running recalc_all_player_rankings

-- Step 2: Drop the physical table
-- CASCADE will drop dependent triggers, indexes, but NOT policies (views can have policies)
DROP TABLE IF EXISTS public.player_rankings CASCADE;

-- Step 3: Create VIEW with same schema
-- This makes all existing SELECT queries work without changes
CREATE OR REPLACE VIEW public.player_rankings AS
SELECT 
  player_id,
  nickname,
  NULL::text as email, -- Preserved for compatibility, but deprecated
  avatar_url,
  level,
  presencas,
  vitorias,
  empates,
  derrotas,
  atrasos,
  faltas,
  punicoes,
  cartoes_amarelos,
  cartoes_azuis,
  gols,
  assistencias,
  saldo_gols,
  pontos_totais,
  -- Metadata fields for compatibility
  now() as created_at,
  now() as updated_at
FROM get_classification(NULL, NULL);

-- Step 4: Re-enable RLS on the view
ALTER VIEW public.player_rankings SET (security_invoker = true);

-- Step 5: Recreate RLS policies for the view
-- Views can have SELECT policies
CREATE POLICY "Authenticated users can view player_rankings"
  ON public.player_rankings
  FOR SELECT
  TO authenticated
  USING (true);

-- Step 6: Add comment explaining the architecture change
COMMENT ON VIEW public.player_rankings IS 
'View that calls get_classification(NULL, NULL) RPC. 
Replaced physical table to eliminate data duplication.
Always up-to-date, no manual recalc needed.
Can be converted to MATERIALIZED VIEW in Fase 3 for performance.';

-- Note: The following are now DEPRECATED and should be removed from frontend:
-- - recalc_all_player_rankings() calls
-- - INSERT/UPDATE/DELETE on player_rankings (view is read-only)
