-- FASE 1: Correção imediata do erro de cadastro + adicionar campos necessários

-- 1.1. Adicionar campos first_name e last_name em profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS player_id text UNIQUE;

-- 1.2. Índice único para matching email + birthdate (vinculação determinística)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_birthdate 
  ON profiles (LOWER(TRIM(email)), birth_date) 
  WHERE email IS NOT NULL AND birth_date IS NOT NULL;

-- 1.3. Corrigir trigger handle_new_user com fallbacks adequados
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  existing_profile_id UUID;
BEGIN
  SELECT id INTO existing_profile_id
  FROM public.profiles
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(NEW.email))
  LIMIT 1;

  IF existing_profile_id IS NOT NULL THEN
    -- Vincular perfil existente ao usuário autenticado
    UPDATE public.profiles
    SET 
      user_id = NEW.id,
      status = 'aprovado'
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
      is_player,
      status
    )
    VALUES (
      gen_random_uuid(),
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'name', 'Usuário'),
      COALESCE(NEW.raw_user_meta_data->>'first_name', 'Usuário'),
      COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'nickname', NEW.email),
      COALESCE((NEW.raw_user_meta_data->>'is_player')::boolean, false),
      CASE 
        WHEN COALESCE((NEW.raw_user_meta_data->>'is_player')::boolean, false) 
        THEN 'pendente'
        ELSE 'aprovado'
      END
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 1.4. Função para gerar player_id determinístico (SHA256 de email + birthdate)
CREATE OR REPLACE FUNCTION generate_player_id(p_email text, p_birth_date date)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_email IS NULL OR p_birth_date IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN encode(
    digest(
      LOWER(TRIM(p_email)) || '|' || p_birth_date::text,
      'sha256'
    ),
    'hex'
  );
END;
$$;

-- 1.5. Trigger para gerar player_id automaticamente
CREATE OR REPLACE FUNCTION update_player_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.email IS NOT NULL AND NEW.birth_date IS NOT NULL AND NEW.is_player THEN
    NEW.player_id = generate_player_id(NEW.email, NEW.birth_date);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_player_id ON profiles;
CREATE TRIGGER trg_update_player_id
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_player_id();

-- 1.6. Migrar dados de first_name/last_name de name (se ainda não existirem)
UPDATE profiles
SET 
  first_name = COALESCE(first_name, SPLIT_PART(name, ' ', 1)),
  last_name = COALESCE(last_name, SUBSTRING(name FROM POSITION(' ' IN name) + 1))
WHERE first_name IS NULL OR last_name IS NULL;