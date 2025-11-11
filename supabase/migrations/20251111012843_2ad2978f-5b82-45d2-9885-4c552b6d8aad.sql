-- 1. Renomear enum 'aprovar' -> 'pendente' se existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'player_status' AND e.enumlabel = 'aprovar'
  ) THEN
    ALTER TYPE player_status RENAME VALUE 'aprovar' TO 'pendente';
  END IF;
END $$;

-- 2. Adicionar 'rejeitado' se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'player_status' AND e.enumlabel = 'rejeitado'
  ) THEN
    ALTER TYPE player_status ADD VALUE 'rejeitado';
  END IF;
END $$;

-- 3. Ajustar default para 'pendente'
ALTER TABLE public.profiles
  ALTER COLUMN status SET DEFAULT 'pendente'::player_status;

-- 4. Recriar função handle_new_user com lógica robusta
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
      user_id   = NEW.id,
      status    = 'aprovado'::player_status,
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
          THEN 'pendente'::player_status
        ELSE 'aprovado'::player_status
      END
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- 5. Recriar trigger on_auth_user_created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();