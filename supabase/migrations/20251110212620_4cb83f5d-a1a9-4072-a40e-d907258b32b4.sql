-- Correção definitiva do handle_new_user para resolver erro de enum e implementar vinculação determinística

-- Recriar função com casting explícito do enum player_status
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  existing_profile_id UUID;
  normalized_email TEXT;
BEGIN
  -- Normalizar email
  normalized_email := LOWER(TRIM(NEW.email));

  -- Buscar perfil existente por email normalizado
  SELECT id INTO existing_profile_id
  FROM public.profiles
  WHERE LOWER(TRIM(email)) = normalized_email
  LIMIT 1;

  IF existing_profile_id IS NOT NULL THEN
    -- Vincular perfil existente ao usuário autenticado
    UPDATE public.profiles
    SET 
      user_id = NEW.id,
      status = 'aprovado'::player_status,  -- ✅ Cast explícito do enum
      first_name = COALESCE(first_name, NEW.raw_user_meta_data->>'first_name'),
      last_name = COALESCE(last_name, NEW.raw_user_meta_data->>'last_name'),
      name = COALESCE(name, NEW.raw_user_meta_data->>'name', 'Usuário')
    WHERE id = existing_profile_id;
  ELSE
    -- Criar novo perfil
    INSERT INTO public.profiles (
      id,
      user_id,
      email,
      name,
      first_name,
      last_name,
      nickname,
      birth_date,
      is_player,
      status
    )
    VALUES (
      gen_random_uuid(),
      NEW.id,
      normalized_email,
      COALESCE(NEW.raw_user_meta_data->>'name', 'Usuário'),
      COALESCE(NEW.raw_user_meta_data->>'first_name', 'Usuário'),
      COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'nickname', NEW.email),
      (NEW.raw_user_meta_data->>'birth_date')::date,
      COALESCE((NEW.raw_user_meta_data->>'is_player')::boolean, false),
      CASE 
        WHEN COALESCE((NEW.raw_user_meta_data->>'is_player')::boolean, false) 
        THEN 'pendente'::player_status  -- ✅ Jogadores começam pendentes
        ELSE 'aprovado'::player_status  -- ✅ Não-jogadores aprovados automaticamente
      END
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Garantir que o trigger está ativo em auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();