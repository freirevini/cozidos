-- Corrigir avisos de segurança: adicionar search_path às funções

-- Corrigir generate_player_id
CREATE OR REPLACE FUNCTION generate_player_id(p_email text, p_birth_date date)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path TO 'public'
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

-- Corrigir update_player_id
CREATE OR REPLACE FUNCTION update_player_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email IS NOT NULL AND NEW.birth_date IS NOT NULL AND NEW.is_player THEN
    NEW.player_id = generate_player_id(NEW.email, NEW.birth_date);
  END IF;
  RETURN NEW;
END;
$$;