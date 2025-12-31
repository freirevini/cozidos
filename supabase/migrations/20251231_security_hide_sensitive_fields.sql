-- Security Fix with corrected Admin check and simplified syntax

-- 1. Create the Secure View
CREATE OR REPLACE VIEW public.profiles_public AS
SELECT 
  p.id,
  p.name,
  p.nickname,
  p.avatar_url,
  p.is_player,
  p.status,
  p.position,
  p.level,
  p.created_at,
  CASE 
    WHEN p.id = auth.uid() OR (SELECT count(*) FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') > 0
    THEN p.email
    ELSE NULL
  END as email,
  CASE 
    WHEN p.id = auth.uid() OR (SELECT count(*) FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') > 0
    THEN p.claim_token
    ELSE NULL
  END as claim_token
FROM public.profiles p;

-- 2. Permissions
GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- 3. Update RLS on the main table
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "Everyone can view profiles" ON public.profiles;

CREATE POLICY "profiles_public_read" ON public.profiles
  FOR SELECT
  TO authenticated, anon
  USING (true);
