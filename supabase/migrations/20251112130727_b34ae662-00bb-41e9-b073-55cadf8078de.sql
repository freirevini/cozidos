-- Opção 3: Trigger básico + Edge Function robusta com cleanup de perfis temporários

-- Recriar handle_new_user: apenas cria perfil básico e temporário (SEM player_id)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  normalized_email text;
BEGIN
  normalized_email := LOWER(TRIM(NEW.email));

  -- Criar perfil básico e temporário
  -- A Edge Function link-player irá:
  --   1) Gerar player_id determinístico
  --   2) Buscar perfil existente por player_id
  --   3) Se encontrar: vincular user_id ao perfil existente e deletar este temporário
  --   4) Se não encontrar: atualizar este temporário com player_id correto
  
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
  -- NÃO gera player_id aqui - deixa para a Edge Function

  RETURN NEW;
END;
$function$;

-- Recriar trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE PROCEDURE public.handle_new_user();

-- Comentário explicativo
COMMENT ON FUNCTION public.handle_new_user() IS 'Cria perfil básico temporário. A Edge Function link-player faz matching determinístico e cleanup.';