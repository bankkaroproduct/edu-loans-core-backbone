CREATE TABLE IF NOT EXISTS public._premiere_enrich_staging (
  college text NOT NULL,
  country text NOT NULL,
  city text NOT NULL
);
ALTER TABLE public._premiere_enrich_staging ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage premiere enrich staging" ON public._premiere_enrich_staging
  FOR ALL USING (is_admin_or_super(auth.uid())) WITH CHECK (is_admin_or_super(auth.uid()));