-- Garantir que assists tenha REPLICA IDENTITY FULL para realtime completo
ALTER TABLE public.assists REPLICA IDENTITY FULL;

-- Garantir que goals tenha REPLICA IDENTITY FULL
ALTER TABLE public.goals REPLICA IDENTITY FULL;