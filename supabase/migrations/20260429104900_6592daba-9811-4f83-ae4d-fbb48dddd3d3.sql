-- Create employment_type_master to align controlled values with Master Data
-- (Partner: read-only, Admin: editable). Mirrors highest_qualification_master shape.

CREATE TABLE IF NOT EXISTS public.employment_type_master (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employment_type_label text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.employment_type_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read employment types"
  ON public.employment_type_master FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anon can read employment types"
  ON public.employment_type_master FOR SELECT TO anon USING (true);

CREATE POLICY "Admins can manage employment types"
  ON public.employment_type_master FOR ALL TO public
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE TRIGGER update_employment_type_master_updated_at
  BEFORE UPDATE ON public.employment_type_master
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed canonical values aligned with src/pages/AddLead.tsx EMPLOYMENT_TYPE_OPTIONS
INSERT INTO public.employment_type_master (employment_type_label, sort_order) VALUES
  ('Salaried', 10),
  ('Self-employed', 20),
  ('Business owner', 30),
  ('Retired', 40),
  ('Other', 99)
ON CONFLICT (employment_type_label) DO NOTHING;