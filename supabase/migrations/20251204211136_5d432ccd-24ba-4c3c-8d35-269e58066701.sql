-- 1. Sincronizar is_approved com status para todos os perfis existentes
UPDATE public.profiles 
SET is_approved = CASE 
  WHEN status = 'aprovado' THEN true 
  ELSE false 
END;

-- 2. Atualizar função link_player_to_user para também setar is_approved
CREATE OR REPLACE FUNCTION public.link_player_to_user(p_profile_id uuid, p_user_id uuid, p_actor_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_profile RECORD;
  v_temp_profile RECORD;
BEGIN
  SELECT * INTO v_existing_profile
  FROM public.profiles
  WHERE id = p_profile_id AND user_id IS NULL;
  
  IF v_existing_profile IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Perfil não encontrado ou já vinculado a um usuário'
    );
  END IF;
  
  SELECT * INTO v_temp_profile
  FROM public.profiles
  WHERE user_id = p_user_id AND id != p_profile_id;
  
  UPDATE public.profiles
  SET 
    user_id = p_user_id,
    status = 'aprovado'::public.player_status,
    is_approved = true
  WHERE id = p_profile_id;
  
  IF v_temp_profile IS NOT NULL THEN
    DELETE FROM public.profiles WHERE id = v_temp_profile.id;
  END IF;
  
  INSERT INTO public.audit_log (action, actor_id, target_profile_id, metadata)
  VALUES (
    'link_player_to_user',
    COALESCE(p_actor_id, auth.uid()),
    p_profile_id,
    jsonb_build_object(
      'user_id', p_user_id,
      'temp_profile_deleted', v_temp_profile IS NOT NULL,
      'temp_profile_id', v_temp_profile.id
    )
  );
  
  RETURN json_build_object(
    'success', true,
    'message', 'Jogador vinculado com sucesso',
    'profile_id', p_profile_id,
    'temp_deleted', v_temp_profile IS NOT NULL
  );
END;
$function$;

-- 3. Remover trigger obsoleto
DROP TRIGGER IF EXISTS trg_handle_profile_created ON public.profiles;
DROP FUNCTION IF EXISTS public.handle_profile_created();

-- 4. Atualizar handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  normalized_email text;
  profile_exists boolean;
  is_player_signup boolean;
  parsed_birth_date date;
BEGIN
  normalized_email := LOWER(TRIM(NEW.email));
  is_player_signup := COALESCE((NEW.raw_user_meta_data->>'is_player')::boolean, false);
  
  BEGIN
    parsed_birth_date := (NULLIF(NEW.raw_user_meta_data->>'birth_date', ''))::date;
  EXCEPTION WHEN OTHERS THEN
    parsed_birth_date := NULL;
  END;
  
  SELECT EXISTS(
    SELECT 1 FROM public.profiles 
    WHERE LOWER(TRIM(email)) = normalized_email
  ) INTO profile_exists;
  
  IF profile_exists THEN
    UPDATE public.profiles
    SET 
      user_id = NEW.id,
      status = 'aprovado'::public.player_status,
      is_approved = true,
      first_name = COALESCE(NEW.raw_user_meta_data->>'first_name', first_name),
      last_name = COALESCE(NEW.raw_user_meta_data->>'last_name', last_name)
    WHERE LOWER(TRIM(email)) = normalized_email
      AND user_id IS NULL;
  ELSE
    INSERT INTO public.profiles (
      id, user_id, email, name, first_name, last_name, nickname, birth_date, is_player, status, is_approved
    ) VALUES (
      NEW.id, NEW.id, normalized_email,
      COALESCE(NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'first_name', '') || ' ' || COALESCE(NEW.raw_user_meta_data->>'last_name', '')), ''), NEW.raw_user_meta_data->>'name', 'Usuário'),
      COALESCE(NEW.raw_user_meta_data->>'first_name', 'Usuário'),
      COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'nickname', NEW.raw_user_meta_data->>'first_name', SPLIT_PART(NEW.email, '@', 1)),
      parsed_birth_date,
      is_player_signup,
      CASE WHEN is_player_signup THEN 'pendente'::public.player_status ELSE 'aprovado'::public.player_status END,
      CASE WHEN is_player_signup THEN false ELSE true END
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- 5. Remover CONSTRAINT redundante (não índice)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_email_key;

-- 6. Limpar dados órfãos
DELETE FROM public.players WHERE user_id IS NOT NULL;

-- 7. Atualizar política RLS
DROP POLICY IF EXISTS "Authenticated users can view approved profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view approved profiles" 
ON public.profiles 
FOR SELECT 
USING (status = 'aprovado'::public.player_status);

-- 8. Trigger para sincronizar is_approved automaticamente
CREATE OR REPLACE FUNCTION public.sync_is_approved_with_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  NEW.is_approved = (NEW.status = 'aprovado'::public.player_status);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_is_approved ON public.profiles;
CREATE TRIGGER trg_sync_is_approved
BEFORE INSERT OR UPDATE OF status ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_is_approved_with_status();