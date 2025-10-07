-- Fix search_path for check_one_round_per_week function
CREATE OR REPLACE FUNCTION check_one_round_per_week()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;