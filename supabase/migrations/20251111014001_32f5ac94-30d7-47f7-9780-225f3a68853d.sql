-- Ensure player_status enum exists with correct values
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'player_status') THEN
    CREATE TYPE public.player_status AS ENUM ('pendente', 'aprovado', 'congelado', 'rejeitado');
  END IF;
END $$;

-- Set default for profiles.status column
ALTER TABLE public.profiles
ALTER COLUMN status SET DEFAULT 'pendente'::public.player_status;

-- Recreate handle_new_user function with fully qualified enum casts
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  existing_profile_id uuid;
  normalized_email text;
BEGIN
  normalized_email := LOWER(TRIM(NEW.email));

  SELECT id INTO existing_profile_id
  FROM public.profiles
  WHERE LOWER(TRIM(email)) = normalized_email
  LIMIT 1;

  IF existing_profile_id IS NOT NULL THEN
    UPDATE public.profiles
    SET
      user_id    = NEW.id,
      status     = 'aprovado'::public.player_status,
      first_name = COALESCE(first_name, NEW.raw_user_meta_data->>'first_name'),
      last_name  = COALESCE(last_name, NEW.raw_user_meta_data->>'last_name'),
      name       = COALESCE(name, NEW.raw_user_meta_data->>'name', 'Usuário')
    WHERE id = existing_profile_id;
  ELSE
    INSERT INTO public.profiles (
      id, user_id, email, name, first_name, last_name, nickname,
      birth_date, is_player, status
    ) VALUES (
      gen_random_uuid(),
      NEW.id,
      normalized_email,
      COALESCE(NEW.raw_user_meta_data->>'name', 'Usuário'),
      COALESCE(NEW.raw_user_meta_data->>'first_name', 'Usuário'),
      COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'nickname', NEW.email),
      (NULLIF(NEW.raw_user_meta_data->>'birth_date',''))::date,
      COALESCE((NEW.raw_user_meta_data->>'is_player')::boolean, false),
      CASE
        WHEN COALESCE((NEW.raw_user_meta_data->>'is_player')::boolean, false)
          THEN 'pendente'::public.player_status
        ELSE 'aprovado'::public.player_status
      END
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Recreate trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();