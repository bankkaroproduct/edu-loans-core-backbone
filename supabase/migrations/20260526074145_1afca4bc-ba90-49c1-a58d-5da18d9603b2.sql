ALTER TABLE public.student_leads
  ALTER COLUMN intended_study_country DROP NOT NULL,
  ALTER COLUMN intake_term DROP NOT NULL,
  ALTER COLUMN intake_year DROP NOT NULL,
  ALTER COLUMN course_name DROP NOT NULL;