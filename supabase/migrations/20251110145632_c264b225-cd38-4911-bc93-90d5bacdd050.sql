-- Fix Security Issues: Restrict public data exposure and add validation

-- ============================================
-- 0. CREATE SECURITY DEFINER FUNCTION FOR ROLE CHECKING
-- ============================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- ============================================
-- 1. FIX PLAYER_RANKINGS: Restrict to authenticated users only
-- ============================================
DROP POLICY IF EXISTS "Anyone can view player_rankings" ON public.player_rankings;

CREATE POLICY "Authenticated users can view player_rankings"
ON public.player_rankings
FOR SELECT
TO authenticated
USING (true);

-- ============================================
-- 2. FIX USER_ROLES: Restrict to own role + admins can see all
-- ============================================
DROP POLICY IF EXISTS "Anyone can view user_roles" ON public.user_roles;

CREATE POLICY "Users can view own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- 3. FIX PROFILES: Restrict to authenticated users only
-- ============================================
DROP POLICY IF EXISTS "Anyone can view approved profiles" ON public.profiles;

CREATE POLICY "Authenticated users can view approved profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (is_approved = true);

-- ============================================
-- 4. ADD MATCH MINUTE VALIDATION: Ensure minutes are 0-120
-- ============================================
-- Drop existing constraints if they exist
DO $$ 
BEGIN
  ALTER TABLE public.goals DROP CONSTRAINT IF EXISTS valid_minute;
  ALTER TABLE public.cards DROP CONSTRAINT IF EXISTS valid_minute;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Add new constraints
ALTER TABLE public.goals 
ADD CONSTRAINT valid_minute 
CHECK (minute >= 0 AND minute <= 120);

ALTER TABLE public.cards 
ADD CONSTRAINT valid_minute 
CHECK (minute >= 0 AND minute <= 120);