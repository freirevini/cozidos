-- Create policy for public read of approved profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'profiles' 
      AND policyname = 'Anyone can view approved profiles'
  ) THEN
    CREATE POLICY "Anyone can view approved profiles"
    ON public.profiles
    FOR SELECT
    USING (is_approved = true);
  END IF;
END $$;

-- Assign default role 'user' automatically when a profile tied to an auth user is created
CREATE OR REPLACE FUNCTION public.assign_default_role_on_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only assign role if this profile corresponds to a real auth user
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.id) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_default_role_on_profile ON public.profiles;
CREATE TRIGGER trg_assign_default_role_on_profile
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.assign_default_role_on_profile();