-- Atualiza a função recalc_all_player_rankings para preservar dados manuais/importados
-- Usa GREATEST para não sobrescrever valores existentes com zeros

CREATE OR REPLACE FUNCTION public.recalc_all_player_rankings()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  profile_record RECORD;
  v_real_gols INT;
  v_real_assistencias INT;
  v_real_vitorias INT;
  v_real_empates INT;
  v_real_derrotas INT;
  v_real_presencas INT;
  v_real_faltas INT;
  v_real_atrasos INT;
  v_real_punicoes INT;
  v_real_amarelos INT;
  v_real_azuis INT;
  v_adjustment INT;
  v_current_ranking RECORD;
  v_final_gols INT;
  v_final_assistencias INT;
  v_final_vitorias INT;
  v_final_empates INT;
  v_final_derrotas INT;
  v_final_presencas INT;
  v_final_faltas INT;
  v_final_atrasos INT;
  v_final_punicoes INT;
  v_final_amarelos INT;
  v_final_azuis INT;
  v_final_pontos INT;
BEGIN
  -- Validate admin access
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  -- Processar cada jogador aprovado
  FOR profile_record IN
    SELECT 
      pr.id as profile_id,
      COALESCE(pr.nickname, pr.name) as display_name,
      pr.email
    FROM public.profiles pr
    WHERE pr.is_player = true AND pr.status = 'aprovado'
  LOOP
    -- Calcular valores REAIS dos eventos
    SELECT COALESCE(COUNT(*), 0) INTO v_real_gols
    FROM public.goals g
    JOIN public.matches m ON m.id = g.match_id
    WHERE g.player_id = profile_record.profile_id AND g.is_own_goal = false;
    
    SELECT COALESCE(COUNT(*), 0) INTO v_real_assistencias
    FROM public.assists
    WHERE player_id = profile_record.profile_id;
    
    SELECT 
      COALESCE(SUM(victories), 0),
      COALESCE(SUM(draws), 0),
      COALESCE(SUM(defeats), 0),
      COALESCE(COUNT(DISTINCT round_id) FILTER (WHERE presence_points > 0), 0),
      COALESCE(SUM(absences), 0),
      COALESCE(SUM(lates), 0),
      COALESCE(SUM(punishments), 0),
      COALESCE(SUM(yellow_cards), 0),
      COALESCE(SUM(blue_cards), 0)
    INTO v_real_vitorias, v_real_empates, v_real_derrotas, v_real_presencas,
         v_real_faltas, v_real_atrasos, v_real_punicoes, v_real_amarelos, v_real_azuis
    FROM public.player_round_stats
    WHERE player_id = profile_record.profile_id;

    -- Buscar ranking atual (pode ter dados importados manualmente)
    SELECT * INTO v_current_ranking
    FROM public.player_rankings
    WHERE player_id = profile_record.profile_id;

    -- Aplicar ajustes manuais para cada campo
    v_final_gols := v_real_gols + COALESCE((
      SELECT SUM(adjustment_value) FROM player_ranking_adjustments 
      WHERE player_id = profile_record.profile_id AND adjustment_type = 'gols'
    ), 0);
    
    v_final_assistencias := v_real_assistencias + COALESCE((
      SELECT SUM(adjustment_value) FROM player_ranking_adjustments 
      WHERE player_id = profile_record.profile_id AND adjustment_type = 'assistencias'
    ), 0);
    
    v_final_vitorias := v_real_vitorias + COALESCE((
      SELECT SUM(adjustment_value) FROM player_ranking_adjustments 
      WHERE player_id = profile_record.profile_id AND adjustment_type = 'vitorias'
    ), 0);
    
    v_final_empates := v_real_empates + COALESCE((
      SELECT SUM(adjustment_value) FROM player_ranking_adjustments 
      WHERE player_id = profile_record.profile_id AND adjustment_type = 'empates'
    ), 0);
    
    v_final_derrotas := v_real_derrotas + COALESCE((
      SELECT SUM(adjustment_value) FROM player_ranking_adjustments 
      WHERE player_id = profile_record.profile_id AND adjustment_type = 'derrotas'
    ), 0);
    
    v_final_presencas := v_real_presencas + COALESCE((
      SELECT SUM(adjustment_value) FROM player_ranking_adjustments 
      WHERE player_id = profile_record.profile_id AND adjustment_type = 'presencas'
    ), 0);
    
    v_final_faltas := v_real_faltas + COALESCE((
      SELECT SUM(adjustment_value) FROM player_ranking_adjustments 
      WHERE player_id = profile_record.profile_id AND adjustment_type = 'faltas'
    ), 0);
    
    v_final_atrasos := v_real_atrasos + COALESCE((
      SELECT SUM(adjustment_value) FROM player_ranking_adjustments 
      WHERE player_id = profile_record.profile_id AND adjustment_type = 'atrasos'
    ), 0);
    
    v_final_punicoes := v_real_punicoes + COALESCE((
      SELECT SUM(adjustment_value) FROM player_ranking_adjustments 
      WHERE player_id = profile_record.profile_id AND adjustment_type = 'punicoes'
    ), 0);
    
    v_final_amarelos := v_real_amarelos + COALESCE((
      SELECT SUM(adjustment_value) FROM player_ranking_adjustments 
      WHERE player_id = profile_record.profile_id AND adjustment_type = 'cartoes_amarelos'
    ), 0);
    
    v_final_azuis := v_real_azuis + COALESCE((
      SELECT SUM(adjustment_value) FROM player_ranking_adjustments 
      WHERE player_id = profile_record.profile_id AND adjustment_type = 'cartoes_azuis'
    ), 0);

    -- PRESERVAR dados importados: Se não há dados reais E não há ajustes, manter valores existentes
    IF v_current_ranking IS NOT NULL THEN
      -- Se o valor calculado é 0 e existe valor no ranking atual, preservar
      IF v_final_gols = 0 AND v_current_ranking.gols > 0 THEN
        v_final_gols := v_current_ranking.gols;
      END IF;
      IF v_final_assistencias = 0 AND v_current_ranking.assistencias > 0 THEN
        v_final_assistencias := v_current_ranking.assistencias;
      END IF;
      IF v_final_vitorias = 0 AND v_current_ranking.vitorias > 0 THEN
        v_final_vitorias := v_current_ranking.vitorias;
      END IF;
      IF v_final_empates = 0 AND v_current_ranking.empates > 0 THEN
        v_final_empates := v_current_ranking.empates;
      END IF;
      IF v_final_derrotas = 0 AND v_current_ranking.derrotas > 0 THEN
        v_final_derrotas := v_current_ranking.derrotas;
      END IF;
      IF v_final_presencas = 0 AND v_current_ranking.presencas > 0 THEN
        v_final_presencas := v_current_ranking.presencas;
      END IF;
      IF v_final_faltas = 0 AND v_current_ranking.faltas > 0 THEN
        v_final_faltas := v_current_ranking.faltas;
      END IF;
      IF v_final_atrasos = 0 AND v_current_ranking.atrasos > 0 THEN
        v_final_atrasos := v_current_ranking.atrasos;
      END IF;
      IF v_final_punicoes = 0 AND v_current_ranking.punicoes > 0 THEN
        v_final_punicoes := v_current_ranking.punicoes;
      END IF;
      IF v_final_amarelos = 0 AND v_current_ranking.cartoes_amarelos > 0 THEN
        v_final_amarelos := v_current_ranking.cartoes_amarelos;
      END IF;
      IF v_final_azuis = 0 AND v_current_ranking.cartoes_azuis > 0 THEN
        v_final_azuis := v_current_ranking.cartoes_azuis;
      END IF;
    END IF;

    -- Calcular pontos totais
    v_final_pontos := (v_final_presencas * 10) + -- presença
                      (v_final_vitorias * 3) +   -- vitória
                      (v_final_empates * 1) +    -- empate
                      (v_final_gols * 1) +       -- gol
                      (v_final_assistencias * 2) + -- assistência
                      (v_final_atrasos * -5) +   -- atraso
                      (v_final_faltas * -10) +   -- falta
                      (v_final_amarelos * -1) +  -- amarelo
                      (v_final_azuis * -2) +     -- azul
                      (v_final_punicoes);        -- punições (já são negativos)

    -- Também verificar ajuste de pontos totais
    v_final_pontos := v_final_pontos + COALESCE((
      SELECT SUM(adjustment_value) FROM player_ranking_adjustments 
      WHERE player_id = profile_record.profile_id AND adjustment_type = 'pontos_totais'
    ), 0);

    -- Se existe ranking com pontos e o calculado é menor, preservar
    IF v_current_ranking IS NOT NULL AND v_current_ranking.pontos_totais > v_final_pontos THEN
      v_final_pontos := v_current_ranking.pontos_totais;
    END IF;

    -- Upsert no player_rankings
    INSERT INTO public.player_rankings (
      player_id, nickname, email,
      gols, assistencias, vitorias, empates, derrotas,
      presencas, faltas, atrasos, punicoes,
      cartoes_amarelos, cartoes_azuis, pontos_totais
    ) VALUES (
      profile_record.profile_id,
      profile_record.display_name,
      profile_record.email,
      v_final_gols, v_final_assistencias, v_final_vitorias, v_final_empates, v_final_derrotas,
      v_final_presencas, v_final_faltas, v_final_atrasos, v_final_punicoes,
      v_final_amarelos, v_final_azuis, v_final_pontos
    )
    ON CONFLICT (player_id)
    DO UPDATE SET
      gols = EXCLUDED.gols,
      assistencias = EXCLUDED.assistencias,
      vitorias = EXCLUDED.vitorias,
      empates = EXCLUDED.empates,
      derrotas = EXCLUDED.derrotas,
      presencas = EXCLUDED.presencas,
      faltas = EXCLUDED.faltas,
      atrasos = EXCLUDED.atrasos,
      punicoes = EXCLUDED.punicoes,
      cartoes_amarelos = EXCLUDED.cartoes_amarelos,
      cartoes_azuis = EXCLUDED.cartoes_azuis,
      pontos_totais = EXCLUDED.pontos_totais,
      nickname = EXCLUDED.nickname,
      updated_at = NOW();
  END LOOP;
  
  RETURN json_build_object('success', true, 'message', 'Rankings recalculados preservando dados manuais');
END;
$function$;