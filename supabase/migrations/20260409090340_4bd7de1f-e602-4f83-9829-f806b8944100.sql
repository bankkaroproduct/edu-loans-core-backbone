CREATE POLICY "Anon can read countries"
ON public.countries_master
FOR SELECT
TO anon
USING (true);