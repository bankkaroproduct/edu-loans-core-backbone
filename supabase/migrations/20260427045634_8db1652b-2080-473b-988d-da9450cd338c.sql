-- =====================================================================
-- 1. Extend universities_master with QS rank / grade / points
-- =====================================================================
ALTER TABLE public.universities_master
  ADD COLUMN IF NOT EXISTS qs_rank integer NULL,
  ADD COLUMN IF NOT EXISTS grade text NULL,
  ADD COLUMN IF NOT EXISTS points integer NULL,
  ADD COLUMN IF NOT EXISTS grade_source text NOT NULL DEFAULT 'derived';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'universities_master_grade_chk'
  ) THEN
    ALTER TABLE public.universities_master
      ADD CONSTRAINT universities_master_grade_chk
      CHECK (grade IS NULL OR grade IN ('A','B','C','D'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'universities_master_grade_source_chk'
  ) THEN
    ALTER TABLE public.universities_master
      ADD CONSTRAINT universities_master_grade_source_chk
      CHECK (grade_source IN ('manual','derived'));
  END IF;
END $$;

-- Persisted normalised columns for matching (filled by trigger).
ALTER TABLE public.universities_master
  ADD COLUMN IF NOT EXISTS university_name_normalized text NULL,
  ADD COLUMN IF NOT EXISTS country_normalized text NULL;

-- =====================================================================
-- 2. Country aliases
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.country_aliases (
  alias_lower text PRIMARY KEY,
  canonical_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.country_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage country aliases" ON public.country_aliases;
CREATE POLICY "Admins manage country aliases"
  ON public.country_aliases FOR ALL
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Anyone can read country aliases" ON public.country_aliases;
CREATE POLICY "Anyone can read country aliases"
  ON public.country_aliases FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO public.country_aliases (alias_lower, canonical_name) VALUES
  ('usa', 'United States'),
  ('us', 'United States'),
  ('u.s.', 'United States'),
  ('u.s.a.', 'United States'),
  ('united states', 'United States'),
  ('united states of america', 'United States'),
  ('america', 'United States'),
  ('uk', 'United Kingdom'),
  ('u.k.', 'United Kingdom'),
  ('britain', 'United Kingdom'),
  ('great britain', 'United Kingdom'),
  ('england', 'United Kingdom'),
  ('united kingdom', 'United Kingdom'),
  ('uae', 'United Arab Emirates'),
  ('united arab emirates', 'United Arab Emirates'),
  ('hk', 'Hong Kong'),
  ('hong kong sar', 'Hong Kong'),
  ('hong kong', 'Hong Kong'),
  ('south korea', 'South Korea'),
  ('republic of korea', 'South Korea'),
  ('rok', 'South Korea'),
  ('korea, republic of', 'South Korea'),
  ('canada', 'Canada'),
  ('australia', 'Australia'),
  ('germany', 'Germany'),
  ('france', 'France'),
  ('netherlands', 'Netherlands'),
  ('singapore', 'Singapore'),
  ('ireland', 'Ireland'),
  ('new zealand', 'New Zealand'),
  ('spain', 'Spain'),
  ('italy', 'Italy'),
  ('switzerland', 'Switzerland'),
  ('sweden', 'Sweden'),
  ('denmark', 'Denmark')
ON CONFLICT (alias_lower) DO NOTHING;

-- =====================================================================
-- 3. Helper functions: normalisation + country canonicalisation
-- =====================================================================

-- Lowercase, replace NBSP, strip punctuation, drop stopwords, collapse ws.
CREATE OR REPLACE FUNCTION public.normalize_college_name(_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_clean text;
  v_tok text;
  v_out text := '';
BEGIN
  IF _name IS NULL THEN RETURN NULL; END IF;
  v_clean := lower(_name);
  v_clean := replace(v_clean, chr(160), ' ');               -- NBSP
  v_clean := regexp_replace(v_clean, '[^a-z0-9 ]+', ' ', 'g');
  v_clean := regexp_replace(v_clean, '\s+', ' ', 'g');
  v_clean := trim(v_clean);
  IF v_clean = '' THEN RETURN ''; END IF;
  FOREACH v_tok IN ARRAY string_to_array(v_clean, ' ') LOOP
    IF v_tok NOT IN ('the','a','an','of','and') THEN
      v_out := v_out || CASE WHEN v_out = '' THEN '' ELSE ' ' END || v_tok;
    END IF;
  END LOOP;
  RETURN v_out;
END $$;

-- Canonicalise country name via alias table; fallback to trimmed input.
-- STABLE because it queries the alias table.
CREATE OR REPLACE FUNCTION public.resolve_country_canonical(_name text)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_lookup text;
  v_canonical text;
BEGIN
  IF _name IS NULL THEN RETURN NULL; END IF;
  v_lookup := lower(trim(_name));
  IF v_lookup = '' THEN RETURN NULL; END IF;
  SELECT canonical_name INTO v_canonical
  FROM public.country_aliases WHERE alias_lower = v_lookup;
  IF v_canonical IS NOT NULL THEN RETURN v_canonical; END IF;
  -- Fallback: title-case-ish — return trimmed input as-is
  RETURN trim(_name);
END $$;

-- Distinctive tokens: drop {university, college, institute, school, campus}
-- and tokens of length ≤ 2.
CREATE OR REPLACE FUNCTION public.tokens_distinctive(_norm_name text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_tok text;
  v_out text[] := ARRAY[]::text[];
BEGIN
  IF _norm_name IS NULL OR _norm_name = '' THEN RETURN v_out; END IF;
  FOREACH v_tok IN ARRAY string_to_array(_norm_name, ' ') LOOP
    IF length(v_tok) > 2
       AND v_tok NOT IN ('university','college','institute','school','campus') THEN
      v_out := array_append(v_out, v_tok);
    END IF;
  END LOOP;
  RETURN v_out;
END $$;

-- Match rule: exact normalised OR ≥2 distinctive token overlap AND
-- one filtered token set is subset of the other.
CREATE OR REPLACE FUNCTION public.match_college_names(_a_norm text, _b_norm text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  a_tok text[];
  b_tok text[];
  overlap_count integer;
  a_subset_b boolean;
  b_subset_a boolean;
BEGIN
  IF _a_norm IS NULL OR _b_norm IS NULL THEN RETURN false; END IF;
  IF _a_norm = _b_norm THEN RETURN true; END IF;
  a_tok := public.tokens_distinctive(_a_norm);
  b_tok := public.tokens_distinctive(_b_norm);
  IF array_length(a_tok, 1) IS NULL OR array_length(b_tok, 1) IS NULL THEN
    RETURN false;
  END IF;
  SELECT count(*) INTO overlap_count
    FROM (SELECT unnest(a_tok) INTERSECT SELECT unnest(b_tok)) s;
  IF overlap_count < 2 THEN RETURN false; END IF;
  a_subset_b := (a_tok <@ b_tok);
  b_subset_a := (b_tok <@ a_tok);
  RETURN (a_subset_b OR b_subset_a);
END $$;

-- =====================================================================
-- 4. Trigger to keep universities_master normalised columns in sync
-- =====================================================================
CREATE OR REPLACE FUNCTION public.trg_universities_master_normalize()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.university_name_normalized := public.normalize_college_name(NEW.university_name);
  NEW.country_normalized := public.resolve_country_canonical(NEW.country);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS universities_master_normalize ON public.universities_master;
CREATE TRIGGER universities_master_normalize
  BEFORE INSERT OR UPDATE OF university_name, country
  ON public.universities_master
  FOR EACH ROW EXECUTE FUNCTION public.trg_universities_master_normalize();

-- Backfill normalised columns for existing rows
UPDATE public.universities_master
SET university_name_normalized = public.normalize_college_name(university_name),
    country_normalized = public.resolve_country_canonical(country)
WHERE university_name_normalized IS NULL OR country_normalized IS NULL;

CREATE INDEX IF NOT EXISTS universities_master_norm_name_country_idx
  ON public.universities_master (university_name_normalized, country_normalized);

-- =====================================================================
-- 5. lender_premiere_colleges table
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.lender_premiere_colleges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id uuid NOT NULL,
  college_name_raw text NOT NULL,
  college_name_normalized text NOT NULL,
  country_raw text NOT NULL,
  country_normalized text NOT NULL,
  city text NULL,
  notes text NULL,
  effective_from date NULL,
  effective_to date NULL,
  list_version integer NOT NULL,
  is_current boolean NOT NULL DEFAULT true,
  uploaded_by uuid NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  source_file_name text NULL
);

ALTER TABLE public.lender_premiere_colleges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage premiere colleges" ON public.lender_premiere_colleges;
CREATE POLICY "Admins manage premiere colleges"
  ON public.lender_premiere_colleges FOR ALL
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE INDEX IF NOT EXISTS lender_premiere_colleges_lender_current_idx
  ON public.lender_premiere_colleges (lender_id, is_current);
CREATE INDEX IF NOT EXISTS lender_premiere_colleges_lookup_idx
  ON public.lender_premiere_colleges (college_name_normalized, country_normalized)
  WHERE is_current = true;
CREATE INDEX IF NOT EXISTS lender_premiere_colleges_lender_version_idx
  ON public.lender_premiere_colleges (lender_id, list_version);
CREATE UNIQUE INDEX IF NOT EXISTS lender_premiere_colleges_uniq_per_version
  ON public.lender_premiere_colleges
    (lender_id, list_version, college_name_normalized, country_normalized);

-- =====================================================================
-- 6. lender_premiere_audit table
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.lender_premiere_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('upload','replace','delete')),
  file_name text NULL,
  row_count integer NULL,
  list_version integer NULL,
  actor_user_id uuid NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lender_premiere_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read premiere audit" ON public.lender_premiere_audit;
CREATE POLICY "Admins read premiere audit"
  ON public.lender_premiere_audit FOR SELECT
  USING (public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Admins insert premiere audit" ON public.lender_premiere_audit;
CREATE POLICY "Admins insert premiere audit"
  ON public.lender_premiere_audit FOR INSERT
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE INDEX IF NOT EXISTS lender_premiere_audit_lender_idx
  ON public.lender_premiere_audit (lender_id, created_at DESC);

-- =====================================================================
-- 7. Replace seed_lead_lender_matches — premiere-aware ordering only
-- =====================================================================
CREATE OR REPLACE FUNCTION public.seed_lead_lender_matches(p_lead_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_country_iso text;
  v_country_canonical text;
  v_college_norm text;
  v_inserted integer := 0;
BEGIN
  SELECT id, intended_study_country, loan_amount_required, university_name_raw
  INTO v_lead
  FROM public.student_leads
  WHERE id = p_lead_id;

  IF v_lead.id IS NULL THEN RETURN 0; END IF;

  -- Skip if matches already exist for this lead (snapshot semantics — premiere
  -- changes do NOT retroactively re-rank in-flight applications).
  IF EXISTS (SELECT 1 FROM public.lead_lender_matches WHERE lead_id = p_lead_id) THEN
    RETURN 0;
  END IF;

  v_country_iso := public.country_to_iso(v_lead.intended_study_country);
  v_country_canonical := public.resolve_country_canonical(v_lead.intended_study_country);
  v_college_norm := public.normalize_college_name(v_lead.university_name_raw);

  WITH eligible AS (
    -- ============================================================
    -- STEP 1 — BRE eligibility filter (existing logic, untouched).
    -- Country support + loan-amount caps + active flag.
    -- ============================================================
    SELECT
      l.id AS lender_id,
      l.lender_name,
      l.processing_time_days,
      l.loan_amount_min,
      l.loan_amount_max
    FROM public.lenders l
    WHERE l.active_flag = true
      AND v_country_iso = ANY(l.supported_countries)
      AND (v_lead.loan_amount_required IS NULL
           OR (
             (l.loan_amount_min IS NULL OR v_lead.loan_amount_required >= l.loan_amount_min)
             AND
             (l.loan_amount_max IS NULL OR v_lead.loan_amount_required <= l.loan_amount_max)
           ))
  ),
  -- ============================================================
  -- STEP 2 — LEFT JOIN premiere data.
  -- IMPORTANT: premiere NEVER affects eligibility, only ordering.
  -- Do not move this join above the `eligible` CTE under any
  -- circumstance. A non-match here must NOT remove a lender from
  -- the result set; it just means the lender lands in Group B.
  -- ============================================================
  with_premiere AS (
    SELECT
      e.*,
      CASE WHEN p.id IS NOT NULL THEN true ELSE false END AS is_premiere,
      to_jsonb(p.*) AS premiere_record
    FROM eligible e
    LEFT JOIN public.lender_premiere_colleges p
      ON p.lender_id = e.lender_id
     AND p.is_current = true
     AND (p.effective_from IS NULL OR p.effective_from <= CURRENT_DATE)
     AND (p.effective_to   IS NULL OR p.effective_to   >= CURRENT_DATE)
     AND p.country_normalized = v_country_canonical
     AND public.match_college_names(p.college_name_normalized, v_college_norm)
  ),
  -- ============================================================
  -- STEP 3 — ORDER: premiere-first, rate asc, ticket size desc, name asc.
  -- (Rate columns are not currently on lenders table; substitute
  -- processing_time_days as the deterministic secondary key until
  -- rate columns are added. ticket size = loan_amount_max.)
  -- ============================================================
  ranked AS (
    SELECT
      wp.*,
      ROW_NUMBER() OVER (
        ORDER BY
          wp.is_premiere DESC,
          COALESCE(wp.processing_time_days, 99) ASC,
          wp.loan_amount_max DESC NULLS LAST,
          wp.lender_name ASC
      ) AS rn
    FROM with_premiere wp
  ),
  inserted AS (
    INSERT INTO public.lead_lender_matches
      (lead_id, lender_id, fit_category, recommendation_rank,
       recommendation_reason_summary, score, bre_output_json)
    SELECT
      p_lead_id,
      r.lender_id,
      CASE WHEN r.rn <= 3 THEN 'best_fit'::fit_category_enum
           ELSE 'good_fit'::fit_category_enum END,
      r.rn::integer,
      CASE
        WHEN r.is_premiere THEN
          'Strong match — premiere institution for this lender.'
        WHEN r.rn = 1 THEN
          'Fastest processing for ' || COALESCE(v_lead.intended_study_country,'your destination')
            || ' — typically ' || COALESCE(r.processing_time_days::text,'a few') || ' days.'
        WHEN r.rn <= 3 THEN
          'Strong fit for your destination and loan amount; quick turnaround.'
        ELSE
          'Eligible backup option matching your country and loan range.'
      END,
      GREATEST(0, 100 - COALESCE(r.processing_time_days, 30) * 2)::numeric,
      jsonb_build_object(
        'is_premiere', r.is_premiere,
        'premiere_matched_record', r.premiere_record,
        'snapshot_at', now()
      )
    FROM ranked r
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM inserted;

  RETURN v_inserted;
END $$;
