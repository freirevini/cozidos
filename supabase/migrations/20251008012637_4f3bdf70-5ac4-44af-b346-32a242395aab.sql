-- Fix the existing functions with insecure search_path
-- Update handle_new_user function to have secure search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id, 
    name, 
    nickname, 
    birth_date, 
    is_player, 
    player_type
  )
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'name', 'Usuário'),
    new.raw_user_meta_data->>'nickname',
    (new.raw_user_meta_data->>'birth_date')::date,
    COALESCE((new.raw_user_meta_data->>'is_player')::boolean, false),
    new.raw_user_meta_data->>'player_type'
  );
  RETURN new;
END;
$function$;

-- Update update_updated_at_column to have secure search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Update check_one_round_per_week to have secure search_path
CREATE OR REPLACE FUNCTION public.check_one_round_per_week()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
$function$;

-- Update is_admin to have secure search_path
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = is_admin.user_id
    AND role = 'admin'
  );
$function$;