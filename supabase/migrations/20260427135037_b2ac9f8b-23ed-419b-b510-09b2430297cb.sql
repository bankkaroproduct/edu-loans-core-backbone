DO $$
DECLARE
  v_lead_a uuid := 'b1f1ea5d-95f7-4835-ad36-b21ab60627d4';
  v_lead_b uuid := '721f0b45-e7e6-4a3f-808b-fc50b73b3f32';
BEGIN
  UPDATE public.student_leads SET current_stage = 'under_initial_review', current_status = 'in_progress', status_reason = 'QA: progress for filter proof' WHERE id = v_lead_a;
  UPDATE public.student_leads SET current_stage = 'bre_evaluated',         current_status = 'completed',   status_reason = 'QA: progress for filter proof' WHERE id = v_lead_a;
  UPDATE public.student_leads SET current_stage = 'sent_to_lender',        current_status = 'in_progress', status_reason = 'QA: filter proof — Sent to Lender' WHERE id = v_lead_a;

  UPDATE public.student_leads SET current_stage = 'under_initial_review', current_status = 'in_progress', status_reason = 'QA: progress for filter proof' WHERE id = v_lead_b;
  UPDATE public.student_leads SET current_stage = 'bre_evaluated',         current_status = 'completed',   status_reason = 'QA: progress for filter proof' WHERE id = v_lead_b;
  UPDATE public.student_leads SET current_stage = 'sent_to_lender',        current_status = 'in_progress', status_reason = 'QA: progress for filter proof' WHERE id = v_lead_b;
  UPDATE public.student_leads SET current_stage = 'login_submitted',       current_status = 'completed',   status_reason = 'QA: progress for filter proof' WHERE id = v_lead_b;
  UPDATE public.student_leads SET current_stage = 'sanction_received',     current_status = 'approved',    status_reason = 'QA: filter proof — Sanction Received' WHERE id = v_lead_b;
END $$;