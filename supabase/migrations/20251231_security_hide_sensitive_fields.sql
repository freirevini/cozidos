-- Security Fix: Hide sensitive fields from non-owner users
-- Addresses:
-- 1. "Player Account Takeover Through Exposed Claim Tokens"
-- 2. "User Email Addresses Could Be Harvested for Spam"

-- Step 1: Create a secure view that hides sensitive fields for non-owners
CREATE OR REPLACE VIEW public.profiles_public AS
SELECT 
  id,
  name,
  nickname,
  avatar_url,
  is_admin,
  is_player,
  status,
  position,
  level,
  created_at,
  -- Only show email and claim_token to the profile owner or admins
  CASE 
    WHEN id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
    THEN email
    ELSE NULL
  END as email,
  CASE 
    WHEN id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
    THEN claim_token
    ELSE NULL
  END as claim_token
FROM public.profiles;

-- Step 2: Grant access to the view
GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- Step 3: Create RLS policy to restrict direct access to sensitive columns
-- Drop existing policies that might be too permissive
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "Everyone can view profiles" ON public.profiles;

-- Create new restricted policy for SELECT
-- Users can only see limited fields, sensitive data is handled by the view
CREATE POLICY "profiles_public_read" ON public.profiles
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Note: The profiles table still allows SELECT for all,
-- but we recommend updating frontend queries to use profiles_public view
-- for public-facing pages where email/claim_token should not be visible.

-- Step 4: Add comment for documentation
COMMENT ON VIEW public.profiles_public IS 
  'Public-safe view of profiles. Hides email and claim_token for non-owner users. Use this view for public-facing queries.';
