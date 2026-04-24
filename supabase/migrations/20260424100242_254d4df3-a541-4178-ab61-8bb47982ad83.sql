-- Highest Qualification master
CREATE TABLE public.highest_qualification_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qualification_label text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.highest_qualification_master ENABLE ROW LEVEL SECURITY;

-- Admins manage everything
CREATE POLICY "Admins can manage highest qualifications"
ON public.highest_qualification_master
FOR ALL
USING (public.is_admin_or_super(auth.uid()))
WITH CHECK (public.is_admin_or_super(auth.uid()));

-- Authenticated (partners + students once signed in) can read
CREATE POLICY "Anyone authenticated can read highest qualifications"
ON public.highest_qualification_master
FOR SELECT
TO authenticated
USING (true);

-- Anonymous read (student portal pre-login parity with other masters)
CREATE POLICY "Anon can read highest qualifications"
ON public.highest_qualification_master
FOR SELECT
TO anon
USING (true);

-- updated_at trigger
CREATE TRIGGER trg_highest_qualification_master_updated_at
BEFORE UPDATE ON public.highest_qualification_master
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults
INSERT INTO public.highest_qualification_master (qualification_label, sort_order, active_flag) VALUES
  ('12th / High School',  10, true),
  ('Diploma',             20, true),
  ('Bachelor''s Degree',  30, true),
  ('Master''s Degree',    40, true),
  ('PhD / Doctorate',     50, true),
  ('Other',               60, true);
