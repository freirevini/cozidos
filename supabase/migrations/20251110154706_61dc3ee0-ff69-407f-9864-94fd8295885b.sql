-- Fix Function Search Path Mutable warnings
-- Add SET search_path to functions that don't have it

-- Fix update_player_age trigger function
CREATE OR REPLACE FUNCTION public.update_player_age()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.age_years := public.calculate_age_years(NEW.birth_date);
  RETURN NEW;
END;
$function$;

-- Fix calculate_age_years function
CREATE OR REPLACE FUNCTION public.calculate_age_years(birth_date date)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  today_local DATE;
BEGIN
  IF birth_date IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get current date in America/Sao_Paulo timezone
  today_local := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;
  
  RETURN DATE_PART('year', AGE(today_local, birth_date));
END;
$function$;