-- Add player_status enum if it doesn't exist
DO $$ BEGIN
  CREATE TYPE player_status AS ENUM ('aprovado', 'aprovar', 'congelado');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add missing values to player_type_enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'player_type_enum' AND e.enumlabel = 'mensal') THEN
    ALTER TYPE player_type_enum ADD VALUE 'mensal';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'player_type_enum' AND e.enumlabel = 'avulso_fixo') THEN
    ALTER TYPE player_type_enum ADD VALUE 'avulso_fixo';
  END IF;
END $$;

-- Add status column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status player_status DEFAULT 'aprovar';

-- Add validation to prevent multiple rounds in same week
CREATE OR REPLACE FUNCTION check_one_round_per_week()
RETURNS TRIGGER AS $$
DECLARE
  week_start DATE;
  week_end DATE;
  existing_count INTEGER;
BEGIN
  -- Calculate the week boundaries (Thursday to Wednesday)  
  -- Find the previous or current Thursday
  week_start := NEW.scheduled_date - ((EXTRACT(DOW FROM NEW.scheduled_date)::INTEGER + 3) % 7);
  week_end := week_start + INTERVAL '6 days';
  
  -- Check if there's already a round in this week
  SELECT COUNT(*) INTO existing_count
  FROM public.rounds
  WHERE scheduled_date >= week_start 
    AND scheduled_date <= week_end
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND status != 'completed';
  
  IF existing_count > 0 THEN
    RAISE EXCEPTION 'Já existe uma rodada agendada para esta semana';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for rounds validation
DROP TRIGGER IF EXISTS validate_one_round_per_week ON public.rounds;
CREATE TRIGGER validate_one_round_per_week
  BEFORE INSERT OR UPDATE ON public.rounds
  FOR EACH ROW
  EXECUTE FUNCTION check_one_round_per_week();