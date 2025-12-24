-- RLS Fix: Enable SELECT for all authenticated users on public data tables
-- Migration: 20251224174800_fix_rls_authenticated_read.sql
-- Problem: Data not displaying because RLS only allows admins, not regular authenticated users

-- ============================================================
-- SECTION 1: DROP conflicting policies that block reads
-- ============================================================

-- Drop overly restrictive "approved only" policy on profiles
DROP POLICY IF EXISTS "Authenticated users can view approved profiles" ON public.profiles;

-- ============================================================
-- SECTION 2: PROFILES - Users can read their own + basic data of others
-- ============================================================

-- Users can always read their own profile (critical for auth flow)
CREATE POLICY "Users can read own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- All authenticated can read basic profile data (for player names in matches)
CREATE POLICY "Authenticated can read all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- ============================================================
-- SECTION 3: PUBLIC DATA TABLES - Read access for all authenticated
-- ============================================================

-- player_rankings: Public leaderboard
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.player_rankings;
CREATE POLICY "Authenticated read player_rankings"
ON public.player_rankings FOR SELECT
TO authenticated
USING (true);

-- rounds: Match schedule
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.rounds;
CREATE POLICY "Authenticated read rounds"
ON public.rounds FOR SELECT
TO authenticated
USING (true);

-- matches: Game results
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.matches;
CREATE POLICY "Authenticated read matches"
ON public.matches FOR SELECT
TO authenticated
USING (true);

-- goals: Goal scorers
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.goals;
CREATE POLICY "Authenticated read goals"
ON public.goals FOR SELECT
TO authenticated
USING (true);

-- assists: Assist providers
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.assists;
CREATE POLICY "Authenticated read assists"
ON public.assists FOR SELECT
TO authenticated
USING (true);

-- cards: Card history
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.cards;
CREATE POLICY "Authenticated read cards"
ON public.cards FOR SELECT
TO authenticated
USING (true);

-- round_teams: Team compositions
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.round_teams;
CREATE POLICY "Authenticated read round_teams"
ON public.round_teams FOR SELECT
TO authenticated
USING (true);

-- round_team_players: Team rosters
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.round_team_players;
CREATE POLICY "Authenticated read round_team_players"
ON public.round_team_players FOR SELECT
TO authenticated
USING (true);

-- player_attendance: Attendance records
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.player_attendance;
CREATE POLICY "Authenticated read player_attendance"
ON public.player_attendance FOR SELECT
TO authenticated
USING (true);

-- player_round_stats: Per-round statistics
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.player_round_stats;
CREATE POLICY "Authenticated read player_round_stats"
ON public.player_round_stats FOR SELECT
TO authenticated
USING (true);

-- punishments: Suspension history
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.punishments;
CREATE POLICY "Authenticated read punishments"
ON public.punishments FOR SELECT
TO authenticated
USING (true);

-- substitutions: Substitution history
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.substitutions;
CREATE POLICY "Authenticated read substitutions"
ON public.substitutions FOR SELECT
TO authenticated
USING (true);

-- player_ranking_adjustments: Manual adjustments
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.player_ranking_adjustments;
CREATE POLICY "Authenticated read adjustments"
ON public.player_ranking_adjustments FOR SELECT
TO authenticated
USING (true);

-- ============================================================
-- SECTION 4: USER_ROLES - Needed for is_admin() checks
-- ============================================================

-- Ensure user_roles table exists and has proper RLS
ALTER TABLE IF EXISTS public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can read their own role
DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
CREATE POLICY "Users can read own role"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can read all roles (for admin panel)
DROP POLICY IF EXISTS "Admins can read all roles" ON public.user_roles;
CREATE POLICY "Admins can read all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- ============================================================
-- SECTION 5: AUDIT_LOG - Admin only
-- ============================================================

DROP POLICY IF EXISTS "Admins can read audit_log" ON public.audit_log;
CREATE POLICY "Admins can read audit_log"
ON public.audit_log FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- ============================================================
-- SECTION 6: Grant execute on helper functions
-- ============================================================

GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_all_player_rankings() TO authenticated;
