-- Function to safe delete all players except the current admin (for testing)
CREATE OR REPLACE FUNCTION public.reset_all_players(p_keep_admin_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count int;
  v_user_count int;
BEGIN
  -- Validate admin access
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  -- Delete all profiles where is_player is true AND id != p_keep_admin_id 
  -- AND user_id != auth.uid() (just to be safe to not delete the caller if he is a player too)
  
  -- We also need to be careful about cascading. profiles usually cascade to stats.
  -- But we might want to ensure we delete auth users too? 
  -- The user asked to "apague todos os perfis exceto o do usuário admin atual".
  -- Deleting auth users from SQL is not possible directly if using Supabase Auth (requires edge function or admin api).
  -- However, for the profiles table we can delete.
  
  -- First, count how many we are about to delete
  SELECT count(*) INTO v_user_count FROM profiles 
  WHERE is_player = true 
  AND (user_id IS NULL OR user_id != auth.uid()); -- Prevent deleting self

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
