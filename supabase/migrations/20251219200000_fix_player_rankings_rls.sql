-- Enable RLS on player_rankings table
ALTER TABLE "public"."player_rankings" ENABLE ROW LEVEL SECURITY;

-- Policy to allow everything for users with 'admin' role
CREATE POLICY "Enable all for admins" 
ON "public"."player_rankings" 
AS PERMISSIVE 
FOR ALL 
TO authenticated 
USING (
  (SELECT auth.uid()) IN (
    SELECT user_id FROM user_roles WHERE role = 'admin'
  )
) 
WITH CHECK (true);

-- Policy to allow public read access (if needed for profile views)
CREATE POLICY "Enable read for all" 
ON "public"."player_rankings" 
AS PERMISSIVE 
FOR SELECT 
TO public 
USING (true);
