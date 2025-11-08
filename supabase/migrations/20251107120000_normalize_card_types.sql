-- Normalize card_type values from English labels to Portuguese enum values
-- Maps: 'yellow' / 'YELLOW_CARD' -> 'amarelo'
--       'red' / 'RED_CARD' -> 'vermelho'
-- Safe migration: only updates rows where the textual value matches one of the known English variants.

BEGIN;

-- Update `cards` table
DO $$
DECLARE
  cnt_y INT := 0;
  cnt_r INT := 0;
BEGIN
  SELECT COUNT(*) INTO cnt_y FROM public.cards WHERE card_type::text IN ('yellow', 'YELLOW_CARD');
  IF cnt_y > 0 THEN
    UPDATE public.cards
    SET card_type = 'amarelo'
    WHERE card_type::text IN ('yellow', 'YELLOW_CARD');
    RAISE NOTICE 'Normalized % cards from English yellow -> amarelo', cnt_y;
  ELSE
    RAISE NOTICE 'No cards with English yellow values found';
  END IF;

  SELECT COUNT(*) INTO cnt_r FROM public.cards WHERE card_type::text IN ('red', 'RED_CARD');
  IF cnt_r > 0 THEN
    UPDATE public.cards
    SET card_type = 'vermelho'
    WHERE card_type::text IN ('red', 'RED_CARD');
    RAISE NOTICE 'Normalized % cards from English red -> vermelho', cnt_r;
  ELSE
    RAISE NOTICE 'No cards with English red values found';
  END IF;
END
$$;

-- Conditionally update `round_team_players` if it has a card_type column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'round_team_players' AND column_name = 'card_type'
  ) THEN
    -- Yellow -> amarelo
    UPDATE public.round_team_players
    SET card_type = 'amarelo'
    WHERE card_type::text IN ('yellow', 'YELLOW_CARD');

    -- Red -> vermelho
    UPDATE public.round_team_players
    SET card_type = 'vermelho'
    WHERE card_type::text IN ('red', 'RED_CARD');

    RAISE NOTICE 'Normalized round_team_players.card_type where needed';
  ELSE
    RAISE NOTICE 'Table round_team_players has no column card_type; skipping';
  END IF;
END
$$;

COMMIT;
