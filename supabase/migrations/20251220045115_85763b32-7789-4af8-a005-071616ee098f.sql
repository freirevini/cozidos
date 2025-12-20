-- Recriar função reset_all_players com assinatura estável e sem deletes sem WHERE

-- Remover funções antigas (ambas assinaturas) para evitar conflitos
DROP FUNCTION IF EXISTS public.reset_all_players();
DROP FUNCTION IF EXISTS public.reset_all_players(uuid);

-- Criar função (SECURITY DEFINER) com checagem de admin
CREATE OR REPLACE FUNCTION public.reset_all_players(p_keep_admin_id uuid)
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

  -- Proteção: o ID a manter deve ser o do próprio chamador
  IF p_keep_admin_id IS NULL OR p_keep_admin_id != auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Parâmetro inválido');
  END IF;

  -- Limpar dados (com WHERE para evitar erro "DELETE requires a WHERE clause")
  DELETE FROM public.assists WHERE true;
  DELETE FROM public.goals WHERE true;
  DELETE FROM public.cards WHERE true;
  DELETE FROM public.substitutions WHERE true;
  DELETE FROM public.punishments WHERE true;
  DELETE FROM public.player_round_stats WHERE true;
  DELETE FROM public.player_attendance WHERE true;
  DELETE FROM public.round_team_players WHERE true;
  DELETE FROM public.round_teams WHERE true;
  DELETE FROM public.matches WHERE true;
  DELETE FROM public.rounds WHERE true;
  DELETE FROM public.player_ranking_adjustments WHERE true;
  DELETE FROM public.player_rankings WHERE true;

  -- Deleta todos os perfis de jogadores EXCETO o do admin logado
  DELETE FROM public.profiles
  WHERE is_player = true
    AND (user_id IS NULL OR user_id != p_keep_admin_id);

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'message', format('Total de %s jogadores excluídos.', v_deleted_count),
    'deleted', v_deleted_count
  );
END;
$$;

-- Garantir permissão de execução
GRANT EXECUTE ON FUNCTION public.reset_all_players(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_all_players(uuid) TO service_role;