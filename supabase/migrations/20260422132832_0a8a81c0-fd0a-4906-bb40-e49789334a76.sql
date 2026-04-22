
-- =========================================================================
-- PHASE 1: BRE Foundation
-- =========================================================================

-- 1. New columns on existing tables -----------------------------------------

ALTER TABLE public.lenders
  ADD COLUMN IF NOT EXISTS bre_rule_id uuid;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS bre_permission text NOT NULL DEFAULT 'none'
  CHECK (bre_permission IN ('none','read','edit','full'));

-- 2. bre_scoring_configs ----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.bre_scoring_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number integer NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  student_params jsonb NOT NULL DEFAULT '[]'::jsonb,
  university_params jsonb NOT NULL DEFAULT '[]'::jsonb,
  coapplicant_params jsonb NOT NULL DEFAULT '[]'::jsonb,
  overall_band_mapping jsonb NOT NULL DEFAULT '[]'::jsonb,
  bucket_threshold numeric NOT NULL DEFAULT 60,
  change_summary text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bre_scoring_configs_version_unique UNIQUE (version_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS bre_scoring_configs_one_active
  ON public.bre_scoring_configs (is_active)
  WHERE is_active = true;

ALTER TABLE public.bre_scoring_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage bre scoring configs"
  ON public.bre_scoring_configs
  FOR ALL
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

-- 3. bre_lender_rules -------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.bre_lender_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id uuid NOT NULL,
  version_number integer NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  basic_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  commercials jsonb NOT NULL DEFAULT '{}'::jsonb,
  hard_thresholds jsonb NOT NULL DEFAULT '{}'::jsonb,
  loan_caps jsonb NOT NULL DEFAULT '{}'::jsonb,
  collateral_ltv jsonb NOT NULL DEFAULT '{}'::jsonb,
  coverage jsonb NOT NULL DEFAULT '{}'::jsonb,
  policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  change_summary text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bre_lender_rules_lender_version_unique UNIQUE (lender_id, version_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS bre_lender_rules_one_active_per_lender
  ON public.bre_lender_rules (lender_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS bre_lender_rules_lender_idx
  ON public.bre_lender_rules (lender_id);

ALTER TABLE public.bre_lender_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage bre lender rules"
  ON public.bre_lender_rules
  FOR ALL
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

-- 4. bre_simulation_runs ----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.bre_simulation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_input jsonb NOT NULL,
  result jsonb NOT NULL,
  scoring_config_version integer NOT NULL,
  saved_name text,
  run_by uuid,
  run_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bre_simulation_runs_run_at_idx
  ON public.bre_simulation_runs (run_at DESC);

ALTER TABLE public.bre_simulation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage bre simulation runs"
  ON public.bre_simulation_runs
  FOR ALL
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

-- 5. Validation trigger for bre_scoring_configs ------------------------------

CREATE OR REPLACE FUNCTION public.bre_validate_scoring_config()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_bucket text;
  v_params jsonb;
  v_param jsonb;
  v_bands jsonb;
  v_band jsonb;
  v_band_b jsonb;
  v_weight_sum numeric;
  v_score numeric;
  v_a_from numeric; v_a_to numeric;
  v_b_from numeric; v_b_to numeric;
  v_i int; v_j int; v_n int;
BEGIN
  FOR v_bucket IN SELECT unnest(ARRAY['student_params','university_params','coapplicant_params']) LOOP
    EXECUTE format('SELECT ($1).%I', v_bucket) INTO v_params USING NEW;

    IF v_params IS NULL OR jsonb_typeof(v_params) <> 'array' THEN
      RAISE EXCEPTION 'bre scoring config: % must be a JSON array', v_bucket;
    END IF;

    -- Sum weights
    v_weight_sum := 0;
    FOR v_param IN SELECT * FROM jsonb_array_elements(v_params) LOOP
      IF NOT (v_param ? 'weight') THEN
        RAISE EXCEPTION 'bre scoring config: every parameter in % requires a weight', v_bucket;
      END IF;
      v_weight_sum := v_weight_sum + COALESCE((v_param->>'weight')::numeric, 0);
    END LOOP;

    IF v_weight_sum <> 100 THEN
      RAISE EXCEPTION 'bre scoring config: % weights must sum to 100 (got %)', v_bucket, v_weight_sum;
    END IF;

    -- Per-parameter band checks
    FOR v_param IN SELECT * FROM jsonb_array_elements(v_params) LOOP
      v_bands := COALESCE(v_param->'bands', '[]'::jsonb);
      IF jsonb_typeof(v_bands) <> 'array' THEN
        RAISE EXCEPTION 'bre scoring config: bands must be an array (parameter: %)', v_param->>'param_key';
      END IF;

      v_n := jsonb_array_length(v_bands);

      -- score range 0..100
      FOR v_i IN 0..v_n-1 LOOP
        v_band := v_bands -> v_i;
        v_score := COALESCE((v_band->>'score')::numeric, -1);
        IF v_score < 0 OR v_score > 100 THEN
          RAISE EXCEPTION 'bre scoring config: band score must be between 0 and 100 (parameter: %, got %)',
            v_param->>'param_key', v_score;
        END IF;
      END LOOP;

      -- overlap detection (numeric bands only)
      FOR v_i IN 0..v_n-1 LOOP
        v_band := v_bands -> v_i;
        IF (v_band ? 'from') AND (v_band ? 'to') THEN
          v_a_from := (v_band->>'from')::numeric;
          v_a_to   := (v_band->>'to')::numeric;
          IF v_a_from > v_a_to THEN
            RAISE EXCEPTION 'bre scoring config: band from > to (parameter: %)', v_param->>'param_key';
          END IF;
          FOR v_j IN v_i+1..v_n-1 LOOP
            v_band_b := v_bands -> v_j;
            IF (v_band_b ? 'from') AND (v_band_b ? 'to') THEN
              v_b_from := (v_band_b->>'from')::numeric;
              v_b_to   := (v_band_b->>'to')::numeric;
              IF v_a_from <= v_b_to AND v_b_from <= v_a_to THEN
                RAISE EXCEPTION 'bre scoring config: overlapping bands in parameter % (% -% vs % -%)',
                  v_param->>'param_key', v_a_from, v_a_to, v_b_from, v_b_to;
              END IF;
            END IF;
          END LOOP;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bre_validate_scoring_config_trg ON public.bre_scoring_configs;
CREATE TRIGGER bre_validate_scoring_config_trg
  BEFORE INSERT OR UPDATE ON public.bre_scoring_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.bre_validate_scoring_config();

-- =========================================================================
-- 6. SEED — Global Scoring Config v1
-- =========================================================================

INSERT INTO public.bre_scoring_configs (
  version_number, is_active, change_summary,
  student_params, university_params, coapplicant_params,
  overall_band_mapping, bucket_threshold
) VALUES (
  1, true, 'Initial v1 default scoring configuration',
  -- student_params: weights 15+20+25+10+15+15 = 100
  '[
    {"param_key":"class_x_marks","label":"Class X marks (%)","input_type":"number","weight":15,
     "bands":[
       {"from":90,"to":100,"score":100,"label":"Excellent"},
       {"from":75,"to":89.99,"score":80,"label":"Good"},
       {"from":60,"to":74.99,"score":60,"label":"Average"},
       {"from":0,"to":59.99,"score":30,"label":"Weak"}
     ]},
    {"param_key":"class_xii_marks","label":"Class XII marks (%)","input_type":"number","weight":20,
     "bands":[
       {"from":90,"to":100,"score":100,"label":"Excellent"},
       {"from":75,"to":89.99,"score":80,"label":"Good"},
       {"from":60,"to":74.99,"score":60,"label":"Average"},
       {"from":0,"to":59.99,"score":30,"label":"Weak"}
     ]},
    {"param_key":"graduation_marks","label":"Graduation marks (%)","input_type":"number","weight":25,
     "bands":[
       {"from":80,"to":100,"score":100,"label":"Excellent"},
       {"from":65,"to":79.99,"score":80,"label":"Good"},
       {"from":50,"to":64.99,"score":60,"label":"Average"},
       {"from":0,"to":49.99,"score":30,"label":"Weak"}
     ]},
    {"param_key":"entrance_rank","label":"Entrance test percentile","input_type":"number","weight":10,
     "bands":[
       {"from":90,"to":100,"score":100,"label":"Top decile"},
       {"from":75,"to":89.99,"score":80,"label":"Strong"},
       {"from":50,"to":74.99,"score":60,"label":"Average"},
       {"from":0,"to":49.99,"score":30,"label":"Weak"}
     ]},
    {"param_key":"work_experience_years","label":"Work experience (years)","input_type":"number","weight":15,
     "bands":[
       {"from":3,"to":99,"score":100,"label":"3+ years"},
       {"from":1,"to":2.99,"score":70,"label":"1-3 years"},
       {"from":0,"to":0.99,"score":40,"label":"Fresher"}
     ]},
    {"param_key":"english_proficiency","label":"English proficiency score","input_type":"number","weight":15,
     "bands":[
       {"from":7.5,"to":9,"score":100,"label":"IELTS 7.5+ / equivalent"},
       {"from":6.5,"to":7.49,"score":80,"label":"IELTS 6.5-7.4"},
       {"from":6,"to":6.49,"score":60,"label":"IELTS 6.0"},
       {"from":0,"to":5.99,"score":30,"label":"Below 6.0"}
     ]}
  ]'::jsonb,
  -- university_params: weights 40+25+20+10+5 = 100
  '[
    {"param_key":"university_tier","label":"University tier","input_type":"enum","weight":40,
     "bands":[
       {"value":"premium","score":100,"label":"Premium / Ivy"},
       {"value":"tier_1","score":85,"label":"Tier 1"},
       {"value":"tier_2","score":65,"label":"Tier 2"},
       {"value":"tier_3","score":40,"label":"Tier 3"},
       {"value":"unranked","score":20,"label":"Unranked"}
     ]},
    {"param_key":"country_tier","label":"Destination country tier","input_type":"enum","weight":25,
     "bands":[
       {"value":"tier_1","score":100,"label":"US / UK / CA / AU / DE"},
       {"value":"tier_2","score":75,"label":"NZ / IE / SG / NL / FR"},
       {"value":"tier_3","score":50,"label":"Other developed"},
       {"value":"tier_4","score":25,"label":"Emerging"}
     ]},
    {"param_key":"course_category","label":"Course category","input_type":"enum","weight":20,
     "bands":[
       {"value":"stem","score":100,"label":"STEM"},
       {"value":"mba","score":95,"label":"MBA"},
       {"value":"management","score":80,"label":"Management / Business"},
       {"value":"healthcare","score":85,"label":"Healthcare"},
       {"value":"arts","score":55,"label":"Arts / Humanities"},
       {"value":"other","score":50,"label":"Other"}
     ]},
    {"param_key":"course_level","label":"Course level","input_type":"enum","weight":10,
     "bands":[
       {"value":"masters","score":100,"label":"Masters"},
       {"value":"phd","score":90,"label":"PhD"},
       {"value":"bachelors","score":70,"label":"Bachelors"},
       {"value":"diploma","score":40,"label":"Diploma"}
     ]},
    {"param_key":"employability_outlook","label":"Employability outlook","input_type":"enum","weight":5,
     "bands":[
       {"value":"high","score":100,"label":"High"},
       {"value":"medium","score":70,"label":"Medium"},
       {"value":"low","score":40,"label":"Low"}
     ]}
  ]'::jsonb,
  -- coapplicant_params: weights 10+10+10+30+25+10+5 = 100
  '[
    {"param_key":"relationship","label":"Relationship to student","input_type":"enum","weight":10,
     "bands":[
       {"value":"parent","score":100,"label":"Parent"},
       {"value":"sibling","score":80,"label":"Sibling"},
       {"value":"spouse","score":85,"label":"Spouse"},
       {"value":"relative","score":60,"label":"Other relative"},
       {"value":"other","score":30,"label":"Other"}
     ]},
    {"param_key":"age","label":"Co-applicant age (years)","input_type":"number","weight":10,
     "bands":[
       {"from":35,"to":55,"score":100,"label":"Prime"},
       {"from":25,"to":34.99,"score":80,"label":"Young earner"},
       {"from":56,"to":62,"score":60,"label":"Pre-retirement"},
       {"from":63,"to":99,"score":20,"label":"Retired"}
     ]},
    {"param_key":"employment_type","label":"Employment type","input_type":"enum","weight":10,
     "bands":[
       {"value":"salaried_govt","score":100,"label":"Salaried (Govt / PSU)"},
       {"value":"salaried_private","score":85,"label":"Salaried (Private)"},
       {"value":"self_employed_professional","score":75,"label":"Self-employed Professional"},
       {"value":"self_employed_business","score":65,"label":"Self-employed Business"},
       {"value":"retired_with_pension","score":55,"label":"Retired (Pension)"},
       {"value":"unemployed","score":10,"label":"Unemployed"}
     ]},
    {"param_key":"monthly_income","label":"Monthly income (INR)","input_type":"number","weight":30,
     "bands":[
       {"from":150000,"to":99999999,"score":100,"label":"₹1.5L+"},
       {"from":75000,"to":149999.99,"score":85,"label":"₹75K-1.5L"},
       {"from":40000,"to":74999.99,"score":65,"label":"₹40K-75K"},
       {"from":25000,"to":39999.99,"score":40,"label":"₹25K-40K"},
       {"from":0,"to":24999.99,"score":20,"label":"Below ₹25K"}
     ]},
    {"param_key":"cibil_score","label":"CIBIL score","input_type":"number","weight":25,
     "bands":[
       {"from":750,"to":900,"score":100,"label":"Excellent"},
       {"from":700,"to":749,"score":80,"label":"Good"},
       {"from":650,"to":699,"score":55,"label":"Fair"},
       {"from":600,"to":649,"score":30,"label":"Poor"},
       {"from":0,"to":599,"score":10,"label":"Very poor"}
     ]},
    {"param_key":"existing_emi_burden_pct","label":"Existing EMI burden (% of income)","input_type":"number","weight":10,
     "bands":[
       {"from":0,"to":20,"score":100,"label":"Light"},
       {"from":20.01,"to":40,"score":70,"label":"Moderate"},
       {"from":40.01,"to":60,"score":40,"label":"Heavy"},
       {"from":60.01,"to":100,"score":15,"label":"Overstretched"}
     ]},
    {"param_key":"income_stability_years","label":"Income stability (years)","input_type":"number","weight":5,
     "bands":[
       {"from":5,"to":99,"score":100,"label":"5+ years"},
       {"from":2,"to":4.99,"score":75,"label":"2-5 years"},
       {"from":0,"to":1.99,"score":40,"label":"<2 years"}
     ]}
  ]'::jsonb,
  -- overall_band_mapping
  '[
    {"from":85,"to":100,"band":"A+","loan_min":3000000,"loan_max":15000000,"rate_min":9.5,"rate_max":10.75,"label":"Strong approval"},
    {"from":70,"to":84.99,"band":"A","loan_min":2000000,"loan_max":10000000,"rate_min":10.5,"rate_max":11.75,"label":"Approval"},
    {"from":60,"to":69.99,"band":"B","loan_min":1000000,"loan_max":6000000,"rate_min":11.5,"rate_max":13,"label":"Approval with conditions"},
    {"from":40,"to":59.99,"band":"C","loan_min":500000,"loan_max":3000000,"rate_min":12.5,"rate_max":14.5,"label":"Borderline"},
    {"from":0,"to":39.99,"band":"D","loan_min":0,"loan_max":0,"rate_min":0,"rate_max":0,"label":"Reject"}
  ]'::jsonb,
  60
);

-- =========================================================================
-- 7. SEED — Lender Rules v1 (one active row per existing lender)
-- =========================================================================

INSERT INTO public.bre_lender_rules (
  lender_id, version_number, is_active,
  basic_info, commercials, hard_thresholds, loan_caps, collateral_ltv, coverage, policy,
  change_summary
)
SELECT
  l.id,
  1,
  true,
  jsonb_build_object(
    'lender_name', l.lender_name,
    'lender_code', l.lender_code,
    'lender_type', l.lender_type,
    'active', l.active_flag,
    'spoc_name', null,
    'spoc_email', null,
    'logo_url', null
  ) AS basic_info,
  jsonb_build_object(
    'payout_pct', null,
    'payout_trigger_stage', null,
    'processing_fee_pct', null,
    'processing_fee_flat', null
  ) AS commercials,
  jsonb_build_object(
    'min_coapplicant_income', l.income_expectations_min,
    'min_age', null,
    'max_age', null,
    'min_cibil', null,
    'max_dpd_months', null,
    'min_itr_years', null,
    'allowed_relationships', null
  ) AS hard_thresholds,
  jsonb_build_object(
    'secured', CASE WHEN l.supports_collateral
      THEN jsonb_build_object('min', l.loan_amount_min, 'max', l.loan_amount_max)
      ELSE jsonb_build_object('min', null, 'max', null) END,
    'unsecured', CASE WHEN l.supports_unsecured
      THEN jsonb_build_object('min', l.loan_amount_min, 'max', l.loan_amount_max)
      ELSE jsonb_build_object('min', null, 'max', null) END
  ) AS loan_caps,
  jsonb_build_object(
    'fd_ltv_pct', null,
    'residential_ltv_pct', null,
    'commercial_ltv_pct', null
  ) AS collateral_ltv,
  jsonb_build_object(
    'supported_countries', to_jsonb(COALESCE(l.supported_countries, ARRAY[]::text[])),
    'excluded_states', '[]'::jsonb,
    'accepted_courses', '[]'::jsonb,
    'university_tier_overrides', '[]'::jsonb
  ) AS coverage,
  jsonb_build_object(
    'processing_time_days', l.processing_time_days,
    'roi_min', null,
    'roi_max', null,
    'tenure_min_years', null,
    'tenure_max_years', null,
    'moratorium_months', null,
    'notes', l.internal_notes
  ) AS policy,
  'Initial v1 seed from existing lender row'
FROM public.lenders l
WHERE NOT EXISTS (
  SELECT 1 FROM public.bre_lender_rules r WHERE r.lender_id = l.id AND r.version_number = 1
);

-- Backfill lenders.bre_rule_id to active rule
UPDATE public.lenders l
SET bre_rule_id = r.id
FROM public.bre_lender_rules r
WHERE r.lender_id = l.id AND r.is_active = true AND l.bre_rule_id IS DISTINCT FROM r.id;

-- =========================================================================
-- 8. SEED — users.bre_permission by role
-- =========================================================================

UPDATE public.users SET bre_permission = 'full' WHERE role = 'super_admin';
UPDATE public.users SET bre_permission = 'edit' WHERE role = 'admin';
UPDATE public.users SET bre_permission = 'none' WHERE role NOT IN ('super_admin','admin');
