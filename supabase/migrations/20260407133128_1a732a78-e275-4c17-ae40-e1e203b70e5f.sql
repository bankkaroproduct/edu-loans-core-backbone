
DROP POLICY "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (
  actor_user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);
