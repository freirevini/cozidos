-- 1) Ensure unique constraint to support ON CONFLICT in user_roles
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_role_idx ON public.user_roles (user_id, role);
DO $$ BEGIN
  ALTER TABLE public.user_roles
    ADD CONSTRAINT user_roles_user_role_unique UNIQUE USING INDEX user_roles_user_role_idx;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Make players linkable to profiles and safe to auto-create
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS user_id uuid;

DO $$ BEGIN
  ALTER TABLE public.players
    ADD CONSTRAINT players_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS players_user_id_unique_idx ON public.players (user_id);
DO $$ BEGIN
  ALTER TABLE public.players
    ADD CONSTRAINT players_user_id_unique UNIQUE USING INDEX players_user_id_unique_idx;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Allow NULL position/level so we can create a minimal record on signup
ALTER TABLE public.players ALTER COLUMN position DROP NOT NULL;
ALTER TABLE public.players ALTER COLUMN level DROP NOT NULL;

-- 3) Robust signup profile creation from auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    name,
    nickname,
    birth_date,
    is_player,
    player_type
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Usuário'),
    NEW.raw_user_meta_data->>'nickname',
    NULLIF(NEW.raw_user_meta_data->>'birth_date','')::date,
    COALESCE((NEW.raw_user_meta_data->>'is_player')::boolean, false),
    NULLIF(NEW.raw_user_meta_data->>'player_type','')
  );
  RETURN NEW;
END;
$$;

-- 4) When a profile is created, assign default role and auto-create a players row
CREATE OR REPLACE FUNCTION public.handle_profile_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Assign default 'user' role (idempotent)
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.id) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- Auto-create a players row linked to this profile (idempotent)
  IF NOT EXISTS (SELECT 1 FROM public.players WHERE user_id = NEW.id) THEN
    INSERT INTO public.players (user_id, name)
    VALUES (NEW.id, COALESCE(NEW.name, 'Usuário'));
  END IF;

  RETURN NEW;
END;
$$;

-- 5) Triggers (create if missing)
DO $$ BEGIN
  CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_handle_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_profile_created();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
