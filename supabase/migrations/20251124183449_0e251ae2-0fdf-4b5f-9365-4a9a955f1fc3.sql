-- Correção de Segurança: Remover view e substituir por função restrita a admins

-- 1. Remover a view que expõe auth.users
DROP VIEW IF EXISTS public.users_without_profiles;

-- 2. Criar função segura para admins consultarem usuários sem perfis
CREATE OR REPLACE FUNCTION public.get_users_without_profiles()
RETURNS TABLE(
  user_id uuid,
  email text,
  user_created_at timestamptz,
  email_confirmed_at timestamptz,
  last_log_time timestamptz,
  last_event_type text,
  last_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Apenas admins podem executar
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem executar esta função';
  END IF;

  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.email,
    u.created_at as user_created_at,
    u.email_confirmed_at,
    (SELECT MAX(created_at) 
     FROM public.profile_creation_logs 
     WHERE user_id = u.id) as last_log_time,
    (SELECT event_type 
     FROM public.profile_creation_logs 
     WHERE user_id = u.id 
     ORDER BY created_at DESC 
     LIMIT 1) as last_event_type,
    (SELECT message 
     FROM public.profile_creation_logs 
     WHERE user_id = u.id 
     ORDER BY created_at DESC 
     LIMIT 1) as last_message
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id OR p.user_id = u.id
  WHERE p.id IS NULL
  ORDER BY u.created_at DESC;
END;
$$;

-- 3. Garantir que a função sync_missing_profiles use a nova função
CREATE OR REPLACE FUNCTION public.sync_missing_profiles()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  missing_user record;
  created_count integer := 0;
  error_count integer := 0;
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  -- Usar a função segura para obter usuários sem perfil
  FOR missing_user IN 
    SELECT user_id, email FROM public.get_users_without_profiles()
  LOOP
    BEGIN
      -- Tentar criar perfil
      INSERT INTO public.profiles (id, user_id, email, name, is_player, status)
      VALUES (
        missing_user.user_id,
        missing_user.user_id,
        missing_user.email,
        'Usuário',
        false,
        'aprovado'::public.player_status
      )
      ON CONFLICT (id) DO NOTHING;
      
      created_count := created_count + 1;
      
      -- Log sucesso
      INSERT INTO public.profile_creation_logs (user_id, email, event_type, message)
      VALUES (
        missing_user.user_id,
        missing_user.email,
        'success',
        'Perfil criado via sync_missing_profiles'
      );
      
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      
      -- Log erro
      INSERT INTO public.profile_creation_logs (user_id, email, event_type, message, error_details)
      VALUES (
        missing_user.user_id,
        missing_user.email,
        'error',
        'Falha ao criar perfil via sync_missing_profiles',
        jsonb_build_object('error', SQLERRM)
      );
    END;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'profiles_created', created_count,
    'errors', error_count,
    'message', format('Sincronização concluída: %s perfis criados, %s erros', created_count, error_count)
  );
END;
$$;