-- Remover políticas antigas conflitantes
DROP POLICY IF EXISTS "Admins can update any profile" ON "public"."profiles";

-- Criar a nova política permissiva para admins atualizarem qualquer perfil
CREATE POLICY "Admins can update any profile"
ON "public"."profiles"
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);