-- Enable RLS on profiles if not already enabled (it should be, but just in case)
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

-- Policy to allow admins to update any profile
-- Policy to allow admins to update any profile
DROP POLICY IF EXISTS "Admins can update any profile" ON "public"."profiles";

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
);
