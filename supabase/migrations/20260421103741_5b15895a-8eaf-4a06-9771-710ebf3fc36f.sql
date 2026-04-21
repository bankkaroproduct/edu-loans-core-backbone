-- Normalize misspelled "Refferal" to "Referral" so source filter mapping (ILIKE %refer%) works correctly.
UPDATE public.student_leads
SET source_sub_type = 'Referral'
WHERE source_sub_type = 'Refferal';