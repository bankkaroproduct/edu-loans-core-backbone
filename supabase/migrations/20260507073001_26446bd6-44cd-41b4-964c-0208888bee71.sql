
DO $$
DECLARE
  r RECORD;
  v_new_id uuid;
  v_new_version int;
  v_scorecard jsonb;
  v_default_weights jsonb := '[
    {"factor":"cibil","weight":18,"provenance":"proposed"},
    {"factor":"income","weight":14,"provenance":"proposed"},
    {"factor":"emi_foir","weight":10,"provenance":"proposed"},
    {"factor":"income_stability","weight":8,"provenance":"inferred"},
    {"factor":"academics","weight":10,"provenance":"proposed"},
    {"factor":"backlogs","weight":5,"provenance":"proposed"},
    {"factor":"university_course","weight":12,"provenance":"inferred"},
    {"factor":"collateral_route","weight":10,"provenance":"source_backed"},
    {"factor":"loan_amount_fit","weight":8,"provenance":"source_backed"},
    {"factor":"coverage","weight":3,"provenance":"source_backed"},
    {"factor":"processing_ops","weight":2,"provenance":"inferred"}
  ]'::jsonb;
BEGIN
  FOR r IN
    SELECT br.id AS rule_id, br.lender_id, br.version_number,
           br.basic_info, br.commercials, br.hard_thresholds, br.loan_caps,
           br.collateral_ltv, br.coverage, br.policy,
           l.lender_code, l.lender_name
    FROM public.bre_lender_rules br
    JOIN public.lenders l ON l.id = br.lender_id
    WHERE br.is_active = true
      AND l.active_flag = true
      AND br.scorecard IS NULL
  LOOP
    IF upper(r.lender_code) = 'ICICI' THEN
      v_scorecard := jsonb_build_object(
        'display_label','ICICI scorecard (income-weighted)',
        'weights', '[
          {"factor":"cibil","weight":20,"provenance":"source_backed"},
          {"factor":"income","weight":18,"provenance":"proposed"},
          {"factor":"emi_foir","weight":12,"provenance":"proposed"},
          {"factor":"income_stability","weight":10,"provenance":"inferred"},
          {"factor":"academics","weight":8,"provenance":"proposed"},
          {"factor":"backlogs","weight":4,"provenance":"proposed"},
          {"factor":"university_course","weight":10,"provenance":"inferred"},
          {"factor":"collateral_route","weight":8,"provenance":"source_backed"},
          {"factor":"loan_amount_fit","weight":6,"provenance":"source_backed"},
          {"factor":"coverage","weight":2,"provenance":"source_backed"},
          {"factor":"processing_ops","weight":2,"provenance":"inferred"}
        ]'::jsonb,
        'income_floor_monthly', 40000,
        'income_floor_provenance','proposed',
        'notes','Rs.40k floor is proposed default; source conflict (30k vs 40k) - business validation pending.',
        'needs_business_validation', true
      );
    ELSIF upper(r.lender_code) = 'AXIS' THEN
      v_scorecard := jsonb_build_object(
        'display_label','Axis scorecard (income-weighted)',
        'weights', '[
          {"factor":"cibil","weight":18,"provenance":"source_backed"},
          {"factor":"income","weight":18,"provenance":"proposed"},
          {"factor":"emi_foir","weight":12,"provenance":"proposed"},
          {"factor":"income_stability","weight":10,"provenance":"inferred"},
          {"factor":"academics","weight":9,"provenance":"proposed"},
          {"factor":"backlogs","weight":4,"provenance":"proposed"},
          {"factor":"university_course","weight":10,"provenance":"inferred"},
          {"factor":"collateral_route","weight":9,"provenance":"source_backed"},
          {"factor":"loan_amount_fit","weight":6,"provenance":"source_backed"},
          {"factor":"coverage","weight":2,"provenance":"source_backed"},
          {"factor":"processing_ops","weight":2,"provenance":"inferred"}
        ]'::jsonb,
        'income_floor_monthly', 40000,
        'income_floor_provenance','proposed',
        'notes','Rs.40k floor is proposed default; source conflict (35k vs 40k) - business validation pending.',
        'needs_business_validation', true
      );
    ELSIF upper(r.lender_code) = 'HDFC' THEN
      v_scorecard := jsonb_build_object(
        'display_label','Credila scorecard (university-weighted)',
        'weights', '[
          {"factor":"university_course","weight":22,"provenance":"source_backed"},
          {"factor":"cibil","weight":14,"provenance":"source_backed"},
          {"factor":"academics","weight":12,"provenance":"proposed"},
          {"factor":"income","weight":10,"provenance":"proposed"},
          {"factor":"emi_foir","weight":8,"provenance":"proposed"},
          {"factor":"income_stability","weight":6,"provenance":"inferred"},
          {"factor":"backlogs","weight":4,"provenance":"proposed"},
          {"factor":"collateral_route","weight":10,"provenance":"source_backed"},
          {"factor":"loan_amount_fit","weight":8,"provenance":"source_backed"},
          {"factor":"coverage","weight":4,"provenance":"source_backed"},
          {"factor":"processing_ops","weight":2,"provenance":"inferred"}
        ]'::jsonb,
        'income_floor_monthly', 30000,
        'income_floor_provenance','inferred'
      );
    ELSIF upper(r.lender_code) = 'IDFC' THEN
      v_scorecard := jsonb_build_object(
        'display_label','IDFC FIRST scorecard',
        'weights', v_default_weights,
        'income_floor_monthly', 35000,
        'income_floor_provenance','proposed'
      );
    ELSIF upper(r.lender_code) IN ('AVANSE','AUXILO','GYANDHAN') THEN
      v_scorecard := jsonb_build_object(
        'display_label', r.lender_name || ' scorecard (default)',
        'weights', v_default_weights,
        'income_floor_monthly', 30000,
        'income_floor_provenance','proposed',
        'notes','NBFC default weights; income floor proposed - business validation pending.'
      );
    ELSE
      v_scorecard := jsonb_build_object(
        'display_label', r.lender_name || ' scorecard (default)',
        'weights', v_default_weights,
        'income_floor_monthly', 35000,
        'income_floor_provenance','proposed',
        'notes','PSU default weights; Rs.35k floor proposed - business validation pending.'
      );
    END IF;

    v_new_version := r.version_number + 1;

    -- Deactivate old FIRST to honor the one-active-per-lender unique index.
    UPDATE public.bre_lender_rules SET is_active = false WHERE id = r.rule_id;

    INSERT INTO public.bre_lender_rules
      (lender_id, version_number, is_active,
       basic_info, commercials, hard_thresholds, loan_caps,
       collateral_ltv, coverage, policy, scorecard,
       change_summary, created_by)
    VALUES
      (r.lender_id, v_new_version, true,
       r.basic_info, r.commercials, r.hard_thresholds, r.loan_caps,
       r.collateral_ltv, r.coverage, r.policy, v_scorecard,
       'Step 3 closure: attach lender-specific BRE scorecard (proposed where flagged). No other fields changed.',
       NULL)
    RETURNING id INTO v_new_id;

    UPDATE public.lenders
       SET bre_rule_id = v_new_id, updated_at = now()
     WHERE id = r.lender_id;

    INSERT INTO public.audit_logs
      (entity_type, entity_id, action_type, actor_user_id, actor_role, meta)
    VALUES
      ('bre_lender_rule', v_new_id, 'bre_lender_rule_scorecard_attached',
       NULL, NULL,
       jsonb_build_object(
         'lender_id', r.lender_id,
         'lender_code', r.lender_code,
         'old_version', r.version_number,
         'new_version', v_new_version,
         'old_rule_id', r.rule_id,
         'reason','Step 3 closure - attach lender-specific scorecard'
       ));
  END LOOP;
END $$;
