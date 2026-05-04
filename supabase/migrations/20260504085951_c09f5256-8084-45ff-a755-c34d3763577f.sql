-- Source-backed ROI update: clone active bre_lender_rules row per lender,
-- bump version_number, modify only policy.roi_min and policy.roi_max,
-- activate new row, deactivate old row. Single transaction.
-- Source: Supply_Lender_BRE-2.xlsx (uploaded by admin), secured ROI (and Credila Effective ROI).

DO $$
DECLARE
  v_lender RECORD;
  v_old RECORD;
  v_new_id UUID;
  -- Lender code -> [roi_min, roi_max] mapping (secured-only per approval)
  v_updates JSONB := '{
    "AVANSE":  {"roi_min": 9.50,  "roi_max": 10.50},
    "AXIS":    {"roi_min": 9.50,  "roi_max": 10.50},
    "BOB":     {"roi_min": 8.50,  "roi_max": 10.00},
    "HDFC":    {"roi_min": 9.75,  "roi_max": 9.95},
    "ICICI":   {"roi_min": 9.50,  "roi_max": 10.50},
    "SBI":     {"roi_min": 8.50,  "roi_max": 10.00}
  }'::JSONB;
  v_code TEXT;
  v_new_min NUMERIC;
  v_new_max NUMERIC;
  v_new_policy JSONB;
BEGIN
  FOR v_code IN SELECT jsonb_object_keys(v_updates)
  LOOP
    SELECT * INTO v_lender FROM lenders WHERE lender_code = v_code AND active_flag = true LIMIT 1;
    IF v_lender.id IS NULL THEN
      RAISE NOTICE 'Lender % not found, skipping', v_code;
      CONTINUE;
    END IF;

    SELECT * INTO v_old FROM bre_lender_rules
      WHERE lender_id = v_lender.id AND is_active = true
      ORDER BY version_number DESC LIMIT 1;
    IF v_old.id IS NULL THEN
      RAISE NOTICE 'No active rule for lender %, skipping', v_code;
      CONTINUE;
    END IF;

    v_new_min := (v_updates -> v_code ->> 'roi_min')::NUMERIC;
    v_new_max := (v_updates -> v_code ->> 'roi_max')::NUMERIC;

    -- Clone policy, override ONLY roi_min and roi_max
    v_new_policy := COALESCE(v_old.policy, '{}'::jsonb)
                    || jsonb_build_object('roi_min', v_new_min, 'roi_max', v_new_max);

    -- Deactivate old
    UPDATE bre_lender_rules SET is_active = false WHERE id = v_old.id;

    -- Insert new version (clone of old, with new policy)
    INSERT INTO bre_lender_rules (
      lender_id, version_number, is_active,
      basic_info, commercials, hard_thresholds, loan_caps,
      collateral_ltv, coverage, policy,
      change_summary, created_by
    ) VALUES (
      v_old.lender_id,
      v_old.version_number + 1,
      true,
      v_old.basic_info,
      v_old.commercials,
      v_old.hard_thresholds,
      v_old.loan_caps,
      v_old.collateral_ltv,
      v_old.coverage,
      v_new_policy,
      'Source-backed ROI update from Supply_Lender_BRE-2.xlsx (secured ROI; Credila Effective ROI). Only policy.roi_min and policy.roi_max changed.',
      v_old.created_by
    )
    RETURNING id INTO v_new_id;

    RAISE NOTICE 'Lender % v% -> v% (ROI %-% -> %-%)',
      v_code, v_old.version_number, v_old.version_number + 1,
      v_old.policy->>'roi_min', v_old.policy->>'roi_max',
      v_new_min, v_new_max;
  END LOOP;
END $$;