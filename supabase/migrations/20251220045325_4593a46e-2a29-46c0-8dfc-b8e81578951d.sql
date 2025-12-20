-- Adicionar política de DELETE para admins na tabela profiles
-- Isso permite que a função delete_player_complete funcione corretamente

DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;

CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING ( public.is_admin(auth.uid()) );

-- Também garantir permissões nas tabelas relacionadas para cascata funcionar
-- (goals, assists, cards, etc já tem policies de INSERT para admin, mas precisamos DELETE)

DROP POLICY IF EXISTS "Admins can delete goals" ON public.goals;
CREATE POLICY "Admins can delete goals"
ON public.goals
FOR DELETE
TO authenticated
USING ( public.is_admin(auth.uid()) );

DROP POLICY IF EXISTS "Admins can delete assists" ON public.assists;
CREATE POLICY "Admins can delete assists"
ON public.assists
FOR DELETE
TO authenticated
USING ( public.is_admin(auth.uid()) );

DROP POLICY IF EXISTS "Admins can delete cards" ON public.cards;
CREATE POLICY "Admins can delete cards"
ON public.cards
FOR DELETE
TO authenticated
USING ( public.is_admin(auth.uid()) );

DROP POLICY IF EXISTS "Admins can delete player_round_stats" ON public.player_round_stats;
CREATE POLICY "Admins can delete player_round_stats"
ON public.player_round_stats
FOR DELETE
TO authenticated
USING ( public.is_admin(auth.uid()) );

DROP POLICY IF EXISTS "Admins can delete player_attendance" ON public.player_attendance;
CREATE POLICY "Admins can delete player_attendance"
ON public.player_attendance
FOR DELETE
TO authenticated
USING ( public.is_admin(auth.uid()) );