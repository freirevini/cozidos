-- 1. Remove política antiga para evitar conflito de nomes
DROP POLICY IF EXISTS "Admins can update any profile" ON "public"."profiles";

-- 2. Cria a nova política permitindo que Admins atualizem QUALQUER perfil
CREATE POLICY "Admins can update any profile"
ON "public"."profiles"
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- 3. Garante que o RLS está ativo na tabela
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;