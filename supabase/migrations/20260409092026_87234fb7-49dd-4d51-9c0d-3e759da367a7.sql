-- Add columns needed for student application forms
ALTER TABLE public.student_leads
  ADD COLUMN IF NOT EXISTS student_dob date,
  ADD COLUMN IF NOT EXISTS student_gender text,
  ADD COLUMN IF NOT EXISTS pincode text,
  ADD COLUMN IF NOT EXISTS highest_qualification text,
  ADD COLUMN IF NOT EXISTS marks_gpa text,
  ADD COLUMN IF NOT EXISTS test_scores jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS coapplicant_mobile text,
  ADD COLUMN IF NOT EXISTS coapplicant_email text,
  ADD COLUMN IF NOT EXISTS coapplicant_employment_type text,
  ADD COLUMN IF NOT EXISTS coapplicant_employer text,
  ADD COLUMN IF NOT EXISTS coapplicant_existing_emi numeric;

-- Insert system-owned student-direct partner org
-- This is NOT a real partner. It exists only as a required foreign key target
-- for student-originated leads. It must NOT appear in partner analytics or payouts.
INSERT INTO public.partner_organizations (
  id, legal_name, partner_code, display_name, partner_type, status, is_archived
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'EduLoans Student Direct (System)',
  'PTR-DIRECT',
  'Student Direct',
  'education_consultant',
  'active',
  true  -- archived so it does not appear in partner lists/reports
) ON CONFLICT (id) DO NOTHING;

-- Allow anon read on courses_master (student portal needs this without auth)
CREATE POLICY "Anon can read courses"
ON public.courses_master
FOR SELECT TO anon
USING (true);

-- Allow anon read on intake_master
CREATE POLICY "Anon can read intakes"
ON public.intake_master
FOR SELECT TO anon
USING (true);