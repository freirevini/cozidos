-- Fix reset_player_rankings function to use TRUNCATE instead of DELETE
CREATE OR REPLACE FUNCTION public.reset_player_rankings()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate admin access
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado: apenas administradores podem executar esta função');
  END IF;

  -- Use TRUNCATE instead of DELETE to avoid WHERE clause requirement
  TRUNCATE TABLE public.player_rankings;
  
  RETURN json_build_object('success', true, 'message', 'Classificação resetada com sucesso');
END;
$$;