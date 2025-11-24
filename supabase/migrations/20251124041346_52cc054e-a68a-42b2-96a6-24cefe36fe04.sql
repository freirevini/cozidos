-- Habilitar realtime para a tabela player_rankings
ALTER TABLE public.player_rankings REPLICA IDENTITY FULL;

-- Adicionar a tabela à publicação do realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.player_rankings;