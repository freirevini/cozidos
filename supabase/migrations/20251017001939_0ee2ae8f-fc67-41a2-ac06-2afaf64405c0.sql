-- Strengthen player deletion to remove all related data and the profile regardless of user linkage
CREATE OR REPLACE FUNCTION public.delete_player_by_email(player_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  profile_id UUID;
BEGIN
  -- Ensure only admins can execute
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem executar esta função';
  END IF;

  -- Normalize email
  player_email := LOWER(TRIM(player_email));

  -- Find the profile id by email
  SELECT id INTO profile_id FROM public.profiles WHERE email = player_email;

  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'Jogador não encontrado com o email: %', player_email;
  END IF;

  -- Delete records from all related tables using player ids linked to this profile
  DELETE FROM public.assists WHERE player_id IN (SELECT id FROM public.players WHERE user_id = profile_id);
  DELETE FROM public.goals WHERE player_id IN (SELECT id FROM public.players WHERE user_id = profile_id);
  DELETE FROM public.cards WHERE player_id IN (SELECT id FROM public.players WHERE user_id = profile_id);
  DELETE FROM public.punishments WHERE player_id IN (SELECT id FROM public.players WHERE user_id = profile_id);
  DELETE FROM public.player_round_stats WHERE player_id IN (SELECT id FROM public.players WHERE user_id = profile_id);
  DELETE FROM public.player_attendance WHERE player_id IN (SELECT id FROM public.players WHERE user_id = profile_id);
  DELETE FROM public.round_team_players WHERE player_id IN (SELECT id FROM public.players WHERE user_id = profile_id);

  -- Delete rankings by player_id or email
  DELETE FROM public.player_rankings 
    WHERE player_id IN (SELECT id FROM public.players WHERE user_id = profile_id)
       OR LOWER(email) = player_email;

  -- Delete the player row(s)
  DELETE FROM public.players WHERE user_id = profile_id;

  -- Remove roles for this profile if any
  DELETE FROM public.user_roles WHERE user_id = profile_id;

  -- Finally delete the profile regardless of user linkage
  DELETE FROM public.profiles WHERE id = profile_id;
END;
$function$;

-- Keep helper that deletes by profile id, now guaranteed to remove profile as well
CREATE OR REPLACE FUNCTION public.delete_player_by_id(profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  player_email TEXT;
BEGIN
  -- Ensure only admins can execute
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem executar esta função';
  END IF;

  -- Try to resolve email and reuse email-based deletion for consistent behavior
  SELECT email INTO player_email FROM public.profiles WHERE id = profile_id;

  IF player_email IS NOT NULL THEN
    PERFORM public.delete_player_by_email(player_email);
    RETURN;
  END IF;

  -- Fallback path when email is null
  DELETE FROM public.assists WHERE player_id IN (SELECT id FROM public.players WHERE user_id = profile_id);
  DELETE FROM public.goals WHERE player_id IN (SELECT id FROM public.players WHERE user_id = profile_id);
  DELETE FROM public.cards WHERE player_id IN (SELECT id FROM public.players WHERE user_id = profile_id);
  DELETE FROM public.punishments WHERE player_id IN (SELECT id FROM public.players WHERE user_id = profile_id);
  DELETE FROM public.player_round_stats WHERE player_id IN (SELECT id FROM public.players WHERE user_id = profile_id);
  DELETE FROM public.player_attendance WHERE player_id IN (SELECT id FROM public.players WHERE user_id = profile_id);
  DELETE FROM public.round_team_players WHERE player_id IN (SELECT id FROM public.players WHERE user_id = profile_id);
  DELETE FROM public.player_rankings WHERE player_id IN (SELECT id FROM public.players WHERE user_id = profile_id);

  DELETE FROM public.players WHERE user_id = profile_id;
  DELETE FROM public.user_roles WHERE user_id = profile_id;
  DELETE FROM public.profiles WHERE id = profile_id;
END;
$function$;