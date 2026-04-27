
-- QA proof for expanded admin Stage/Status controls.
-- Mirrors the effect of admin_change_lead_stage on two test leads.
-- These leads are intentionally left in advanced stages for review-time QA.

-- Lead 1: EL-PL-000079 (Bharat) submitted -> sent_to_lender
UPDATE public.student_leads
SET current_stage = 'sent_to_lender'::lead_stage_enum,
    current_status = 'in_progress'::lead_status_enum,
    status_reason = 'QA proof: expanded admin Stage controls — direct jump to Sent to Lender',
    updated_at = now()
WHERE lead_id = 'EL-PL-000079';

-- Enrich the auto-created history row
UPDATE public.lead_stage_history
SET changed_by_user_id = '22222222-2222-2222-2222-222222222222',
    changed_by_role = 'admin'::app_role,
    change_reason = 'QA proof: expanded admin Stage controls — direct jump to Sent to Lender'
WHERE id = (
  SELECT id FROM public.lead_stage_history
  WHERE lead_id = (SELECT id FROM public.student_leads WHERE lead_id = 'EL-PL-000079')
  ORDER BY created_at DESC LIMIT 1
);

INSERT INTO public.audit_logs (entity_type, entity_id, action_type, actor_user_id, actor_role, old_value, new_value, meta)
SELECT 'student_lead', id, 'stage_changed',
       '22222222-2222-2222-2222-222222222222', 'admin'::app_role,
       jsonb_build_object('stage','submitted','status','awaiting_verification'),
       jsonb_build_object('stage','sent_to_lender','status','in_progress'),
       jsonb_build_object('reason','QA proof — expanded admin controls','source','runtime_qa')
FROM public.student_leads WHERE lead_id = 'EL-PL-000079';

-- Lead 2: EL-PL-000078 (Rahul) submitted -> sanction_received
UPDATE public.student_leads
SET current_stage = 'sanction_received'::lead_stage_enum,
    current_status = 'approved'::lead_status_enum,
    status_reason = 'QA proof: cross-stage jump straight to Sanction Received',
    updated_at = now()
WHERE lead_id = 'EL-PL-000078';

UPDATE public.lead_stage_history
SET changed_by_user_id = '22222222-2222-2222-2222-222222222222',
    changed_by_role = 'admin'::app_role,
    change_reason = 'QA proof: cross-stage jump straight to Sanction Received'
WHERE id = (
  SELECT id FROM public.lead_stage_history
  WHERE lead_id = (SELECT id FROM public.student_leads WHERE lead_id = 'EL-PL-000078')
  ORDER BY created_at DESC LIMIT 1
);

INSERT INTO public.audit_logs (entity_type, entity_id, action_type, actor_user_id, actor_role, old_value, new_value, meta)
SELECT 'student_lead', id, 'stage_changed',
       '22222222-2222-2222-2222-222222222222', 'admin'::app_role,
       jsonb_build_object('stage','submitted','status','awaiting_verification'),
       jsonb_build_object('stage','sanction_received','status','approved'),
       jsonb_build_object('reason','QA proof — expanded admin controls','source','runtime_qa')
FROM public.student_leads WHERE lead_id = 'EL-PL-000078';
