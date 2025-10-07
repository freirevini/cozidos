-- Remover foreign keys antigas de goals e assists que apontam para players
ALTER TABLE public.goals DROP CONSTRAINT IF EXISTS goals_player_id_fkey;
ALTER TABLE public.assists DROP CONSTRAINT IF EXISTS assists_player_id_fkey;
ALTER TABLE public.cards DROP CONSTRAINT IF EXISTS cards_player_id_fkey;
ALTER TABLE public.player_attendance DROP CONSTRAINT IF EXISTS player_attendance_player_id_fkey;
ALTER TABLE public.player_round_stats DROP CONSTRAINT IF EXISTS player_round_stats_player_id_fkey;
ALTER TABLE public.punishments DROP CONSTRAINT IF EXISTS punishments_player_id_fkey;
ALTER TABLE public.round_team_players DROP CONSTRAINT IF EXISTS round_team_players_player_id_fkey;

-- Adicionar novas foreign keys apontando para profiles
ALTER TABLE public.goals 
ADD CONSTRAINT goals_player_id_fkey 
FOREIGN KEY (player_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.assists 
ADD CONSTRAINT assists_player_id_fkey 
FOREIGN KEY (player_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.cards 
ADD CONSTRAINT cards_player_id_fkey 
FOREIGN KEY (player_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.player_attendance 
ADD CONSTRAINT player_attendance_player_id_fkey 
FOREIGN KEY (player_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.player_round_stats 
ADD CONSTRAINT player_round_stats_player_id_fkey 
FOREIGN KEY (player_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.punishments 
ADD CONSTRAINT punishments_player_id_fkey 
FOREIGN KEY (player_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.round_team_players 
ADD CONSTRAINT round_team_players_player_id_fkey 
FOREIGN KEY (player_id) REFERENCES public.profiles(id) ON DELETE CASCADE;