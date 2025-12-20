-- Função para resetar todos os jogadores (dados e estatísticas)
CREATE OR REPLACE FUNCTION public.reset_all_players()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validar acesso admin
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado: apenas administradores podem executar esta função');
  END IF;

  -- Deletar em ordem respeitando constraints de foreign key
  DELETE FROM public.assists;
  DELETE FROM public.goals;
  DELETE FROM public.cards;
  DELETE FROM public.substitutions;
  DELETE FROM public.punishments;
  DELETE FROM public.player_round_stats;
  DELETE FROM public.player_attendance;
  DELETE FROM public.round_team_players;
  DELETE FROM public.round_teams;
  DELETE FROM public.matches;
  DELETE FROM public.rounds;
  DELETE FROM public.player_ranking_adjustments;
  DELETE FROM public.player_rankings;
  
  -- Deletar apenas perfis criados pelo admin (sem user_id)
  DELETE FROM public.profiles WHERE user_id IS NULL;
  
  RETURN json_build_object('success', true, 'message', 'Todos os dados de jogadores foram resetados com sucesso');
END;
$function$;