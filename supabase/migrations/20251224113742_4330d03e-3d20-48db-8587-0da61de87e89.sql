-- Atualizar função import_players_csv para incluir posição
CREATE OR REPLACE FUNCTION public.import_players_csv(p_rows jsonb, p_actor_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row jsonb;
  v_nickname text;
  v_level text;
  v_position text;
  v_existing_id uuid;
  v_new_id uuid;
  v_token text;
  v_created int := 0;
  v_updated int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_results jsonb := '[]'::jsonb;
  v_row_index int := 0;
  v_duplicate_count int;
BEGIN
  -- Validate admin access
  IF NOT public.is_admin(COALESCE(p_actor_id, auth.uid())) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado: apenas administradores podem importar jogadores');
  END IF;

  -- Process each row
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_row_index := v_row_index + 1;
    v_nickname := TRIM(COALESCE(v_row->>'nickname', v_row->>'Nickname', ''));
    v_level := UPPER(TRIM(COALESCE(v_row->>'level', v_row->>'Level', v_row->>'Nivel', v_row->>'nivel', '')));
    v_position := LOWER(TRIM(COALESCE(v_row->>'Position', v_row->>'position', v_row->>'Posicao', v_row->>'posicao', '')));
    
    -- Validate required fields
    IF v_nickname = '' THEN
      v_errors := v_errors || jsonb_build_object('row', v_row_index, 'error', 'Nickname é obrigatório', 'data', v_row);
      CONTINUE;
    END IF;
    
    IF v_level = '' OR v_level NOT IN ('A', 'B', 'C', 'D', 'E') THEN
      v_errors := v_errors || jsonb_build_object('row', v_row_index, 'error', 'Level inválido (deve ser A, B, C, D ou E)', 'data', v_row);
      CONTINUE;
    END IF;
    
    -- Normalize position (accept various aliases)
    IF v_position IN ('gol', 'gk', 'goalkeeper', 'g', 'goleiro') THEN
      v_position := 'goleiro';
    ELSIF v_position IN ('zagueiro', 'lateral', 'def', 'd', 'defender', 'beque', 'defensor') THEN
      v_position := 'defensor';
    ELSIF v_position IN ('meio', 'meia', 'volante', 'mid', 'm', 'meio-campista', 'meio_campo', 'midfielder', 'meiocampo') THEN
      v_position := 'meio-campista';
    ELSIF v_position IN ('ponta', 'centroavante', 'ata', 'fwd', 'a', 'striker', 'attack', 'atacante') THEN
      v_position := 'atacante';
    ELSIF v_position = '' THEN
      -- Position is optional for backward compatibility, default to meio-campista
      v_position := 'meio-campista';
    ELSE
      -- Try to match partial strings
      IF v_position LIKE '%gol%' THEN
        v_position := 'goleiro';
      ELSIF v_position LIKE '%def%' OR v_position LIKE '%zag%' OR v_position LIKE '%lat%' THEN
        v_position := 'defensor';
      ELSIF v_position LIKE '%mei%' OR v_position LIKE '%vol%' THEN
        v_position := 'meio-campista';
      ELSIF v_position LIKE '%ata%' OR v_position LIKE '%pon%' THEN
        v_position := 'atacante';
      ELSE
        v_position := 'meio-campista'; -- fallback
      END IF;
    END IF;
    
    -- Check for duplicate nicknames
    SELECT COUNT(*) INTO v_duplicate_count
    FROM public.profiles
    WHERE LOWER(nickname) = LOWER(v_nickname);
    
    IF v_duplicate_count > 1 THEN
      v_errors := v_errors || jsonb_build_object('row', v_row_index, 'error', format('Nickname "%s" corresponde a %s perfis. Corrija manualmente.', v_nickname, v_duplicate_count), 'data', v_row);
      CONTINUE;
    END IF;
    
    -- Try to find existing profile by nickname
    SELECT id INTO v_existing_id
    FROM public.profiles
    WHERE LOWER(nickname) = LOWER(v_nickname)
    LIMIT 1;
    
    IF v_existing_id IS NOT NULL THEN
      -- Update existing profile (level and position)
      UPDATE public.profiles
      SET 
        level = v_level::public.player_level,
        position = v_position::public.player_position
      WHERE id = v_existing_id;
      
      -- Generate token if missing
      SELECT claim_token INTO v_token FROM public.profiles WHERE id = v_existing_id;
      IF v_token IS NULL THEN
        v_token := public.generate_claim_token(v_existing_id);
      END IF;
      
      v_updated := v_updated + 1;
      v_results := v_results || jsonb_build_object('row', v_row_index, 'action', 'updated', 'profile_id', v_existing_id, 'nickname', v_nickname, 'claim_token', v_token);
    ELSE
      -- Create new profile with position
      v_new_id := gen_random_uuid();
      
      INSERT INTO public.profiles (id, name, nickname, level, position, is_player, status, created_by_admin_simple)
      VALUES (v_new_id, v_nickname, v_nickname, v_level::public.player_level, v_position::public.player_position, true, 'aprovado', true);
      
      -- Generate claim token
      v_token := public.generate_claim_token(v_new_id);
      
      v_created := v_created + 1;
      v_results := v_results || jsonb_build_object('row', v_row_index, 'action', 'created', 'profile_id', v_new_id, 'nickname', v_nickname, 'claim_token', v_token);
    END IF;
  END LOOP;
  
  -- Log audit
  INSERT INTO public.audit_log (action, actor_id, metadata)
  VALUES (
    'import_players_csv',
    COALESCE(p_actor_id, auth.uid()),
    jsonb_build_object('created', v_created, 'updated', v_updated, 'errors_count', jsonb_array_length(v_errors))
  );
  
  RETURN json_build_object(
    'success', true,
    'created', v_created,
    'updated', v_updated,
    'errors_count', jsonb_array_length(v_errors),
    'errors', v_errors,
    'results', v_results
  );
END;
$function$;