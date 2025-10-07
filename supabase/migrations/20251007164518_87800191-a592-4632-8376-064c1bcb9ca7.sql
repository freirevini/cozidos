-- Update handle_new_user function to include new fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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