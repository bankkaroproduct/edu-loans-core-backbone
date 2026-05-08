CREATE OR REPLACE FUNCTION public.decide_edit_request(_request_id uuid, _action text, _approved_fields text[] DEFAULT NULL::text[], _decision_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_sql text;
  v_applied_count integer;
  v_is_review_only boolean;
  v_pin_norm text;
  v_pin_row record;
BEGIN
  IF NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;

  SELECT id, role INTO v_actor_id, v_actor_role
  FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;

  SELECT * INTO v_req FROM public.lead_edit_requests
  WHERE id = _request_id FOR UPDATE;

  IF v_req.id IS NULL THEN RAISE EXCEPTION 'edit request not found'; END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'edit request is not pending (current: %)', v_req.status;
  END IF;

  v_is_review_only := (v_req.requested_changes IS NULL OR v_req.requested_changes = '{}'::jsonb);

  IF _action = 'reject' THEN
    IF _decision_note IS NULL OR length(trim(_decision_note)) < 10 THEN
      RAISE EXCEPTION 'rejection requires a note of at least 10 characters';
    END IF;

    UPDATE public.lead_edit_requests
    SET status = 'rejected',
        admin_decision_note = trim(_decision_note),
        decided_by_user_id = v_actor_id,
        decided_at = now()
    WHERE id = _request_id;

    INSERT INTO public.lead_notes (lead_id, note_type, note_text, created_by)
    VALUES (v_req.lead_id, 'partner_visible',
            'Admin rejected your edit request: ' || trim(_decision_note),
            v_actor_id);

    INSERT INTO public.audit_logs
      (entity_type, entity_id, action_type, actor_user_id, actor_role, meta)
    VALUES
      ('lead_edit_request', _request_id, 'edit_request_rejected', v_actor_id, v_actor_role,
       jsonb_build_object('lead_id', v_req.lead_id, 'note', trim(_decision_note)));

    INSERT INTO public.notifications_queue
      (notification_type, recipient_user_id, entity_type, entity_id, message_body)
    VALUES
      ('system_alert', v_req.requested_by_user_id, 'lead_edit_request', _request_id,
       'Your lead edit request was rejected');

    RETURN jsonb_build_object('ok', true, 'request_id', _request_id, 'status', 'rejected');
  END IF;

  IF _action <> 'approve' THEN RAISE EXCEPTION 'invalid action: %', _action; END IF;

  IF v_is_review_only THEN
    UPDATE public.lead_edit_requests
    SET status = 'applied',
        applied_changes = '{}'::jsonb,
        admin_decision_note = _decision_note,
        decided_by_user_id = v_actor_id,
        decided_at = now(),
        applied_at = now()
    WHERE id = _request_id;

    INSERT INTO public.lead_notes (lead_id, note_type, note_text, created_by)
    VALUES (
      v_req.lead_id, 'partner_visible',
      'Admin reviewed and acknowledged your request. No field changes were applied.' ||
        COALESCE(' Note: ' || _decision_note, ''),
      v_actor_id
    );

    INSERT INTO public.audit_logs
      (entity_type, entity_id, action_type, actor_user_id, actor_role, meta)
    VALUES
      ('lead_edit_request', _request_id, 'edit_request_acknowledged', v_actor_id, v_actor_role,
       jsonb_build_object('lead_id', v_req.lead_id, 'note', _decision_note));

    INSERT INTO public.notifications_queue
      (notification_type, recipient_user_id, entity_type, entity_id, message_body)
    VALUES
      ('lead_updated', v_req.requested_by_user_id, 'lead_edit_request', _request_id,
       'Admin acknowledged your edit request');

    RETURN jsonb_build_object('ok', true, 'request_id', _request_id, 'status', 'applied', 'acknowledged', true);
  END IF;

  IF _approved_fields IS NULL OR array_length(_approved_fields, 1) IS NULL THEN
    RAISE EXCEPTION 'approval requires at least one approved field';
  END IF;

  SELECT count(*) INTO v_applied_count
  FROM public.lead_edit_requests
  WHERE lead_id = v_req.lead_id
    AND status = 'applied'
    AND applied_changes IS NOT NULL
    AND applied_changes <> '{}'::jsonb;

  IF v_applied_count >= 10 THEN
    RAISE EXCEPTION 'edit_limit_reached: this lead has reached the maximum approved edit limit (10/10)';
  END IF;

  SELECT * INTO v_lead FROM public.student_leads
  WHERE id = v_req.lead_id FOR UPDATE;

  IF v_lead.id IS NULL THEN RAISE EXCEPTION 'lead not found'; END IF;
  IF v_lead.current_stage IN ('disbursed','rejected','dropped') THEN
    RAISE EXCEPTION 'lead is in terminal stage % and cannot be edited', v_lead.current_stage;
  END IF;

  FOR v_key IN SELECT unnest(_approved_fields) LOOP
    IF v_key = 'student_full_name' THEN CONTINUE; END IF;
    IF v_req.requested_changes ? v_key THEN
      v_val := v_req.requested_changes -> v_key;

      IF v_key IN ('student_phone','student_whatsapp','coapplicant_mobile') AND jsonb_typeof(v_val) = 'string' THEN
        v_norm_phone := public.normalize_phone(v_val #>> '{}');
        v_val := to_jsonb(v_norm_phone);

        IF v_key = 'student_phone' AND v_norm_phone IS NOT NULL THEN
          SELECT id INTO v_dup_lead_id FROM public.student_leads
          WHERE partner_id = v_lead.partner_id
            AND student_phone = v_norm_phone
            AND is_archived = false
            AND id <> v_lead.id
          LIMIT 1;
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
          WHERE partner_id = v_lead.partner_id
            AND lower(student_email) = v_norm_email
            AND is_archived = false
            AND id <> v_lead.id
          LIMIT 1;
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

  -- Pincode enrichment: if pincode is among approved changes, auto-fill
  -- city/district/state/tier from pincode_master. Only overwrite when match
  -- is found; otherwise leave existing location fields untouched.
  -- pincode_master has no city column, so city derives from district.
  IF v_applied ? 'pincode' THEN
    v_pin_norm := trim(COALESCE(v_applied->>'pincode',''));
    IF v_pin_norm <> '' AND v_pin_norm ~ '^\d{6}$' THEN
      SELECT district, state, tier INTO v_pin_row
      FROM public.pincode_master WHERE pincode = v_pin_norm LIMIT 1;
      IF v_pin_row.district IS NOT NULL OR v_pin_row.state IS NOT NULL THEN
        v_applied := v_applied
          || jsonb_build_object('city', v_pin_row.district)
          || jsonb_build_object('district', v_pin_row.district)
          || jsonb_build_object('state', v_pin_row.state)
          || jsonb_build_object('tier', v_pin_row.tier);
      END IF;
    END IF;
  END IF;

  IF v_applied = '{}'::jsonb THEN
    RAISE EXCEPTION 'no approved fields matched the requested changes';
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

  v_sql := format('UPDATE public.student_leads SET %s, updated_at = now() WHERE id = %L',
                  v_set_clauses, v_lead.id);
  EXECUTE v_sql;

  IF v_recalc THEN
    DELETE FROM public.lead_lender_matches
    WHERE lead_id = v_lead.id AND lock_status = false;
    PERFORM public.seed_lead_lender_matches(v_lead.id);
  END IF;

  IF v_coapp_changed THEN
    PERFORM public.seed_lead_document_requirements(v_lead.id);
  END IF;

  UPDATE public.lead_edit_requests
  SET status = 'applied',
      applied_changes = v_applied,
      admin_decision_note = _decision_note,
      decided_by_user_id = v_actor_id,
      decided_at = now(),
      applied_at = now()
  WHERE id = _request_id;

  INSERT INTO public.lead_notes (lead_id, note_type, note_text, created_by)
  VALUES (
    v_lead.id, 'partner_visible',
    'Admin approved your edit request: ' ||
      (SELECT count(*) FROM jsonb_object_keys(v_applied)) || ' field(s) updated' ||
      CASE WHEN v_recalc THEN '. Lender recommendations re-evaluated.' ELSE '.' END,
    v_actor_id
  );

  INSERT INTO public.audit_logs
    (entity_type, entity_id, action_type, actor_user_id, actor_role, old_value, new_value, meta)
  VALUES
    ('lead_edit_request', _request_id, 'edit_request_applied', v_actor_id, v_actor_role,
     v_req.requested_changes, v_applied,
     jsonb_build_object('lead_id', v_lead.id, 'recalculated', v_recalc, 'coapp_doc_reseed', v_coapp_changed));

  INSERT INTO public.notifications_queue
    (notification_type, recipient_user_id, entity_type, entity_id, message_body)
  VALUES
    ('lead_updated', v_req.requested_by_user_id, 'lead_edit_request', _request_id,
     'Your lead edit request was approved and applied');

  RETURN jsonb_build_object(
    'ok', true, 'request_id', _request_id, 'status', 'applied',
    'applied', v_applied, 'recalculated', v_recalc
  );
END;
$function$;