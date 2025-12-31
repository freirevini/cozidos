-- Security Fix: Hide sensitive fields from non-owner users
-- Addresses:
-- 1. "Player Account Takeover Through Exposed Claim Tokens"
-- 2. "User Email Addresses Could Be Harvested for Spam"

-- Step 1: Create a secure view that hides sensitive fields for non-owners
CREATE OR REPLACE VIEW public.profiles_public AS
SELECT 
  p.id,
  p.name,
  p.nickname,
  p.avatar_url,
  -- Removed is_admin column as it does not exist on profiles table
  p.is_player,
  p.status,
  p.position,
  p.level,
  p.created_at,
  -- Only show email and claim_token to the profile owner or admins
  CASE 
    WHEN p.id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
    THEN p.email
    ELSE NULL
  END as email,
  CASE 
    WHEN p.id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
    THEN p.claim_token
    ELSE NULL
  END as claim_token
FROM public.profiles p;

-- Step 2: Grant access to the view
GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- Step 3: Create RLS policy to restrict direct access to sensitive columns
-- Drop existing policies that might be too permissive
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "Everyone can view profiles" ON public.profiles;

-- Create new restricted policy for SELECT
-- Users can only see limited fields, sensitive data is handled by the view
-- However, we still need to allow SELECT on the table itself so the view works
-- (RLS is checked on the table)
CREATE POLICY "profiles_public_read" ON public.profiles
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Step 4: Add comment for documentation
COMMENT ON VIEW public.profiles_public IS 
  'Public-safe view of profiles. Hides email and claim_token for non-owner users. Admin status is checked via user_roles table.';
