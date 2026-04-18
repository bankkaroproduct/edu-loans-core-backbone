-- =====================================================================
-- Admin Operations Engine: Atomic RPC functions
-- All four functions are SECURITY DEFINER and run inside a single
-- implicit transaction. Any RAISE EXCEPTION rolls back the mutation
-- AND the audit_logs insert together.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) admin_change_lead_stage
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_change_lead_stage(
  _lead_id uuid,
  _new_stage lead_stage_enum,
  _new_status lead_status_enum,
  _change_reason text DEFAULT NULL,
  _partner_visible_note text DEFAULT NULL,
  _internal_note text DEFAULT NULL,
  _override boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role app_role;
  v_old_stage lead_stage_enum;
  v_old_status lead_status_enum;
  v_lead_row student_leads%ROWTYPE;
BEGIN
  -- Auth: must be admin
  IF NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;

  SELECT id, role INTO v_actor_id, v_actor_role
  FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'forbidden: actor user not found';
  END IF;

  -- Lock lead row
  SELECT * INTO v_lead_row FROM public.student_leads WHERE id = _lead_id FOR UPDATE;
  IF v_lead_row.id IS NULL THEN
    RAISE EXCEPTION 'lead not found';
  END IF;

  v_old_stage := v_lead_row.current_stage;
  v_old_status := v_lead_row.current_status;

  -- Hard floor: terminal stages are immutable
  IF v_old_stage IN ('disbursed','rejected','dropped') THEN
    RAISE EXCEPTION 'lead is in terminal stage % and cannot be changed', v_old_stage;
  END IF;

  -- Hard floor: reason required for these targets
  IF _new_stage IN ('on_hold','rejected','dropped','documents_pending')
     AND (_change_reason IS NULL OR length(trim(_change_reason)) < 10) THEN
    RAISE EXCEPTION 'reason of at least 10 characters required for stage %', _new_stage;
  END IF;

  -- Update lead (trigger log_lead_stage_change writes lead_stage_history atomically)
  UPDATE public.student_leads
  SET current_stage = _new_stage,
      current_status = _new_status,
      status_reason = _change_reason,
      updated_at = now()
  WHERE id = _lead_id;

  -- Enrich history row that the trigger just wrote
  UPDATE public.lead_stage_history
  SET changed_by_user_id = v_actor_id,
      changed_by_role = v_actor_role,
      change_reason = _change_reason,
      partner_visible_note = _partner_visible_note,
      internal_note = _internal_note
  WHERE id = (
    SELECT id FROM public.lead_stage_history
    WHERE lead_id = _lead_id
    ORDER BY created_at DESC LIMIT 1
  );

  -- Audit (atomic with mutation)
  INSERT INTO public.audit_logs (
    entity_type, entity_id, action_type, actor_user_id, actor_role,
    old_value, new_value, meta
  ) VALUES (
    'student_lead', _lead_id, 'stage_changed', v_actor_id, v_actor_role,
    jsonb_build_object('stage', v_old_stage, 'status', v_old_status),
    jsonb_build_object('stage', _new_stage, 'status', _new_status),
    jsonb_build_object('reason', _change_reason, 'override', _override,
                      'partner_visible_note', _partner_visible_note,
                      'internal_note', _internal_note)
  );

  RETURN jsonb_build_object(
    'ok', true, 'lead_id', _lead_id,
    'old_stage', v_old_stage, 'new_stage', _new_stage,
    'old_status', v_old_status, 'new_status', _new_status
  );
END;
$$;

-- ---------------------------------------------------------------------
-- 2) admin_change_lead_status (status-only, same stage)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_change_lead_status(
  _lead_id uuid,
  _new_status lead_status_enum,
  _change_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role app_role;
  v_old_status lead_status_enum;
  v_old_stage lead_stage_enum;
BEGIN
  IF NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;

  SELECT id, role INTO v_actor_id, v_actor_role
  FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;

  SELECT current_stage, current_status INTO v_old_stage, v_old_status
  FROM public.student_leads WHERE id = _lead_id FOR UPDATE;

  IF v_old_stage IS NULL THEN
    RAISE EXCEPTION 'lead not found';
  END IF;

  IF v_old_stage IN ('disbursed','rejected','dropped') THEN
    RAISE EXCEPTION 'lead is in terminal stage % and cannot be changed', v_old_stage;
  END IF;

  IF _new_status IN ('pending_info','reupload_needed','declined','query_raised','on_hold')
     AND (_change_reason IS NULL OR length(trim(_change_reason)) < 10) THEN
    RAISE EXCEPTION 'reason of at least 10 characters required for status %', _new_status;
  END IF;

  UPDATE public.student_leads
  SET current_status = _new_status,
      status_reason = COALESCE(_change_reason, status_reason),
      updated_at = now()
  WHERE id = _lead_id;

  UPDATE public.lead_stage_history
  SET changed_by_user_id = v_actor_id,
      changed_by_role = v_actor_role,
      change_reason = _change_reason
  WHERE id = (
    SELECT id FROM public.lead_stage_history
    WHERE lead_id = _lead_id
    ORDER BY created_at DESC LIMIT 1
  );

  INSERT INTO public.audit_logs (
    entity_type, entity_id, action_type, actor_user_id, actor_role,
    old_value, new_value, meta
  ) VALUES (
    'student_lead', _lead_id, 'status_changed', v_actor_id, v_actor_role,
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', _new_status),
    jsonb_build_object('reason', _change_reason, 'stage', v_old_stage)
  );

  RETURN jsonb_build_object('ok', true, 'lead_id', _lead_id,
                            'old_status', v_old_status, 'new_status', _new_status);
END;
$$;

-- ---------------------------------------------------------------------
-- 3) admin_review_document
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_review_document(
  _document_id uuid,
  _action text, -- 'verify' | 'reject' | 'reupload'
  _remark text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role app_role;
  v_doc lead_documents%ROWTYPE;
  v_new_status document_status_enum;
  v_action_type text;
  v_doc_name text;
BEGIN
  IF NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;

  SELECT id, role INTO v_actor_id, v_actor_role
  FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;

  SELECT * INTO v_doc FROM public.lead_documents WHERE id = _document_id FOR UPDATE;
  IF v_doc.id IS NULL THEN
    RAISE EXCEPTION 'document not found';
  END IF;

  IF NOT v_doc.is_latest THEN
    RAISE EXCEPTION 'cannot act on a non-latest document version';
  END IF;

  IF _action = 'verify' THEN
    v_new_status := 'verified';
    v_action_type := 'document_verified';
  ELSIF _action = 'reject' THEN
    v_new_status := 'rejected';
    v_action_type := 'document_rejected';
    IF _remark IS NULL OR length(trim(_remark)) < 10 THEN
      RAISE EXCEPTION 'reject requires a remark of at least 10 characters';
    END IF;
  ELSIF _action = 'reupload' THEN
    v_new_status := 'reupload_needed';
    v_action_type := 'document_reupload_requested';
    IF _remark IS NULL OR length(trim(_remark)) < 10 THEN
      RAISE EXCEPTION 'reupload requires a remark of at least 10 characters';
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid action: %', _action;
  END IF;

  UPDATE public.lead_documents
  SET verification_status = v_new_status,
      verification_remark = _remark,
      verified_by = v_actor_id,
      verified_at = now()
  WHERE id = _document_id;

  -- Mirror to requirement row (latest matching requirement on same lead+doc type)
  UPDATE public.lead_document_requirements
  SET status = v_new_status,
      remarks = _remark,
      updated_at = now()
  WHERE lead_id = v_doc.lead_id
    AND document_type_id = v_doc.document_type_id;

  -- System note for timeline visibility
  SELECT document_name INTO v_doc_name FROM public.document_master WHERE id = v_doc.document_type_id;
  INSERT INTO public.lead_notes (lead_id, note_type, note_text, created_by)
  VALUES (
    v_doc.lead_id,
    'system',
    'Admin ' ||
      CASE _action
        WHEN 'verify' THEN 'verified'
        WHEN 'reject' THEN 'rejected'
        WHEN 'reupload' THEN 'requested re-upload of'
      END
    || ' document: ' || COALESCE(v_doc_name, 'Unknown')
    || COALESCE(' — ' || _remark, ''),
    v_actor_id
  );

  INSERT INTO public.audit_logs (
    entity_type, entity_id, action_type, actor_user_id, actor_role,
    old_value, new_value, meta
  ) VALUES (
    'lead_document', _document_id, v_action_type, v_actor_id, v_actor_role,
    jsonb_build_object('verification_status', v_doc.verification_status),
    jsonb_build_object('verification_status', v_new_status),
    jsonb_build_object('lead_id', v_doc.lead_id, 'document_type_id', v_doc.document_type_id, 'remark', _remark)
  );

  RETURN jsonb_build_object('ok', true, 'document_id', _document_id, 'new_status', v_new_status);
END;
$$;

-- ---------------------------------------------------------------------
-- 4) admin_add_lead_note
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_add_lead_note(
  _lead_id uuid,
  _note_text text,
  _note_type note_type_enum DEFAULT 'internal'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role app_role;
  v_note_id uuid;
BEGIN
  IF NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;

  SELECT id, role INTO v_actor_id, v_actor_role
  FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;

  IF _note_text IS NULL OR length(trim(_note_text)) < 1 THEN
    RAISE EXCEPTION 'note_text is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.student_leads WHERE id = _lead_id) THEN
    RAISE EXCEPTION 'lead not found';
  END IF;

  INSERT INTO public.lead_notes (lead_id, note_type, note_text, created_by)
  VALUES (_lead_id, _note_type, _note_text, v_actor_id)
  RETURNING id INTO v_note_id;

  INSERT INTO public.audit_logs (
    entity_type, entity_id, action_type, actor_user_id, actor_role, meta
  ) VALUES (
    'lead_note', v_note_id,
    CASE WHEN _note_type = 'internal' THEN 'internal_note_added' ELSE 'partner_note_added' END,
    v_actor_id, v_actor_role,
    jsonb_build_object('lead_id', _lead_id, 'note_type', _note_type)
  );

  RETURN jsonb_build_object('ok', true, 'note_id', v_note_id);
END;
$$;

-- =====================================================================
-- Ensure log_lead_stage_change trigger exists on student_leads
-- (function exists; verify trigger is attached)
-- =====================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_log_lead_stage_change'
  ) THEN
    CREATE TRIGGER trg_log_lead_stage_change
    AFTER UPDATE ON public.student_leads
    FOR EACH ROW
    EXECUTE FUNCTION public.log_lead_stage_change();
  END IF;
END $$;