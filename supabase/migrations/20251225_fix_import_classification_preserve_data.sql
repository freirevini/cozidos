-- Fix import_classification_csv to use player_ranking_adjustments instead of direct ranking writes
-- This ensures imported historical data survives when recalc_all_player_rankings runs
-- Migration: 20251225_fix_import_classification_preserve_data.sql

CREATE OR REPLACE FUNCTION public.import_classification_csv(p_rows jsonb, p_actor_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row jsonb;
  v_nickname text;
  v_token text;
  v_profile_id uuid;
  v_new_id uuid;
  v_new_token text;
  v_ano int;
  v_created int := 0;
  v_updated int := 0;
  v_profiles_created int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_results jsonb := '[]'::jsonb;
  v_row_index int := 0;
  v_duplicate_count int;
  v_gols int;
  v_assistencias int;
  v_vitorias int;
  v_empates int;
  v_derrotas int;
  v_pontos_totais int;
BEGIN
  -- Validate admin access
  IF NOT public.is_admin(COALESCE(p_actor_id, auth.uid())) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado: apenas administradores podem importar classificação');
  END IF;

  -- Process each row
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_row_index := v_row_index + 1;
    v_token := TRIM(COALESCE(v_row->>'token', v_row->>'Token', v_row->>'ClaimToken', v_row->>'claim_token', ''));
    v_nickname := TRIM(COALESCE(v_row->>'nickname', v_row->>'Nickname', ''));
    v_ano := COALESCE((v_row->>'ano')::int, (v_row->>'Ano')::int, EXTRACT(YEAR FROM CURRENT_DATE)::int);
    
    -- Parse stats
    v_gols := COALESCE((v_row->>'gols')::int, (v_row->>'Gols')::int, 0);
    v_assistencias := COALESCE((v_row->>'assistencias')::int, (v_row->>'Assistencias')::int, 0);
    v_vitorias := COALESCE((v_row->>'vitorias')::int, (v_row->>'Vitorias')::int, 0);
    v_empates := COALESCE((v_row->>'empates')::int, (v_row->>'Empates')::int, 0);
    v_derrotas := COALESCE((v_row->>'derrotas')::int, (v_row->>'Derrotas')::int, 0);
    v_pontos_totais := COALESCE((v_row->>'pontos_totais')::int, (v_row->>'Pontos_Totais')::int, 0);
    
    -- Validate at least one identifier
    IF v_token = '' AND v_nickname = '' THEN
      v_errors := v_errors || jsonb_build_object('row', v_row_index, 'error', 'Token ou Nickname é obrigatório', 'data', v_row);
      CONTINUE;
    END IF;
    
    -- Validate year format
    IF v_ano < 2000 OR v_ano > 2100 THEN
      v_errors := v_errors || jsonb_build_object('row', v_row_index, 'error', format('Ano inválido: %s (deve ser YYYY entre 2000 e 2100)', v_ano), 'data', v_row);
      CONTINUE;
    END IF;
    
    v_profile_id := NULL;
    
    -- Priority 1: Find by token
    IF v_token != '' THEN
      SELECT id INTO v_profile_id
      FROM public.profiles
      WHERE LOWER(claim_token) = LOWER(v_token)
      LIMIT 1;
      
      -- If token not found but provided, create placeholder with that token
      IF v_profile_id IS NULL AND v_nickname != '' THEN
        v_new_id := gen_random_uuid();
        
        INSERT INTO public.profiles (id, name, nickname, claim_token, is_player, status, created_by_admin_simple)
        VALUES (v_new_id, v_nickname, v_nickname, v_token, true, 'aprovado', true);
        
        v_profile_id := v_new_id;
        v_profiles_created := v_profiles_created + 1;
        v_results := v_results || jsonb_build_object('row', v_row_index, 'action', 'profile_created', 'profile_id', v_new_id, 'nickname', v_nickname, 'claim_token', v_token);
      ELSIF v_profile_id IS NULL THEN
        v_errors := v_errors || jsonb_build_object('row', v_row_index, 'error', format('Token "%s" não encontrado e Nickname não fornecido', v_token), 'data', v_row);
        CONTINUE;
      END IF;
    END IF;
    
    -- Priority 2: Find by nickname (if no token match)
    IF v_profile_id IS NULL AND v_nickname != '' THEN
      -- Check for duplicates
      SELECT COUNT(*) INTO v_duplicate_count
      FROM public.profiles
      WHERE LOWER(nickname) = LOWER(v_nickname);
      
      IF v_duplicate_count > 1 THEN
        v_errors := v_errors || jsonb_build_object(
          'row', v_row_index, 
          'error', format('Nickname "%s" corresponde a %s perfis. Use o Token para vincular corretamente.', v_nickname, v_duplicate_count),
          'data', v_row,
          'candidates', (SELECT jsonb_agg(jsonb_build_object('id', id, 'nickname', nickname, 'email', email, 'claim_token', claim_token)) FROM public.profiles WHERE LOWER(nickname) = LOWER(v_nickname))
        );
        CONTINUE;
      END IF;
      
      SELECT id INTO v_profile_id
      FROM public.profiles
      WHERE LOWER(nickname) = LOWER(v_nickname)
      LIMIT 1;
      
      -- Create new profile if not found
      IF v_profile_id IS NULL THEN
        v_new_id := gen_random_uuid();
        -- Generate token inline (8 uppercase alphanumeric chars)
        v_new_token := upper(substring(md5(random()::text || clock_timestamp()::text || v_row_index::text) from 1 for 8));
        
        INSERT INTO public.profiles (id, name, nickname, claim_token, is_player, status, created_by_admin_simple)
        VALUES (v_new_id, v_nickname, v_nickname, v_new_token, true, 'aprovado', true);
        
        v_profile_id := v_new_id;
        v_profiles_created := v_profiles_created + 1;
        v_results := v_results || jsonb_build_object('row', v_row_index, 'action', 'profile_created', 'profile_id', v_new_id, 'nickname', v_nickname, 'claim_token', v_new_token);
      ELSE
        -- Update existing profile with token if missing
        UPDATE public.profiles 
        SET claim_token = COALESCE(claim_token, upper(substring(md5(random()::text || clock_timestamp()::text || v_row_index::text) from 1 for 8)))
        WHERE id = v_profile_id AND claim_token IS NULL;
      END IF;
    END IF;
    
    IF v_profile_id IS NULL THEN
      v_errors := v_errors || jsonb_build_object('row', v_row_index, 'error', 'Não foi possível identificar o jogador', 'data', v_row);
      CONTINUE;
    END IF;
    
    -- ============================================================
    -- CRITICAL FIX: Store imported data as ADJUSTMENTS
    -- This ensures recalc_all_player_rankings preserves them
    -- ============================================================
    
    -- Delete any previous import adjustments for this player (to avoid stacking)
    DELETE FROM public.player_ranking_adjustments 
    WHERE player_id = v_profile_id 
      AND reason LIKE 'Importação CSV%';
    
    -- Insert adjustments for each stat field (only if value > 0)
    IF v_gols > 0 THEN
      INSERT INTO public.player_ranking_adjustments (player_id, adjustment_type, adjustment_value, reason, created_by)
      VALUES (v_profile_id, 'gols', v_gols, format('Importação CSV (Ano %s)', v_ano), COALESCE(p_actor_id, auth.uid()));
    END IF;
    
    IF v_assistencias > 0 THEN
      INSERT INTO public.player_ranking_adjustments (player_id, adjustment_type, adjustment_value, reason, created_by)
      VALUES (v_profile_id, 'assistencias', v_assistencias, format('Importação CSV (Ano %s)', v_ano), COALESCE(p_actor_id, auth.uid()));
    END IF;
    
    IF v_vitorias > 0 THEN
      INSERT INTO public.player_ranking_adjustments (player_id, adjustment_type, adjustment_value, reason, created_by)
      VALUES (v_profile_id, 'vitorias', v_vitorias, format('Importação CSV (Ano %s)', v_ano), COALESCE(p_actor_id, auth.uid()));
    END IF;
    
    IF v_empates > 0 THEN
      INSERT INTO public.player_ranking_adjustments (player_id, adjustment_type, adjustment_value, reason, created_by)
      VALUES (v_profile_id, 'empates', v_empates, format('Importação CSV (Ano %s)', v_ano), COALESCE(p_actor_id, auth.uid()));
    END IF;
    
    IF v_derrotas > 0 THEN
      INSERT INTO public.player_ranking_adjustments (player_id, adjustment_type, adjustment_value, reason, created_by)
      VALUES (v_profile_id, 'derrotas', v_derrotas, format('Importação CSV (Ano %s)', v_ano), COALESCE(p_actor_id, auth.uid()));
    END IF;
    
    v_updated := v_updated + 1;
    v_results := v_results || jsonb_build_object('row', v_row_index, 'action', 'adjustments_created', 'profile_id', v_profile_id);
  END LOOP;
  
  -- Now recalculate rankings to apply the imported adjustments
  PERFORM public.recalc_all_player_rankings();
  
  -- Log audit
  INSERT INTO public.audit_log (action, actor_id, metadata)
  VALUES (
    'import_classification_csv',
    COALESCE(p_actor_id, auth.uid()),
    jsonb_build_object('updated', v_updated, 'profiles_created', v_profiles_created, 'errors_count', jsonb_array_length(v_errors))
  );
  
  RETURN json_build_object(
    'success', true,
    'rankings_updated', v_updated,
    'profiles_created', v_profiles_created,
    'errors_count', jsonb_array_length(v_errors),
    'errors', v_errors,
    'results', v_results
  );
END;
$$;

-- Also add 'pontos_totais' as a valid adjustment type for imported point totals
-- (Check if this adjustment_type check constraint needs updating)
-- Note: The current system calculates pontos_totais from other stats, so we don't import it directly.
-- If you need to override total points, consider adding 'pontos_bonus' adjustment type.
