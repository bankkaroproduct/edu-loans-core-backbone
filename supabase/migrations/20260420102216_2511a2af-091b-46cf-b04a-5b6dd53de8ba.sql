-- Temporary test helpers to run QA without auth.uid() context.
-- These will be dropped at the end of QA.

CREATE OR REPLACE FUNCTION public._qa_submit_edit_request(
  _actor_auth_id uuid,
  _lead_id uuid,
  _changes jsonb,
  _reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_partner uuid;
  v_lead student_leads%ROWTYPE;
  v_filtered jsonb := '{}'::jsonb;
  v_request_id uuid;
  v_whitelist text[] := ARRAY[
    'student_email','student_phone','student_whatsapp',
    'student_first_name','student_last_name','student_full_name',
    'student_dob','student_gender',
    'city','state','country_of_residence','pincode',
    'intended_study_country','intake_term','intake_year',
    'course_name','course_category','university_name_raw','loan_amount_required',
    'highest_qualification','marks_gpa','test_scores',
    'coapplicant_name','coapplicant_relation','coapplicant_mobile','coapplicant_email',
    'coapplicant_income','coapplicant_employment_type','coapplicant_employer','coapplicant_existing_emi',
    'collateral_available','collateral_notes'
  ];
  v_key text;
BEGIN
  SELECT id, partner_id INTO v_actor_id, v_actor_partner
  FROM public.users WHERE auth_user_id = _actor_auth_id LIMIT 1;
  IF v_actor_id IS NULL THEN
    SELECT id, partner_id INTO v_actor_id, v_actor_partner
    FROM public.users WHERE id = _actor_auth_id LIMIT 1;
  END IF;
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'forbidden: actor user not found'; END IF;

  SELECT * INTO v_lead FROM public.student_leads WHERE id = _lead_id;
  IF v_lead.id IS NULL THEN RAISE EXCEPTION 'lead not found'; END IF;
  IF v_lead.partner_id <> v_actor_partner THEN RAISE EXCEPTION 'forbidden: lead does not belong to your organization'; END IF;
  IF v_lead.current_stage IN ('disbursed','rejected','dropped') THEN
    RAISE EXCEPTION 'lead is in terminal stage % and cannot be edited', v_lead.current_stage;
  END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 10 THEN
    RAISE EXCEPTION 'reason of at least 10 characters is required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.lead_edit_requests WHERE lead_id = _lead_id AND status = 'pending') THEN
    RAISE EXCEPTION 'a pending edit request already exists for this lead';
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(_changes) LOOP
    IF v_key = ANY(v_whitelist) THEN
      v_filtered := v_filtered || jsonb_build_object(v_key, _changes -> v_key);
    END IF;
  END LOOP;

  IF v_filtered = '{}'::jsonb THEN
    RAISE EXCEPTION 'no_changes_to_submit: no editable fields present in request';
  END IF;

  INSERT INTO public.lead_edit_requests
    (lead_id, partner_id, requested_by_user_id, status, requested_changes, partner_reason)
  VALUES
    (_lead_id, v_lead.partner_id, v_actor_id, 'pending', v_filtered, trim(_reason))
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object('ok', true, 'request_id', v_request_id);
END;
$$;

CREATE OR REPLACE FUNCTION public._qa_decide_edit_request(
  _actor_auth_id uuid,
  _request_id uuid,
  _action text,
  _approved_fields text[] DEFAULT NULL,
  _decision_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role app_role;
  v_req lead_edit_requests%ROWTYPE;
  v_lead student_leads%ROWTYPE;
  v_applied jsonb := '{}'::jsonb;
  v_key text;
  v_val jsonb;
  v_set_clauses text := '';
  v_trigger_fields text[] := ARRAY[
    'intended_study_country','university_name_raw','course_name','course_category',
    'intake_term','intake_year','loan_amount_required',
    'collateral_available','collateral_notes',
    'coapplicant_income','coapplicant_existing_emi','coapplicant_employment_type'
  ];
  v_recalc boolean := false;
  v_coapp_changed boolean := false;
  v_norm_phone text;
  v_norm_email text;
  v_dup_lead_id uuid;
  v_new_first text;
  v_new_last text;
  v_new_full text;
  v_sql text;
BEGIN
  SELECT id, role INTO v_actor_id, v_actor_role
  FROM public.users WHERE auth_user_id = _actor_auth_id LIMIT 1;
  IF v_actor_id IS NULL THEN
    SELECT id, role INTO v_actor_id, v_actor_role
    FROM public.users WHERE id = _actor_auth_id LIMIT 1;
  END IF;
  IF v_actor_role NOT IN ('admin','super_admin') THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;

  SELECT * INTO v_req FROM public.lead_edit_requests WHERE id = _request_id FOR UPDATE;
  IF v_req.id IS NULL THEN RAISE EXCEPTION 'edit request not found'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'edit request is not pending (current: %)', v_req.status; END IF;

  IF _action = 'reject' THEN
    IF _decision_note IS NULL OR length(trim(_decision_note)) < 10 THEN
      RAISE EXCEPTION 'rejection requires a note of at least 10 characters';
    END IF;
    UPDATE public.lead_edit_requests
    SET status = 'rejected', admin_decision_note = trim(_decision_note),
        decided_by_user_id = v_actor_id, decided_at = now()
    WHERE id = _request_id;
    RETURN jsonb_build_object('ok', true, 'request_id', _request_id, 'status', 'rejected');
  END IF;

  IF _action <> 'approve' THEN RAISE EXCEPTION 'invalid action: %', _action; END IF;
  IF _approved_fields IS NULL OR array_length(_approved_fields, 1) IS NULL THEN
    RAISE EXCEPTION 'approval requires at least one approved field';
  END IF;

  SELECT * INTO v_lead FROM public.student_leads WHERE id = v_req.lead_id FOR UPDATE;
  IF v_lead.current_stage IN ('disbursed','rejected','dropped') THEN
    RAISE EXCEPTION 'lead is in terminal stage % and cannot be edited', v_lead.current_stage;
  END IF;

  FOR v_key IN SELECT unnest(_approved_fields) LOOP
    IF v_req.requested_changes ? v_key THEN
      v_val := v_req.requested_changes -> v_key;
      IF v_key IN ('student_phone','student_whatsapp','coapplicant_mobile') AND jsonb_typeof(v_val) = 'string' THEN
        v_norm_phone := public.normalize_phone(v_val #>> '{}');
        v_val := to_jsonb(v_norm_phone);
        IF v_key = 'student_phone' AND v_norm_phone IS NOT NULL THEN
          SELECT id INTO v_dup_lead_id FROM public.student_leads
          WHERE partner_id = v_lead.partner_id AND student_phone = v_norm_phone
            AND is_archived = false AND id <> v_lead.id LIMIT 1;
          IF v_dup_lead_id IS NOT NULL THEN
            RAISE EXCEPTION 'duplicate_after_normalization: phone % already exists on lead %', v_norm_phone, v_dup_lead_id;
          END IF;
        END IF;
      END IF;
      IF v_key IN ('student_email','coapplicant_email') AND jsonb_typeof(v_val) = 'string' THEN
        v_norm_email := lower(trim(v_val #>> '{}'));
        IF v_norm_email = '' THEN v_norm_email := NULL; END IF;
        v_val := to_jsonb(v_norm_email);
        IF v_key = 'student_email' AND v_norm_email IS NOT NULL THEN
          SELECT id INTO v_dup_lead_id FROM public.student_leads
          WHERE partner_id = v_lead.partner_id AND lower(student_email) = v_norm_email
            AND is_archived = false AND id <> v_lead.id LIMIT 1;
          IF v_dup_lead_id IS NOT NULL THEN
            RAISE EXCEPTION 'duplicate_after_normalization: email % already exists on lead %', v_norm_email, v_dup_lead_id;
          END IF;
        END IF;
      END IF;
      v_applied := v_applied || jsonb_build_object(v_key, v_val);
      IF v_key = ANY(v_trigger_fields) THEN v_recalc := true; END IF;
      IF v_key = 'coapplicant_name' THEN v_coapp_changed := true; END IF;
    END IF;
  END LOOP;

  IF v_applied = '{}'::jsonb THEN RAISE EXCEPTION 'no approved fields matched the requested changes'; END IF;

  IF (v_applied ? 'student_first_name' OR v_applied ? 'student_last_name')
     AND NOT (v_applied ? 'student_full_name') THEN
    v_new_first := COALESCE(v_applied ->> 'student_first_name', v_lead.student_first_name);
    v_new_last  := COALESCE(v_applied ->> 'student_last_name',  v_lead.student_last_name);
    v_new_full  := trim(v_new_first || ' ' || COALESCE(v_new_last, ''));
    v_applied := v_applied || jsonb_build_object('student_full_name', v_new_full);
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(v_applied) LOOP
    v_val := v_applied -> v_key;
    IF v_set_clauses <> '' THEN v_set_clauses := v_set_clauses || ', '; END IF;
    IF v_key IN ('intake_year','coapplicant_existing_emi','coapplicant_income','loan_amount_required') THEN
      v_set_clauses := v_set_clauses || format('%I = %L::numeric', v_key, v_val #>> '{}');
    ELSIF v_key IN ('collateral_available') THEN
      v_set_clauses := v_set_clauses || format('%I = %L::boolean', v_key, v_val #>> '{}');
    ELSIF v_key = 'student_dob' THEN
      v_set_clauses := v_set_clauses || format('%I = NULLIF(%L, '''')::date', v_key, v_val #>> '{}');
    ELSIF v_key = 'test_scores' THEN
      v_set_clauses := v_set_clauses || format('%I = %L::jsonb', v_key, v_val::text);
    ELSE
      IF jsonb_typeof(v_val) = 'null' THEN
        v_set_clauses := v_set_clauses || format('%I = NULL', v_key);
      ELSE
        v_set_clauses := v_set_clauses || format('%I = %L', v_key, v_val #>> '{}');
      END IF;
    END IF;
  END LOOP;

  v_sql := format('UPDATE public.student_leads SET %s, updated_at = now() WHERE id = %L', v_set_clauses, v_lead.id);
  EXECUTE v_sql;

  IF v_recalc THEN
    DELETE FROM public.lead_lender_matches WHERE lead_id = v_lead.id AND lock_status = false;
    PERFORM public.seed_lead_lender_matches(v_lead.id);
  END IF;
  IF v_coapp_changed THEN PERFORM public.seed_lead_document_requirements(v_lead.id); END IF;

  UPDATE public.lead_edit_requests
  SET status = 'applied', applied_changes = v_applied,
      admin_decision_note = _decision_note, decided_by_user_id = v_actor_id,
      decided_at = now(), applied_at = now()
  WHERE id = _request_id;

  RETURN jsonb_build_object('ok', true, 'request_id', _request_id, 'status', 'applied',
                            'applied', v_applied, 'recalculated', v_recalc);
END;
$$;