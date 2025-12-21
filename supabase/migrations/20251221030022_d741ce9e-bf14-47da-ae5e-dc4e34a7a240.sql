-- =====================================================
-- POLÍTICAS RLS ABRANGENTES PARA ADMIN
-- Garante que admins tenham controle total (ALL) nas tabelas principais
-- =====================================================

-- 1. PROFILES
DROP POLICY IF EXISTS "Admins have full control on profiles" ON "public"."profiles";
CREATE POLICY "Admins have full control on profiles"
ON "public"."profiles"
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 2. ROUNDS
DROP POLICY IF EXISTS "Admins have full control on rounds" ON "public"."rounds";
CREATE POLICY "Admins have full control on rounds"
ON "public"."rounds"
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 3. MATCHES
DROP POLICY IF EXISTS "Admins have full control on matches" ON "public"."matches";
CREATE POLICY "Admins have full control on matches"
ON "public"."matches"
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 4. GOALS
DROP POLICY IF EXISTS "Admins have full control on goals" ON "public"."goals";
CREATE POLICY "Admins have full control on goals"
ON "public"."goals"
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 5. ASSISTS
DROP POLICY IF EXISTS "Admins have full control on assists" ON "public"."assists";
CREATE POLICY "Admins have full control on assists"
ON "public"."assists"
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 6. CARDS
DROP POLICY IF EXISTS "Admins have full control on cards" ON "public"."cards";
CREATE POLICY "Admins have full control on cards"
ON "public"."cards"
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 7. ROUND_TEAMS
DROP POLICY IF EXISTS "Admins have full control on round_teams" ON "public"."round_teams";
CREATE POLICY "Admins have full control on round_teams"
ON "public"."round_teams"
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 8. ROUND_TEAM_PLAYERS
DROP POLICY IF EXISTS "Admins have full control on round_team_players" ON "public"."round_team_players";
CREATE POLICY "Admins have full control on round_team_players"
ON "public"."round_team_players"
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 9. PLAYER_ATTENDANCE
DROP POLICY IF EXISTS "Admins have full control on player_attendance" ON "public"."player_attendance";
CREATE POLICY "Admins have full control on player_attendance"
ON "public"."player_attendance"
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 10. PLAYER_RANKINGS
DROP POLICY IF EXISTS "Admins have full control on player_rankings" ON "public"."player_rankings";
CREATE POLICY "Admins have full control on player_rankings"
ON "public"."player_rankings"
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 11. PLAYER_ROUND_STATS
DROP POLICY IF EXISTS "Admins have full control on player_round_stats" ON "public"."player_round_stats";
CREATE POLICY "Admins have full control on player_round_stats"
ON "public"."player_round_stats"
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 12. PUNISHMENTS
DROP POLICY IF EXISTS "Admins have full control on punishments" ON "public"."punishments";
CREATE POLICY "Admins have full control on punishments"
ON "public"."punishments"
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 13. SUBSTITUTIONS
DROP POLICY IF EXISTS "Admins have full control on substitutions" ON "public"."substitutions";
CREATE POLICY "Admins have full control on substitutions"
ON "public"."substitutions"
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 14. PLAYER_RANKING_ADJUSTMENTS
DROP POLICY IF EXISTS "Admins have full control on adjustments" ON "public"."player_ranking_adjustments";
CREATE POLICY "Admins have full control on adjustments"
ON "public"."player_ranking_adjustments"
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- =====================================================
-- GARANTIR RLS ATIVO EM TODAS AS TABELAS
-- =====================================================
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."rounds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."matches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."goals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."assists" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."cards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."round_teams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."round_team_players" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."player_attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."player_rankings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."player_round_stats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."punishments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."substitutions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."player_ranking_adjustments" ENABLE ROW LEVEL SECURITY;