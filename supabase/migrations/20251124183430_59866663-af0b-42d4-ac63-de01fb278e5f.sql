-- Sistema de Logs e Monitoramento para Criação de Perfis

-- 1. Criar tabela de auditoria para rastreamento
CREATE TABLE IF NOT EXISTS public.profile_creation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text,
  event_type text NOT NULL, -- 'success', 'error', 'warning'
  message text NOT NULL,
  error_details jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para consulta rápida
CREATE INDEX IF NOT EXISTS idx_profile_logs_user_id ON public.profile_creation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_logs_event_type ON public.profile_creation_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_profile_logs_created_at ON public.profile_creation_logs(created_at DESC);

-- RLS para logs (apenas admins)
ALTER TABLE public.profile_creation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all logs"
ON public.profile_creation_logs
FOR SELECT
USING (is_admin(auth.uid()));

-- 2. Atualizar trigger handle_new_user com logs detalhados
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  normalized_email text;
  profile_exists boolean;
  insert_result record;
BEGIN
  -- Normalizar email
  normalized_email := LOWER(TRIM(NEW.email));
  
  -- Log: Início do processo
  INSERT INTO public.profile_creation_logs (user_id, email, event_type, message, metadata)
  VALUES (
    NEW.id,
    normalized_email,
    'info',
    'Iniciando criação de perfil para novo usuário',
    jsonb_build_object(
      'raw_user_meta_data', NEW.raw_user_meta_data,
      'created_at', NEW.created_at
    )
  );

  -- Verificar se perfil já existe
  SELECT EXISTS(
    SELECT 1 FROM public.profiles WHERE id = NEW.id OR user_id = NEW.id
  ) INTO profile_exists;
  
  IF profile_exists THEN
    -- Log: Perfil já existe
    INSERT INTO public.profile_creation_logs (user_id, email, event_type, message)
    VALUES (
      NEW.id,
      normalized_email,
      'warning',
      'Perfil já existe para este usuário - pulando criação'
    );
    RETURN NEW;
  END IF;

  -- Tentar criar perfil
  BEGIN
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
    ) RETURNING * INTO insert_result;
    
    -- Log: Sucesso
    INSERT INTO public.profile_creation_logs (user_id, email, event_type, message, metadata)
    VALUES (
      NEW.id,
      normalized_email,
      'success',
      'Perfil criado com sucesso',
      jsonb_build_object(
        'profile_id', insert_result.id,
        'is_player', insert_result.is_player,
        'status', insert_result.status
      )
    );
    
  EXCEPTION WHEN OTHERS THEN
    -- Log: Erro detalhado
    INSERT INTO public.profile_creation_logs (user_id, email, event_type, message, error_details)
    VALUES (
      NEW.id,
      normalized_email,
      'error',
      'Falha ao criar perfil',
      jsonb_build_object(
        'error_code', SQLSTATE,
        'error_message', SQLERRM,
        'error_detail', SQLSTATE || ': ' || SQLERRM
      )
    );
    
    -- Re-lançar erro para que o signup falhe visualmente
    RAISE;
  END;

  RETURN NEW;
END;
$$;

-- 3. Criar view para monitoramento de perfis faltantes
CREATE OR REPLACE VIEW public.users_without_profiles AS
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

-- 4. Função helper para admins verificarem status de sincronização
CREATE OR REPLACE FUNCTION public.check_profile_sync_status()
RETURNS TABLE(
  total_users bigint,
  users_with_profiles bigint,
  users_without_profiles bigint,
  recent_errors bigint,
  last_error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem executar esta função';
  END IF;

  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM auth.users)::bigint as total_users,
    (SELECT COUNT(DISTINCT COALESCE(p.user_id, p.id)) FROM public.profiles p)::bigint as users_with_profiles,
    (SELECT COUNT(*) FROM public.users_without_profiles)::bigint as users_without_profiles,
    (SELECT COUNT(*) FROM public.profile_creation_logs WHERE event_type = 'error' AND created_at > now() - interval '24 hours')::bigint as recent_errors,
    (SELECT message FROM public.profile_creation_logs WHERE event_type = 'error' ORDER BY created_at DESC LIMIT 1) as last_error_message;
END;
$$;

-- 5. Criar função de auto-correção (executável por admins)
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
  result json;
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  -- Iterar sobre usuários sem perfil
  FOR missing_user IN 
    SELECT user_id, email FROM public.users_without_profiles
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
      );
      
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

-- Log de confirmação
DO $$
BEGIN
  RAISE NOTICE 'Sistema de monitoramento de perfis implementado com sucesso';
END $$;