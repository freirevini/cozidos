-- Fix audit_log INSERT policy: restrict to admins only
-- This prevents any authenticated user from injecting false audit entries

DROP POLICY IF EXISTS "System can insert audit_log" ON public.audit_log;

-- Only admins can insert audit log entries from client-side
-- Edge Functions using Service Role Key bypass RLS anyway
CREATE POLICY "Admins can insert audit_log" ON public.audit_log
FOR INSERT
WITH CHECK (is_admin(auth.uid()));