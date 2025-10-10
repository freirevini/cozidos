-- Função para normalizar email (lowercase e trim)
CREATE OR REPLACE FUNCTION public.normalize_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email = LOWER(TRIM(NEW.email));
  END IF;
  RETURN NEW;
END;
$function$;

-- Trigger para normalizar email em profiles
DROP TRIGGER IF EXISTS normalize_email_trigger ON public.profiles;
CREATE TRIGGER normalize_email_trigger
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.normalize_email();

-- Trigger para normalizar email em player_rankings
DROP TRIGGER IF EXISTS normalize_email_ranking_trigger ON public.player_rankings;
CREATE TRIGGER normalize_email_ranking_trigger
BEFORE INSERT OR UPDATE ON public.player_rankings
FOR EACH ROW EXECUTE FUNCTION public.normalize_email();

-- Atualizar função reset_all_data para deletar em ordem correta respeitando FKs
CREATE OR REPLACE FUNCTION public.reset_all_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

-- Criar função para deletar jogador individual por email
CREATE OR REPLACE FUNCTION public.delete_player_by_email(player_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  profile_id UUID;
BEGIN
  -- Verificar se o usuário é admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem executar esta função';
  END IF;

  -- Normalizar email
  player_email := LOWER(TRIM(player_email));

  -- Buscar o ID do perfil
  SELECT id INTO profile_id FROM public.profiles WHERE email = player_email;

  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'Jogador não encontrado com o email: %', player_email;
  END IF;

  -- Deletar registros relacionados em ordem
  DELETE FROM public.assists WHERE player_id IN (
    SELECT id FROM public.players WHERE user_id = profile_id
  );
  
  DELETE FROM public.goals WHERE player_id IN (
    SELECT id FROM public.players WHERE user_id = profile_id
  );
  
  DELETE FROM public.cards WHERE player_id IN (
    SELECT id FROM public.players WHERE user_id = profile_id
  );
  
  DELETE FROM public.punishments WHERE player_id IN (
    SELECT id FROM public.players WHERE user_id = profile_id
  );
  
  DELETE FROM public.player_round_stats WHERE player_id IN (
    SELECT id FROM public.players WHERE user_id = profile_id
  );
  
  DELETE FROM public.player_attendance WHERE player_id IN (
    SELECT id FROM public.players WHERE user_id = profile_id
  );
  
  DELETE FROM public.round_team_players WHERE player_id IN (
    SELECT id FROM public.players WHERE user_id = profile_id
  );
  
  -- Deletar da classificação
  DELETE FROM public.player_rankings WHERE email = player_email;
  
  -- Deletar da tabela de jogadores
  DELETE FROM public.players WHERE user_id = profile_id;
  
  -- Deletar o perfil apenas se não tiver user_id (não está autenticado)
  DELETE FROM public.profiles WHERE id = profile_id AND user_id IS NULL;
END;
$function$;

-- Criar função para deletar jogador por ID
CREATE OR REPLACE FUNCTION public.delete_player_by_id(profile_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  player_email TEXT;
BEGIN
  -- Verificar se o usuário é admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem executar esta função';
  END IF;

  -- Buscar o email do perfil
  SELECT email INTO player_email FROM public.profiles WHERE id = profile_id;

  IF player_email IS NULL THEN
    RAISE EXCEPTION 'Jogador não encontrado';
  END IF;

  -- Chamar a função de deletar por email
  PERFORM public.delete_player_by_email(player_email);
END;
$function$;