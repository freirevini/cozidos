-- 1. Adicionar coluna email às tabelas necessárias
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Criar índice único para email em profiles
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique ON public.profiles(email) WHERE email IS NOT NULL;

-- Adicionar coluna email à tabela player_rankings
ALTER TABLE public.player_rankings 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Criar índice único para email em player_rankings
CREATE UNIQUE INDEX IF NOT EXISTS player_rankings_email_unique ON public.player_rankings(email) WHERE email IS NOT NULL;

-- 2. Atualizar trigger de criação de usuário para vincular por email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  existing_profile_id UUID;
BEGIN
  -- Procurar perfil existente com o mesmo email
  SELECT id INTO existing_profile_id
  FROM public.profiles
  WHERE email = NEW.email
  LIMIT 1;

  IF existing_profile_id IS NOT NULL THEN
    -- Vincular perfil existente ao usuário autenticado
    UPDATE public.profiles
    SET 
      user_id = NEW.id,
      status = 'aprovado'
    WHERE id = existing_profile_id;
  ELSE
    -- Criar novo perfil pendente
    INSERT INTO public.profiles (
      id,
      user_id,
      email,
      name,
      nickname,
      is_player,
      status
    )
    VALUES (
      gen_random_uuid(),
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'name', 'Usuário'),
      NEW.raw_user_meta_data->>'nickname',
      COALESCE((NEW.raw_user_meta_data->>'is_player')::boolean, false),
      'pendente'
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. Criar função RPC para reset completo do sistema
CREATE OR REPLACE FUNCTION public.reset_all_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Verificar se o usuário é admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem executar esta função';
  END IF;

  -- Deletar em ordem respeitando constraints de foreign key
  DELETE FROM public.assists;
  DELETE FROM public.goals;
  DELETE FROM public.cards;
  DELETE FROM public.punishments;
  DELETE FROM public.player_round_stats;
  DELETE FROM public.player_attendance;
  DELETE FROM public.round_team_players;
  DELETE FROM public.round_teams;
  DELETE FROM public.matches;
  DELETE FROM public.rounds;
  DELETE FROM public.player_rankings;
  
  -- Deletar apenas perfis sem user_id (não autenticados)
  DELETE FROM public.profiles WHERE user_id IS NULL;
END;
$function$;

-- 4. Atualizar políticas RLS para usar user_id ao invés de id
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);