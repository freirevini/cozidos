-- ========================================
-- OPÇÃO 3: Signup Flow com Chave Determinística Simples
-- ========================================

-- 1) FUNÇÃO: Gerar chave determinística (ddMMyyyy + email sanitizado)
CREATE OR REPLACE FUNCTION public.generate_player_key(p_email text, p_birth_date date)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_email IS NULL OR p_birth_date IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN to_char(p_birth_date, 'DDMMYYYY') || 
         regexp_replace(lower(trim(p_email)), '[^a-z0-9]', '', 'g');
END;
$$;

-- 2) TRIGGER FUNCTION: Preencher player_id automaticamente
CREATE OR REPLACE FUNCTION public.set_player_key()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.player_id IS NULL 
     AND COALESCE(NEW.is_player, false) = true
     AND NEW.email IS NOT NULL
     AND NEW.birth_date IS NOT NULL
  THEN
    NEW.player_id = public.generate_player_key(NEW.email, NEW.birth_date);
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3) LIMPEZA: Remover funções/triggers antigas
DROP TRIGGER IF EXISTS trg_update_player_id ON public.profiles;
DROP FUNCTION IF EXISTS public.update_player_id();
DROP FUNCTION IF EXISTS public.generate_player_id(text, date);

-- 4) CRIAR NOVO TRIGGER
DROP TRIGGER IF EXISTS trg_profiles_set_player_key ON public.profiles;
CREATE TRIGGER trg_profiles_set_player_key
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_player_key();

-- 5) ÍNDICE ÚNICO (sem CONCURRENTLY para permitir em transaction)
DROP INDEX IF EXISTS idx_profiles_player_id_unique;
CREATE UNIQUE INDEX idx_profiles_player_id_unique 
  ON public.profiles (player_id) 
  WHERE player_id IS NOT NULL;

-- 6) BACKFILL: Atualizar player_id existentes
UPDATE public.profiles
SET player_id = public.generate_player_key(email, birth_date)
WHERE is_player = true
  AND email IS NOT NULL
  AND birth_date IS NOT NULL
  AND (player_id IS NULL OR length(player_id) >= 64);