ALTER TABLE public.student_leads DROP CONSTRAINT IF EXISTS student_leads_lead_authenticity_check;
ALTER TABLE public.student_leads ADD CONSTRAINT student_leads_lead_authenticity_check
  CHECK (lead_authenticity = ANY (ARRAY['unverified'::text,'verified'::text,'suspicious'::text,'fraudulent'::text]));