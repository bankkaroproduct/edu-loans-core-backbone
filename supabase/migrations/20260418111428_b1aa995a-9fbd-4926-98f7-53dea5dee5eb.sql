DROP TABLE IF EXISTS public.qa_results_admin_ops;
CREATE TABLE public.qa_results_admin_ops (
  scenario_no int,
  scenario text,
  expected text,
  actual text,
  status text,
  evidence text,
  ran_at timestamptz default now()
);
ALTER TABLE public.qa_results_admin_ops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read qa results" ON public.qa_results_admin_ops
  FOR SELECT USING (public.is_admin_or_super(auth.uid()));

CREATE OR REPLACE FUNCTION public._qa_run_admin_ops()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_auth_id uuid := '431953c1-21ee-4678-a9e9-4869a9715b3c';
  v_partner_id uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  v_test_lead_id uuid;
  v_terminal_lead_id uuid;
  v_doc_id uuid;
  v_doc_type_id uuid;
  v_audit_before bigint;
  v_audit_after bigint;
  v_history_before bigint;
  v_history_after bigint;
  v_result jsonb;
  v_err text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_admin_auth_id::text, true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_admin_auth_id, 'role','authenticated')::text, true);

  IF NOT public.is_admin_or_super(v_admin_auth_id) THEN
    RAISE EXCEPTION 'harness setup failed';
  END IF;

  INSERT INTO public.student_leads (
    partner_id, source_type, student_first_name, student_phone,
    course_name, intake_term, intake_year, intended_study_country,
    current_stage, current_status, coapplicant_name
  ) VALUES (v_partner_id,'partner','QATEST_DISPOSABLE','+919999900001',
    'QA Test Course','Fall',2026,'United States','submitted','awaiting_verification','QA Coapp')
  RETURNING id INTO v_test_lead_id;

  INSERT INTO public.student_leads (
    partner_id, source_type, student_first_name, student_phone,
    course_name, intake_term, intake_year, intended_study_country,
    current_stage, current_status
  ) VALUES (v_partner_id,'partner','QATEST_TERMINAL','+919999900002',
    'QA Test Course','Fall',2026,'United States','disbursed','completed')
  RETURNING id INTO v_terminal_lead_id;

  SELECT id INTO v_doc_type_id FROM public.document_master WHERE active_flag LIMIT 1;
  INSERT INTO public.lead_documents (lead_id, document_type_id, file_name, verification_status, is_latest, version_number)
  VALUES (v_test_lead_id, v_doc_type_id, 'qa_test.pdf', 'uploaded', true, 1)
  RETURNING id INTO v_doc_id;

  -- S1
  SELECT count(*) INTO v_audit_before FROM public.audit_logs WHERE entity_id = v_test_lead_id;
  SELECT count(*) INTO v_history_before FROM public.lead_stage_history WHERE lead_id = v_test_lead_id;
  BEGIN
    v_result := public.admin_change_lead_stage(v_test_lead_id,'under_initial_review','in_progress',NULL,NULL,NULL,false);
    SELECT count(*) INTO v_audit_after FROM public.audit_logs WHERE entity_id = v_test_lead_id;
    SELECT count(*) INTO v_history_after FROM public.lead_stage_history WHERE lead_id = v_test_lead_id;
    INSERT INTO public.qa_results_admin_ops VALUES (1,'submitted → under_initial_review (no reason)','success + audit+1 + history+1',
      format('ok=%s, audit %s→%s, history %s→%s', v_result->>'ok', v_audit_before, v_audit_after, v_history_before, v_history_after),
      CASE WHEN v_result->>'ok'='true' AND v_audit_after=v_audit_before+1 AND v_history_after=v_history_before+1 THEN 'PASS' ELSE 'FAIL' END, v_result::text);
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_err=MESSAGE_TEXT;
    INSERT INTO public.qa_results_admin_ops VALUES (1,'submitted → under_initial_review','success', v_err,'FAIL', v_err); END;

  -- S2 terminal
  BEGIN
    v_result := public.admin_change_lead_stage(v_terminal_lead_id,'rejected','declined','attempt change on terminal lead — should fail',NULL,NULL,false);
    INSERT INTO public.qa_results_admin_ops VALUES (2,'disbursed → rejected (terminal)','BLOCKED','NOT BLOCKED: '||v_result::text,'FAIL',NULL);
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_err=MESSAGE_TEXT;
    INSERT INTO public.qa_results_admin_ops VALUES (2,'disbursed → rejected (terminal)','BLOCKED','BLOCKED: '||v_err,
      CASE WHEN v_err ILIKE '%terminal stage%' THEN 'PASS' ELSE 'FAIL' END, v_err); END;

  -- S3 on_hold no reason
  BEGIN
    v_result := public.admin_change_lead_stage(v_test_lead_id,'on_hold','on_hold',NULL,NULL,NULL,false);
    INSERT INTO public.qa_results_admin_ops VALUES (3,'on_hold without reason','BLOCKED','NOT BLOCKED','FAIL',NULL);
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_err=MESSAGE_TEXT;
    INSERT INTO public.qa_results_admin_ops VALUES (3,'on_hold without reason','BLOCKED','BLOCKED: '||v_err,
      CASE WHEN v_err ILIKE '%reason%' THEN 'PASS' ELSE 'FAIL' END, v_err); END;

  -- S4 on_hold with reason
  SELECT count(*) INTO v_audit_before FROM public.audit_logs WHERE entity_id = v_test_lead_id;
  BEGIN
    v_result := public.admin_change_lead_stage(v_test_lead_id,'on_hold','on_hold','QA: testing on_hold with sufficient reason text',NULL,NULL,false);
    SELECT count(*) INTO v_audit_after FROM public.audit_logs WHERE entity_id = v_test_lead_id;
    INSERT INTO public.qa_results_admin_ops VALUES (4,'on_hold with valid reason','success + audit+1',
      format('ok=%s, audit %s→%s', v_result->>'ok', v_audit_before, v_audit_after),
      CASE WHEN v_result->>'ok'='true' AND v_audit_after=v_audit_before+1 THEN 'PASS' ELSE 'FAIL' END, v_result::text);
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_err=MESSAGE_TEXT;
    INSERT INTO public.qa_results_admin_ops VALUES (4,'on_hold with reason','success', v_err,'FAIL', v_err); END;

  UPDATE public.student_leads SET current_stage='submitted',current_status='awaiting_verification' WHERE id=v_test_lead_id;

  -- S5 status no reason
  BEGIN
    v_result := public.admin_change_lead_status(v_test_lead_id,'pending_info',NULL);
    INSERT INTO public.qa_results_admin_ops VALUES (5,'status pending_info without reason','BLOCKED','NOT BLOCKED','FAIL',NULL);
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_err=MESSAGE_TEXT;
    INSERT INTO public.qa_results_admin_ops VALUES (5,'status pending_info without reason','BLOCKED','BLOCKED: '||v_err,
      CASE WHEN v_err ILIKE '%reason%' THEN 'PASS' ELSE 'FAIL' END, v_err); END;

  -- S6 status with reason
  BEGIN
    v_result := public.admin_change_lead_status(v_test_lead_id,'pending_info','QA: requesting more info from partner — sufficient length');
    INSERT INTO public.qa_results_admin_ops VALUES (6,'status pending_info with valid reason','success',
      format('ok=%s, new=%s', v_result->>'ok', v_result->>'new_status'),
      CASE WHEN v_result->>'ok'='true' THEN 'PASS' ELSE 'FAIL' END, v_result::text);
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_err=MESSAGE_TEXT;
    INSERT INTO public.qa_results_admin_ops VALUES (6,'status pending_info with reason','success', v_err,'FAIL', v_err); END;

  -- S7 doc reject no remark
  BEGIN
    v_result := public.admin_review_document(v_doc_id,'reject',NULL);
    INSERT INTO public.qa_results_admin_ops VALUES (7,'doc reject without remark','BLOCKED','NOT BLOCKED','FAIL',NULL);
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_err=MESSAGE_TEXT;
    INSERT INTO public.qa_results_admin_ops VALUES (7,'doc reject without remark','BLOCKED','BLOCKED: '||v_err,
      CASE WHEN v_err ILIKE '%remark%' THEN 'PASS' ELSE 'FAIL' END, v_err); END;

  -- S8 doc reject with remark
  SELECT count(*) INTO v_audit_before FROM public.audit_logs WHERE entity_id = v_doc_id;
  BEGIN
    v_result := public.admin_review_document(v_doc_id,'reject','QA: rejecting test document — illegible scan, please re-upload');
    SELECT count(*) INTO v_audit_after FROM public.audit_logs WHERE entity_id = v_doc_id;
    INSERT INTO public.qa_results_admin_ops VALUES (8,'doc reject with remark','success + audit+1 + system note',
      format('ok=%s, status=%s, audit %s→%s, sys_notes=%s',
        v_result->>'ok', v_result->>'new_status', v_audit_before, v_audit_after,
        (SELECT count(*) FROM public.lead_notes WHERE lead_id=v_test_lead_id AND note_type='system')),
      CASE WHEN v_result->>'ok'='true' AND v_audit_after=v_audit_before+1 THEN 'PASS' ELSE 'FAIL' END, v_result::text);
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_err=MESSAGE_TEXT;
    INSERT INTO public.qa_results_admin_ops VALUES (8,'doc reject with remark','success', v_err,'FAIL', v_err); END;

  UPDATE public.lead_documents SET verification_status='uploaded' WHERE id=v_doc_id;

  -- S9 doc verify
  SELECT count(*) INTO v_audit_before FROM public.audit_logs WHERE entity_id = v_doc_id;
  BEGIN
    v_result := public.admin_review_document(v_doc_id,'verify',NULL);
    SELECT count(*) INTO v_audit_after FROM public.audit_logs WHERE entity_id = v_doc_id;
    INSERT INTO public.qa_results_admin_ops VALUES (9,'doc verify','success + audit+1',
      format('ok=%s, status=%s, audit %s→%s', v_result->>'ok', v_result->>'new_status', v_audit_before, v_audit_after),
      CASE WHEN v_result->>'ok'='true' AND v_audit_after=v_audit_before+1 THEN 'PASS' ELSE 'FAIL' END, v_result::text);
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_err=MESSAGE_TEXT;
    INSERT INTO public.qa_results_admin_ops VALUES (9,'doc verify','success', v_err,'FAIL', v_err); END;

  UPDATE public.lead_documents SET verification_status='uploaded' WHERE id=v_doc_id;

  -- S10 doc reupload
  BEGIN
    v_result := public.admin_review_document(v_doc_id,'reupload','QA: please re-upload — image is too dark to read');
    INSERT INTO public.qa_results_admin_ops VALUES (10,'doc reupload with remark','success, status=reupload_needed',
      format('ok=%s, status=%s', v_result->>'ok', v_result->>'new_status'),
      CASE WHEN v_result->>'ok'='true' AND v_result->>'new_status'='reupload_needed' THEN 'PASS' ELSE 'FAIL' END, v_result::text);
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_err=MESSAGE_TEXT;
    INSERT INTO public.qa_results_admin_ops VALUES (10,'doc reupload','success', v_err,'FAIL', v_err); END;

  -- S11 internal note
  BEGIN
    v_result := public.admin_add_lead_note(v_test_lead_id,'QA: internal note — partner must NOT see this','internal');
    INSERT INTO public.qa_results_admin_ops VALUES (11,'add internal note','success',
      format('ok=%s', v_result->>'ok'),
      CASE WHEN v_result->>'ok'='true' THEN 'PASS' ELSE 'FAIL' END, v_result::text);
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_err=MESSAGE_TEXT;
    INSERT INTO public.qa_results_admin_ops VALUES (11,'add internal note','success', v_err,'FAIL', v_err); END;

  -- S12 partner-visible note
  BEGIN
    v_result := public.admin_add_lead_note(v_test_lead_id,'QA: partner-visible note — partner SHOULD see this','partner_visible');
    INSERT INTO public.qa_results_admin_ops VALUES (12,'add partner-visible note','success',
      format('ok=%s', v_result->>'ok'),
      CASE WHEN v_result->>'ok'='true' THEN 'PASS' ELSE 'FAIL' END, v_result::text);
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_err=MESSAGE_TEXT;
    INSERT INTO public.qa_results_admin_ops VALUES (12,'add partner-visible note','success', v_err,'FAIL', v_err); END;

  -- S13 integrity
  SELECT count(*) INTO v_audit_after FROM public.audit_logs WHERE entity_id = v_test_lead_id;
  SELECT count(*) INTO v_history_after FROM public.lead_stage_history WHERE lead_id = v_test_lead_id;
  INSERT INTO public.qa_results_admin_ops VALUES (13,'audit + history integrity','audit>0 AND history>0',
    format('audit_logs=%s, history=%s', v_audit_after, v_history_after),
    CASE WHEN v_audit_after>0 AND v_history_after>0 THEN 'PASS' ELSE 'FAIL' END, NULL);

  -- CLEANUP
  DELETE FROM public.audit_logs WHERE entity_id IN (v_test_lead_id, v_terminal_lead_id, v_doc_id);
  DELETE FROM public.lead_notes WHERE lead_id IN (v_test_lead_id, v_terminal_lead_id);
  DELETE FROM public.lead_stage_history WHERE lead_id IN (v_test_lead_id, v_terminal_lead_id);
  DELETE FROM public.lead_document_requirements WHERE lead_id IN (v_test_lead_id, v_terminal_lead_id);
  DELETE FROM public.lead_documents WHERE lead_id IN (v_test_lead_id, v_terminal_lead_id);
  DELETE FROM public.lead_lender_matches WHERE lead_id IN (v_test_lead_id, v_terminal_lead_id);
  DELETE FROM public.student_leads WHERE id IN (v_test_lead_id, v_terminal_lead_id);
END;
$$;

SELECT public._qa_run_admin_ops();
DROP FUNCTION public._qa_run_admin_ops();
