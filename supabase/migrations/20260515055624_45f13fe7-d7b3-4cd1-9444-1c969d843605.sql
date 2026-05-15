CREATE TABLE IF NOT EXISTS public.pincode_tier_staging (
  pincode text PRIMARY KEY,
  tier text NOT NULL
);
ALTER TABLE public.pincode_tier_staging ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage tier staging" ON public.pincode_tier_staging
  FOR ALL USING (is_admin_or_super(auth.uid())) WITH CHECK (is_admin_or_super(auth.uid()));