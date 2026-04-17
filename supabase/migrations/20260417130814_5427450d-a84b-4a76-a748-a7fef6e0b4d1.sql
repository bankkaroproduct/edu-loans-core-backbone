
-- ============================================================
-- 1. Country full-name → ISO-2 mapping helper
-- Lenders store ISO codes ("US"); leads store full names ("United States").
-- ============================================================
CREATE OR REPLACE FUNCTION public.country_to_iso(_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(trim(coalesce(_name, '')))
    WHEN 'united states'         THEN 'US'
    WHEN 'usa'                   THEN 'US'
    WHEN 'us'                    THEN 'US'
    WHEN 'united states of america' THEN 'US'
    WHEN 'united kingdom'        THEN 'GB'
    WHEN 'uk'                    THEN 'GB'
    WHEN 'great britain'         THEN 'GB'
    WHEN 'england'               THEN 'GB'
    WHEN 'canada'                THEN 'CA'
    WHEN 'australia'             THEN 'AU'
    WHEN 'germany'               THEN 'DE'
    WHEN 'france'                THEN 'FR'
    WHEN 'netherlands'           THEN 'NL'
    WHEN 'singapore'             THEN 'SG'
    WHEN 'ireland'               THEN 'IE'
    WHEN 'new zealand'           THEN 'NZ'
    WHEN 'spain'                 THEN 'ES'
    WHEN 'italy'                 THEN 'IT'
    WHEN 'switzerland'           THEN 'CH'
    WHEN 'sweden'                THEN 'SE'
    WHEN 'denmark'               THEN 'DK'
    ELSE upper(trim(coalesce(_name, '')))
  END;
$$;

-- ============================================================
-- 2. Seed document requirements for a lead
-- ============================================================
CREATE OR REPLACE FUNCTION public.seed_lead_document_requirements(p_lead_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_inserted integer := 0;
BEGIN
  SELECT id, coapplicant_name
  INTO v_lead
  FROM public.student_leads
  WHERE id = p_lead_id;

  IF v_lead.id IS NULL THEN
    RETURN 0;
  END IF;

  WITH eligible AS (
    SELECT dm.id AS document_type_id, dm.mandatory_flag
    FROM public.document_master dm
    WHERE dm.active_flag = true
      AND (
        dm.applicable_for = 'all'
        OR dm.applicable_for = 'student'
        OR (dm.applicable_for = 'coapplicant'
            AND v_lead.coapplicant_name IS NOT NULL
            AND length(trim(v_lead.coapplicant_name)) > 0)
      )
  ), inserted AS (
    INSERT INTO public.lead_document_requirements
      (lead_id, document_type_id, status, required_flag)
    SELECT
      p_lead_id,
      e.document_type_id,
      'not_uploaded'::document_status_enum,
      e.mandatory_flag
    FROM eligible e
    WHERE NOT EXISTS (
      SELECT 1 FROM public.lead_document_requirements r
      WHERE r.lead_id = p_lead_id
        AND r.document_type_id = e.document_type_id
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM inserted;

  RETURN v_inserted;
END;
$$;

-- ============================================================
-- 3. Seed lender matches for a lead
-- ============================================================
CREATE OR REPLACE FUNCTION public.seed_lead_lender_matches(p_lead_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_country_iso text;
  v_inserted integer := 0;
BEGIN
  SELECT id, intended_study_country, loan_amount_required
  INTO v_lead
  FROM public.student_leads
  WHERE id = p_lead_id;

  IF v_lead.id IS NULL THEN
    RETURN 0;
  END IF;

  -- Skip if matches already exist for this lead
  IF EXISTS (SELECT 1 FROM public.lead_lender_matches WHERE lead_id = p_lead_id) THEN
    RETURN 0;
  END IF;

  v_country_iso := public.country_to_iso(v_lead.intended_study_country);

  WITH eligible AS (
    SELECT
      l.id AS lender_id,
      l.lender_name,
      l.processing_time_days,
      l.loan_amount_min,
      l.loan_amount_max,
      ROW_NUMBER() OVER (ORDER BY COALESCE(l.processing_time_days, 99) ASC, l.lender_name ASC) AS rn
    FROM public.lenders l
    WHERE l.active_flag = true
      AND v_country_iso = ANY(l.supported_countries)
      AND (v_lead.loan_amount_required IS NULL
           OR (
             (l.loan_amount_min IS NULL OR v_lead.loan_amount_required >= l.loan_amount_min)
             AND
             (l.loan_amount_max IS NULL OR v_lead.loan_amount_required <= l.loan_amount_max)
           ))
  ), inserted AS (
    INSERT INTO public.lead_lender_matches
      (lead_id, lender_id, fit_category, recommendation_rank, recommendation_reason_summary, score)
    SELECT
      p_lead_id,
      e.lender_id,
      CASE WHEN e.rn <= 3 THEN 'best_fit'::fit_category_enum
           ELSE 'good_fit'::fit_category_enum END,
      e.rn::integer,
      CASE
        WHEN e.rn = 1 THEN 'Fastest processing for ' || COALESCE(v_lead.intended_study_country, 'your destination') || ' — typically ' || COALESCE(e.processing_time_days::text, 'a few') || ' days.'
        WHEN e.rn <= 3 THEN 'Strong fit for your destination and loan amount; quick turnaround.'
        ELSE 'Eligible backup option matching your country and loan range.'
      END,
      GREATEST(0, 100 - COALESCE(e.processing_time_days, 30) * 2)::numeric
    FROM eligible e
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM inserted;

  RETURN v_inserted;
END;
$$;

-- ============================================================
-- 4. Trigger: seed both on submitted/documents_pending
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_seed_lead_artifacts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.current_stage IN ('submitted', 'documents_pending')
     AND (TG_OP = 'INSERT' OR OLD.current_stage IS DISTINCT FROM NEW.current_stage) THEN
    PERFORM public.seed_lead_document_requirements(NEW.id);
    PERFORM public.seed_lead_lender_matches(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS student_leads_seed_artifacts ON public.student_leads;
CREATE TRIGGER student_leads_seed_artifacts
AFTER INSERT OR UPDATE OF current_stage ON public.student_leads
FOR EACH ROW
EXECUTE FUNCTION public.trg_seed_lead_artifacts();
