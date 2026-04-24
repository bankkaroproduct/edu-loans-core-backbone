-- 1) Revised trigger: expand ONLY document-requirement seeding to non-terminal leads.
--    Lender-match seeding remains gated to submitted/documents_pending (unchanged).
CREATE OR REPLACE FUNCTION public.trg_seed_lead_artifacts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Document requirements: seed for any non-terminal lead (admin consistency).
  IF NEW.current_stage NOT IN ('rejected', 'dropped', 'disbursed')
     AND (TG_OP = 'INSERT' OR OLD.current_stage IS DISTINCT FROM NEW.current_stage) THEN
    PERFORM public.seed_lead_document_requirements(NEW.id);
  END IF;

  -- Lender matches: behavior intentionally unchanged.
  IF NEW.current_stage IN ('submitted', 'documents_pending')
     AND (TG_OP = 'INSERT' OR OLD.current_stage IS DISTINCT FROM NEW.current_stage) THEN
    PERFORM public.seed_lead_lender_matches(NEW.id);
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) One-time backfill: seed missing lead_document_requirements only.
--    Idempotent: function skips any lead that already has matching requirements.
DO $$
DECLARE
  v_lead_id uuid;
BEGIN
  FOR v_lead_id IN
    SELECT sl.id
    FROM public.student_leads sl
    WHERE sl.is_archived = false
      AND sl.current_stage NOT IN ('rejected', 'dropped', 'disbursed')
      AND NOT EXISTS (
        SELECT 1 FROM public.lead_document_requirements r
        WHERE r.lead_id = sl.id
      )
  LOOP
    PERFORM public.seed_lead_document_requirements(v_lead_id);
  END LOOP;
END $$;