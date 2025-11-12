-- Corrigir trigger set_player_key para só gerar player_id em perfis sem user_id (criados por admin)
CREATE OR REPLACE FUNCTION public.set_player_key()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Só gera player_id para perfis criados pelo admin (user_id IS NULL)
  -- Perfis temporários do signup (com user_id) não recebem player_id aqui
  IF NEW.user_id IS NULL
     AND NEW.player_id IS NULL
     AND COALESCE(NEW.is_player, false) = true
     AND NEW.email IS NOT NULL
     AND NEW.birth_date IS NOT NULL
  THEN
    NEW.player_id = public.generate_player_key(NEW.email, NEW.birth_date);
  END IF;
  
  RETURN NEW;
END;
$$;