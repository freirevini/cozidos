-- Enable pgcrypto extension for digest function
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- Recreate generate_player_id function with proper encoding
CREATE OR REPLACE FUNCTION public.generate_player_id(p_email text, p_birth_date date)
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
      convert_to(LOWER(TRIM(p_email)) || '|' || p_birth_date::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );
END;
$$;

-- Recreate update_player_id trigger function with better guards
CREATE OR REPLACE FUNCTION public.update_player_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only generate player_id if it's NULL and user is a player with required fields
  IF NEW.player_id IS NULL
     AND COALESCE(NEW.is_player, false) = true
     AND NEW.email IS NOT NULL
     AND NEW.birth_date IS NOT NULL
  THEN
    NEW.player_id = public.generate_player_id(NEW.email, NEW.birth_date);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS trg_update_player_id ON public.profiles;
CREATE TRIGGER trg_update_player_id
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_player_id();