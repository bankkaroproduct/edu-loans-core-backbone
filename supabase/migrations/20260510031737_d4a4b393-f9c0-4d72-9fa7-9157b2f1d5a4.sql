-- Replace seed function: unconditional eligibility (all active document_master rows)
CREATE OR REPLACE FUNCTION public.seed_lead_document_requirements(p_lead_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
  v_inserted integer := 0;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.student_leads WHERE id = p_lead_id) INTO v_exists;
  IF NOT v_exists THEN
    RETURN 0;
  END IF;

  WITH inserted AS (
    INSERT INTO public.lead_document_requirements
      (lead_id, document_type_id, status, required_flag)
    SELECT
      p_lead_id,
      dm.id,
      'not_uploaded'::document_status_enum,
      dm.mandatory_flag
    FROM public.document_master dm
    WHERE dm.active_flag = true
      AND NOT EXISTS (
        SELECT 1 FROM public.lead_document_requirements r
        WHERE r.lead_id = p_lead_id
          AND r.document_type_id = dm.id
      )
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM inserted;

  RETURN v_inserted;
END;
$$;

-- One-time backfill: add any missing document requirement rows for every existing lead.
-- Existing rows (with their statuses, files, versions) are preserved by the NOT EXISTS guard.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.student_leads LOOP
    PERFORM public.seed_lead_document_requirements(r.id);
  END LOOP;
END $$;