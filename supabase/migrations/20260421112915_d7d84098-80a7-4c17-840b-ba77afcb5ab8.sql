-- Drop the duplicate stage-history trigger.
-- Two triggers (`log_lead_stage_change_trigger` and `trg_log_lead_stage_change`)
-- were both bound to the same `log_lead_stage_change()` function on student_leads,
-- causing every stage change to write two rows into lead_stage_history.
-- We keep `trg_log_lead_stage_change` (the canonical name used elsewhere) and drop the older one.
DROP TRIGGER IF EXISTS log_lead_stage_change_trigger ON public.student_leads;