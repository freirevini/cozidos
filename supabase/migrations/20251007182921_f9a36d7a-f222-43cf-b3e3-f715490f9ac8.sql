-- Allow creating player profiles not tied to auth users
-- Drop FK that forces profiles.id to reference auth.users(id)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;