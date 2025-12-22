-- Função para finalizar automaticamente rodadas "paradas"
-- Regra: Se todas as partidas estão 'finished' e a última terminou há mais de 30 minutos
CREATE OR REPLACE FUNCTION public.auto_finalize_stale_rounds()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_round RECORD;
  v_finalized_count INT := 0;
  v_checked_count INT := 0;
  v_last_match_time TIMESTAMPTZ;
  v_total_matches INT;
  v_finished_matches INT;
BEGIN
  -- Processar rodadas em andamento
  FOR v_round IN 
    SELECT id, round_number 
    FROM public.rounds 
    WHERE status = 'em_andamento'
  LOOP
    v_checked_count := v_checked_count + 1;
    
    -- Contar total de partidas da rodada
    SELECT COUNT(*) INTO v_total_matches
    FROM public.matches
    WHERE round_id = v_round.id;
    
    -- Se não há partidas, pular
    IF v_total_matches = 0 THEN
      CONTINUE;
    END IF;
    
    -- Contar partidas finalizadas
    SELECT COUNT(*) INTO v_finished_matches
    FROM public.matches
    WHERE round_id = v_round.id
      AND status = 'finished';
    
    -- Se nem todas as partidas estão finalizadas, pular
    IF v_finished_matches < v_total_matches THEN
      CONTINUE;
    END IF;
    
    -- Obter o horário de término da última partida
    SELECT MAX(finished_at) INTO v_last_match_time
    FROM public.matches
    WHERE round_id = v_round.id
      AND status = 'finished';
    
    -- Se não há horário de término, pular
    IF v_last_match_time IS NULL THEN
      CONTINUE;
    END IF;
    
    -- Verificar se passaram mais de 30 minutos desde a última partida
    IF NOW() > v_last_match_time + INTERVAL '30 minutes' THEN
      -- Finalizar a rodada automaticamente
      UPDATE public.rounds
      SET status = 'finalizada',
          completed_at = NOW()
      WHERE id = v_round.id;
      
      v_finalized_count := v_finalized_count + 1;
      
      -- Recalcular estatísticas da rodada
      PERFORM public.recalc_round_aggregates(v_round.id);
      
      RAISE NOTICE 'Rodada % finalizada automaticamente', v_round.round_number;
    END IF;
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'checked_rounds', v_checked_count,
    'finalized_rounds', v_finalized_count,
    'executed_at', NOW()
  );
END;
$$;

-- Habilitar extensões necessárias para cron
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Remover job existente se houver (para evitar duplicatas)
SELECT cron.unschedule('auto-finalize-stale-rounds') 
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'auto-finalize-stale-rounds'
);

-- Agendar execução a cada 10 minutos
SELECT cron.schedule(
  'auto-finalize-stale-rounds',
  '*/10 * * * *',
  $$SELECT public.auto_finalize_stale_rounds()$$
);