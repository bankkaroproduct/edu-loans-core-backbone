
DO $$
DECLARE
  v_lender_id uuid;
  v_old_id uuid;
  v_old_version int;
  v_new_id uuid;
  v_pf_overlay jsonb;
  v_codes text[] := ARRAY['AVANSE','AXIS','BOB','HDFC','ICICI','SBI'];
  v_overlays jsonb := jsonb_build_object(
    'AVANSE', jsonb_build_object('processing_fee_pct', NULL, 'processing_fee_pct_min', 1, 'processing_fee_pct_max', 1.25, 'processing_fee_flat', NULL, 'processing_fee_gst_applicable', true),
    'AXIS',   jsonb_build_object('processing_fee_pct', 1,    'processing_fee_pct_min', NULL, 'processing_fee_pct_max', NULL, 'processing_fee_flat', NULL, 'processing_fee_gst_applicable', true),
    'BOB',    jsonb_build_object('processing_fee_pct', NULL, 'processing_fee_pct_min', NULL, 'processing_fee_pct_max', NULL, 'processing_fee_flat', 10000, 'processing_fee_gst_applicable', true),
    'HDFC',   jsonb_build_object('processing_fee_pct', NULL, 'processing_fee_pct_min', 1, 'processing_fee_pct_max', 1.25, 'processing_fee_flat', NULL, 'processing_fee_gst_applicable', true),
    'ICICI',  jsonb_build_object('processing_fee_pct', 1,    'processing_fee_pct_min', NULL, 'processing_fee_pct_max', NULL, 'processing_fee_flat', NULL, 'processing_fee_gst_applicable', true),
    'SBI',    jsonb_build_object('processing_fee_pct', NULL, 'processing_fee_pct_min', NULL, 'processing_fee_pct_max', NULL, 'processing_fee_flat', 10000, 'processing_fee_gst_applicable', true)
  );
  v_summaries jsonb := jsonb_build_object(
    'AVANSE','PF rollout: source-backed processing fee 1%-1.25% + GST',
    'AXIS','PF rollout: source-backed processing fee 1% + GST',
    'BOB','PF rollout: source-backed processing fee flat Rs.10,000 + GST',
    'HDFC','PF rollout: source-backed processing fee 1%-1.25% + GST',
    'ICICI','PF rollout: source-backed processing fee 1% + GST',
    'SBI','PF rollout: source-backed processing fee flat Rs.10,000 + GST'
  );
  v_code text;
BEGIN
  FOREACH v_code IN ARRAY v_codes LOOP
    SELECT id INTO v_lender_id FROM public.lenders WHERE lender_code = v_code;
    IF v_lender_id IS NULL THEN CONTINUE; END IF;
    SELECT id, version_number INTO v_old_id, v_old_version
      FROM public.bre_lender_rules WHERE lender_id = v_lender_id AND is_active = true;
    IF v_old_id IS NULL THEN CONTINUE; END IF;

    v_pf_overlay := v_overlays -> v_code;

    -- Deactivate first to avoid conflict with the partial-unique active constraint
    UPDATE public.bre_lender_rules SET is_active = false WHERE id = v_old_id;

    INSERT INTO public.bre_lender_rules
      (id, lender_id, version_number, is_active, basic_info, commercials, hard_thresholds, loan_caps, collateral_ltv, coverage, policy, change_summary, created_by)
    SELECT gen_random_uuid(), lender_id, v_old_version + 1, true,
           basic_info, commercials || v_pf_overlay, hard_thresholds, loan_caps, collateral_ltv, coverage, policy,
           v_summaries ->> v_code, created_by
      FROM public.bre_lender_rules WHERE id = v_old_id
    RETURNING id INTO v_new_id;

    UPDATE public.lenders SET bre_rule_id = v_new_id, updated_at = now() WHERE id = v_lender_id;
  END LOOP;
END $$;
