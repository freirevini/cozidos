-- Fix merge_players to NOT call recalc_all_player_rankings
-- This prevents imported classification data from being zeroed when linking users
-- Migration: 20251226_fix_merge_players_no_recalc.sql

CREATE OR REPLACE FUNCTION public.merge_players(
  p_source_id uuid,
  p_target_id uuid,
  p_actor_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_source RECORD;
  v_target RECORD;
  v_goals_moved int := 0;
  v_assists_moved int := 0;
  v_cards_moved int := 0;
  v_stats_moved int := 0;
  v_attendance_moved int := 0;
  v_team_players_moved int := 0;
  v_punishments_moved int := 0;
BEGIN
  -- Validar permissão admin
  IF NOT public.is_admin(COALESCE(p_actor_id, auth.uid())) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado: apenas administradores podem executar merge');
  END IF;

  -- Buscar perfis
  SELECT * INTO v_source FROM public.profiles WHERE id = p_source_id;
  SELECT * INTO v_target FROM public.profiles WHERE id = p_target_id;
  
  IF v_source IS NULL OR v_target IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Perfil fonte ou destino não encontrado');
  END IF;
  
  IF p_source_id = p_target_id THEN
    RETURN json_build_object('success', false, 'error', 'Perfil fonte e destino são o mesmo');
  END IF;

  -- Mover goals
  UPDATE public.goals SET player_id = p_target_id WHERE player_id = p_source_id;
  GET DIAGNOSTICS v_goals_moved = ROW_COUNT;
  
  -- Mover assists
  UPDATE public.assists SET player_id = p_target_id WHERE player_id = p_source_id;
  GET DIAGNOSTICS v_assists_moved = ROW_COUNT;
  
  -- Mover cards
  UPDATE public.cards SET player_id = p_target_id WHERE player_id = p_source_id;
  GET DIAGNOSTICS v_cards_moved = ROW_COUNT;
  
  -- Mover punishments
  UPDATE public.punishments SET player_id = p_target_id WHERE player_id = p_source_id;
  GET DIAGNOSTICS v_punishments_moved = ROW_COUNT;
  
  -- Mover player_attendance (com ON CONFLICT para evitar duplicatas)
  UPDATE public.player_attendance SET player_id = p_target_id 
  WHERE player_id = p_source_id 
  AND NOT EXISTS (
    SELECT 1 FROM public.player_attendance pa2 
    WHERE pa2.player_id = p_target_id AND pa2.round_id = player_attendance.round_id
  );
  GET DIAGNOSTICS v_attendance_moved = ROW_COUNT;
  
  -- Remover attendance duplicados restantes do source
  DELETE FROM public.player_attendance WHERE player_id = p_source_id;
  
  -- Mover round_team_players (com verificação de duplicatas)
  UPDATE public.round_team_players SET player_id = p_target_id 
  WHERE player_id = p_source_id
  AND NOT EXISTS (
    SELECT 1 FROM public.round_team_players rtp2 
    WHERE rtp2.player_id = p_target_id AND rtp2.round_id = round_team_players.round_id
  );
  GET DIAGNOSTICS v_team_players_moved = ROW_COUNT;
  
  -- Remover team_players duplicados restantes do source
  DELETE FROM public.round_team_players WHERE player_id = p_source_id;
  
  -- Mover player_round_stats (com verificação de duplicatas)
  UPDATE public.player_round_stats SET player_id = p_target_id 
  WHERE player_id = p_source_id
  AND NOT EXISTS (
    SELECT 1 FROM public.player_round_stats prs2 
    WHERE prs2.player_id = p_target_id AND prs2.round_id = player_round_stats.round_id
  );
  GET DIAGNOSTICS v_stats_moved = ROW_COUNT;
  
  -- Remover stats duplicados restantes do source
  DELETE FROM public.player_round_stats WHERE player_id = p_source_id;
  
  -- Mover ranking_adjustments (PRESERVA dados importados via CSV)
  UPDATE public.player_ranking_adjustments SET player_id = p_target_id WHERE player_id = p_source_id;
  
  -- Remover player_rankings do source
  DELETE FROM public.player_rankings WHERE player_id = p_source_id;
  
  -- Registrar no audit_log ANTES de deletar source
  INSERT INTO public.audit_log (action, actor_id, target_profile_id, source_profile_id, metadata)
  VALUES (
    'merge_players',
    COALESCE(p_actor_id, auth.uid()),
    p_target_id,
    p_source_id,
    jsonb_build_object(
      'source_email', v_source.email,
      'source_name', v_source.name,
      'target_email', v_target.email,
      'target_name', v_target.name,
      'goals_moved', v_goals_moved,
      'assists_moved', v_assists_moved,
      'cards_moved', v_cards_moved,
      'punishments_moved', v_punishments_moved,
      'attendance_moved', v_attendance_moved,
      'team_players_moved', v_team_players_moved,
      'stats_moved', v_stats_moved
    )
  );
  
  -- Deletar perfil fonte
  DELETE FROM public.profiles WHERE id = p_source_id;
  
  -- ============================================================
  -- CRITICAL FIX: Removed recalc_all_player_rankings() call
  -- This was causing imported CSV data to be zeroed out
  -- Rankings will be updated naturally when real matches occur
  -- ============================================================
  -- REMOVED: PERFORM public.recalc_all_player_rankings();
  
  RETURN json_build_object(
    'success', true,
    'message', 'Merge realizado com sucesso (sem recalc)',
    'records_moved', jsonb_build_object(
      'goals', v_goals_moved,
      'assists', v_assists_moved,
      'cards', v_cards_moved,
      'punishments', v_punishments_moved,
      'attendance', v_attendance_moved,
      'team_players', v_team_players_moved,
      'stats', v_stats_moved
    )
  );
END;
$$;
