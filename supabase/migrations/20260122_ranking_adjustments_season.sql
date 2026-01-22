-- ============================================================
-- MIGRAÇÃO: Ajustes de Classificação por Temporada
-- Data: 2026-01-22
-- ============================================================

-- 1. Adicionar coluna season_year à tabela de ajustes
ALTER TABLE public.player_ranking_adjustments 
ADD COLUMN IF NOT EXISTS season_year INT NULL;

-- 2. Criar índice para busca por temporada
CREATE INDEX IF NOT EXISTS idx_adjustments_season 
ON public.player_ranking_adjustments(season_year);

-- 3. Garantir FK com ON DELETE CASCADE
ALTER TABLE public.player_ranking_adjustments
DROP CONSTRAINT IF EXISTS player_ranking_adjustments_player_id_fkey;

ALTER TABLE public.player_ranking_adjustments
ADD CONSTRAINT player_ranking_adjustments_player_id_fkey
FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 4. Comentário da coluna
COMMENT ON COLUMN public.player_ranking_adjustments.season_year IS 
'Temporada do ajuste. NULL = aplica a todas temporadas (permanente). Valor específico (ex: 2026) = aplica apenas àquela temporada.';

-- 5. Função helper para obter ajustes por tipo e temporada
CREATE OR REPLACE FUNCTION get_player_adjustment(
  p_player_id UUID,
  p_type TEXT,
  p_season INT DEFAULT NULL
)
RETURNS INT
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(SUM(adjustment_value), 0)::INT
  FROM player_ranking_adjustments
  WHERE player_id = p_player_id
    AND adjustment_type = p_type
    AND (
      season_year IS NULL  -- Ajustes permanentes
      OR (p_season IS NOT NULL AND season_year = p_season)  -- Temporada específica
    );
$$;

COMMENT ON FUNCTION get_player_adjustment IS 
'Retorna soma de ajustes para um jogador, tipo e temporada. Se p_season=NULL, considera apenas ajustes permanentes.';

-- ============================================================
-- VERIFICAÇÃO
-- ============================================================
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'player_ranking_adjustments' 
  AND column_name = 'season_year';
