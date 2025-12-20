-- 1. CORREÇÃO DE PERMISSÕES (RLS)
-- Remover política antiga se existir para evitar conflito
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

-- Permitir que admins editem qualquer perfil
CREATE POLICY "Admins can update any profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING ( public.is_admin(auth.uid()) )
WITH CHECK ( public.is_admin(auth.uid()) );

-- 2. FUNÇÃO RESET ALL PLAYERS (atualizada com parâmetro opcional)
CREATE OR REPLACE FUNCTION public.reset_all_players(p_keep_admin_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count int;
BEGIN
  -- Validate admin access
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado');
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

  -- Delete all profiles where is_player is true AND user is not the current caller
  DELETE FROM profiles 
  WHERE is_player = true 
  AND (user_id IS NULL OR user_id != auth.uid());
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN json_build_object(
    'success', true, 
    'message', format('Total de %s jogadores excluídos.', v_deleted_count),
    'deleted', v_deleted_count
  );
END;
$$;