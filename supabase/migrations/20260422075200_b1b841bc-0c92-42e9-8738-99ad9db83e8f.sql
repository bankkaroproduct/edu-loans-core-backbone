-- Allow anonymous reads of pincode_master so the student portal (pre-Supabase-auth, OTP-only)
-- can resolve district/state from a 6-digit pincode. This mirrors the existing public-read
-- policies on countries_master, courses_master, intake_master.
CREATE POLICY "Anon can read pincode master"
  ON public.pincode_master
  FOR SELECT
  TO anon
  USING (true);