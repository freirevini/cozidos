-- Fix player_rankings foreign key to reference profiles instead of players
-- Step 1: Clean orphaned records that don't have matching profiles

-- Remove registros órfãos em player_rankings que não têm profile correspondente
DELETE FROM public.player_rankings
WHERE player_id NOT IN (SELECT id FROM public.profiles);

-- Remove a foreign key antiga que aponta para players
ALTER TABLE public.player_rankings 
DROP CONSTRAINT IF EXISTS player_rankings_player_id_fkey;

-- Adiciona a nova foreign key apontando para profiles
ALTER TABLE public.player_rankings 
ADD CONSTRAINT player_rankings_player_id_fkey 
FOREIGN KEY (player_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Adiciona comentário explicativo
COMMENT ON CONSTRAINT player_rankings_player_id_fkey ON public.player_rankings 
IS 'References profiles.id to maintain consistency with all event tables (goals, assists, cards, round_team_players)';