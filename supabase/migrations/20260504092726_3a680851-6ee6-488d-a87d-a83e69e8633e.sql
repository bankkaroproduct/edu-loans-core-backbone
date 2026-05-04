-- Route-specific ROI version bumps for 6 source-backed lenders.
-- Strategy: for each lender_code, clone the currently active row, deactivate it,
-- and insert a new active version with policy ROI fields merged.

DO $$
DECLARE
  rec RECORD;
  new_policy JSONB;
  next_version INT;
  roi_map JSONB := jsonb_build_object(
    'AVANSE', jsonb_build_object('roi_secured_min', 9.50, 'roi_secured_max', 10.50, 'roi_unsecured_min', 11.50, 'roi_unsecured_max', 12.50, 'roi_min', 9.50, 'roi_max', 10.50),
    'AXIS',   jsonb_build_object('roi_secured_min', 9.50, 'roi_secured_max', 10.50, 'roi_unsecured_min', 11.00, 'roi_unsecured_max', 13.00, 'roi_min', 9.50, 'roi_max', 10.50),
    'BOB',    jsonb_build_object('roi_secured_min', 8.50, 'roi_secured_max', 10.00, 'roi_unsecured_min', NULL, 'roi_unsecured_max', NULL, 'roi_min', 8.50, 'roi_max', 10.00),
    'HDFC',   jsonb_build_object('roi_secured_min', 9.75, 'roi_secured_max', 9.95,  'roi_unsecured_min', 11.25, 'roi_unsecured_max', 11.75, 'roi_min', 9.75, 'roi_max', 9.95),
    'ICICI',  jsonb_build_object('roi_secured_min', 9.50, 'roi_secured_max', 10.50, 'roi_unsecured_min', 11.00, 'roi_unsecured_max', 13.00, 'roi_min', 9.50, 'roi_max', 10.50),
    'SBI',    jsonb_build_object('roi_secured_min', 8.50, 'roi_secured_max', 10.00, 'roi_unsecured_min', 9.00,  'roi_unsecured_max', 10.50, 'roi_min', 8.50, 'roi_max', 10.00)
  );
  code TEXT;
BEGIN
  FOR code IN SELECT jsonb_object_keys(roi_map) LOOP
    SELECT * INTO rec
    FROM bre_lender_rules
    WHERE is_active = true
      AND basic_info->>'lender_code' = code
    LIMIT 1;

    IF rec.id IS NULL THEN
      RAISE NOTICE 'No active rule found for %, skipping', code;
      CONTINUE;
    END IF;

    -- Merge route-specific ROI into existing policy
    new_policy := COALESCE(rec.policy, '{}'::jsonb) || (roi_map -> code);

    SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_version
    FROM bre_lender_rules
    WHERE lender_id = rec.lender_id;

    -- Deactivate old version
    UPDATE bre_lender_rules SET is_active = false WHERE id = rec.id;

    -- Insert new active version, preserving every other field
    INSERT INTO bre_lender_rules (
      lender_id, version_number, is_active,
      basic_info, commercials, hard_thresholds,
      loan_caps, collateral_ltv, coverage, policy,
      change_summary, created_by
    ) VALUES (
      rec.lender_id, next_version, true,
      rec.basic_info, rec.commercials, rec.hard_thresholds,
      rec.loan_caps, rec.collateral_ltv, rec.coverage, new_policy,
      'Route-specific ROI (secured/unsecured) added from verified sources',
      rec.created_by
    );
  END LOOP;
END $$;