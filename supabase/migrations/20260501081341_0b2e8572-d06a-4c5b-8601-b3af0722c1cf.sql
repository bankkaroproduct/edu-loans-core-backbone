-- Add sort_order and display_name columns
ALTER TABLE public.document_master
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

ALTER TABLE public.document_master
  ADD COLUMN IF NOT EXISTS display_name text;

-- Insert 4 new active document types (idempotent)
INSERT INTO public.document_master
  (document_code, document_name, document_category, applicable_for, mandatory_flag, active_flag, display_name)
VALUES
  ('CANDIDATE_PHOTO','Candidate Photograph',     'Identity','student',     true, true, 'Candidate Photograph'),
  ('COAPP_PHOTO',    'Co-applicant Photograph',  'Identity','coapplicant', true, true, 'Co-applicant Photograph'),
  ('COAPP_PAN',      'Co-applicant PAN Card',    'Identity','coapplicant', true, true, 'Co-applicant PAN Card'),
  ('COAPP_AADHAAR',  'Co-applicant Aadhaar Card','Identity','coapplicant', true, true, 'Co-applicant Aadhaar Card')
ON CONFLICT (document_code) DO NOTHING;

-- Apply canonical sort_order + display_name (no document_code changes)
UPDATE public.document_master SET sort_order =  1, display_name = COALESCE(display_name, 'Candidate Photograph')          WHERE document_code = 'CANDIDATE_PHOTO';
UPDATE public.document_master SET sort_order =  2, display_name = 'Candidate PAN Card'                                    WHERE document_code = 'PAN';
UPDATE public.document_master SET sort_order =  3, display_name = 'Candidate Aadhaar Card'                                WHERE document_code = 'AADHAAR';
UPDATE public.document_master SET sort_order =  4, display_name = COALESCE(display_name, 'Passport')                      WHERE document_code = 'PASSPORT';
UPDATE public.document_master SET sort_order =  5, display_name = COALESCE(display_name, '10th Marksheet')                WHERE document_code = 'MARK_10';
UPDATE public.document_master SET sort_order =  6, display_name = COALESCE(display_name, '12th Marksheet')                WHERE document_code = 'MARK_12';
UPDATE public.document_master SET sort_order =  7, display_name = COALESCE(display_name, 'Graduation Marksheet')          WHERE document_code = 'GRAD_MARK';
UPDATE public.document_master SET sort_order =  8, display_name = COALESCE(display_name, 'Graduation Degree Certificate') WHERE document_code = 'GRAD_DEGREE';
UPDATE public.document_master SET sort_order =  9, display_name = COALESCE(display_name, 'Admission/Offer Letter')        WHERE document_code = 'ADMIT_LETTER';
UPDATE public.document_master SET sort_order = 10, display_name = COALESCE(display_name, 'I-20/CAS/CoE')                  WHERE document_code = 'I20_CAS';
UPDATE public.document_master SET sort_order = 11, display_name = COALESCE(display_name, 'IELTS/TOEFL Score')             WHERE document_code = 'IELTS_TOEFL';
UPDATE public.document_master SET sort_order = 12, display_name = COALESCE(display_name, 'GRE Score Card')                WHERE document_code = 'GRE_SCORE';
UPDATE public.document_master SET sort_order = 13, display_name = COALESCE(display_name, 'Co-applicant Photograph')       WHERE document_code = 'COAPP_PHOTO';
UPDATE public.document_master SET sort_order = 14, display_name = COALESCE(display_name, 'Co-applicant PAN Card')         WHERE document_code = 'COAPP_PAN';
UPDATE public.document_master SET sort_order = 15, display_name = COALESCE(display_name, 'Co-applicant Aadhaar Card')     WHERE document_code = 'COAPP_AADHAAR';
UPDATE public.document_master SET sort_order = 16, display_name = COALESCE(display_name, 'Salary Slips')                  WHERE document_code = 'SALARY_SLIP';
UPDATE public.document_master SET sort_order = 17, display_name = COALESCE(display_name, 'Income Tax Returns')            WHERE document_code = 'ITR';
UPDATE public.document_master SET sort_order = 18, display_name = COALESCE(display_name, 'Bank Statements')               WHERE document_code = 'BANK_STMT';
UPDATE public.document_master SET sort_order = 19, display_name = COALESCE(display_name, 'Property Documents')            WHERE document_code = 'PROPERTY_DOC';

-- Backfill missing requirement rows for all non-archived leads using the existing idempotent seeder.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.student_leads WHERE is_archived = false LOOP
    PERFORM public.seed_lead_document_requirements(r.id);
  END LOOP;
END $$;