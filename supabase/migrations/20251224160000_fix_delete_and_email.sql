-- Fix player deletion RLS + Add unique email index
-- Migration: 20251224_fix_delete_and_email.sql

-- 1. Grant EXECUTE permission on delete_player_complete to authenticated users
-- The function already has SECURITY DEFINER and checks is_admin() internally
GRANT EXECUTE ON FUNCTION public.delete_player_complete(uuid) TO authenticated;

-- 2. Add unique email index (case-insensitive) on profiles table
-- This prevents duplicate emails regardless of case (e.g., "Test@email.com" vs "test@email.com")
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_unique 
  ON public.profiles (lower(email)) 
  WHERE email IS NOT NULL AND email != '';

-- 3. Grant EXECUTE on recalc_all_player_rankings (used after deletion)
GRANT EXECUTE ON FUNCTION public.recalc_all_player_rankings() TO authenticated;
