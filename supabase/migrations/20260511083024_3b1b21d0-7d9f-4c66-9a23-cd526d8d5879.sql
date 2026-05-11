
DO $$
BEGIN
  -- Idempotency guard: only shift + insert if PG_MARK doesn't exist yet
  IF NOT EXISTS (SELECT 1 FROM public.document_master WHERE document_code = 'PG_MARK') THEN
    -- Shift everything currently at sort_order >= 9 down by 2 to make room
    UPDATE public.document_master
    SET sort_order = sort_order + 2
    WHERE sort_order >= 9;

    INSERT INTO public.document_master
      (document_code, document_name, display_name, document_category, applicable_for, mandatory_flag, sort_order, active_flag, description)
    VALUES
      ('PG_MARK',   'Post-Graduation Marksheet',          'Post-Graduation Marksheet',          'academic', 'student', false, 9,  true, 'Marksheet/transcript of completed post-graduation programme'),
      ('PG_DEGREE', 'Post-Graduation Degree Certificate', 'Post-Graduation Degree Certificate', 'academic', 'student', false, 10, true, 'Degree certificate of completed post-graduation programme');
  END IF;
END $$;

-- Backfill: seed these two new requirement rows for every existing lead.
-- The seed function is idempotent (skips rows that already exist), so
-- existing uploads/statuses are never touched and no duplicates are created.
SELECT public.seed_lead_document_requirements(id)
FROM public.student_leads;
