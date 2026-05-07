BEGIN;

DELETE FROM public.notifications_queue
WHERE entity_type = 'lead_edit_request'
   OR entity_id IN (SELECT id FROM public.student_leads);

DELETE FROM public.audit_logs
WHERE entity_type IN ('student_lead','lead_document','lead_note','lead_edit_request');

DELETE FROM public.communication_logs WHERE lead_id IS NOT NULL;

DELETE FROM public.partner_payout_records WHERE lead_id IS NOT NULL;

DELETE FROM public.lead_edit_requests;
DELETE FROM public.lead_lender_matches;
DELETE FROM public.lead_document_requirements;
DELETE FROM public.lead_documents;
DELETE FROM public.lead_notes;
DELETE FROM public.lead_stage_history;
DELETE FROM public.bulk_upload_row_results;
DELETE FROM public.bulk_upload_batches;
DELETE FROM public.student_leads;

SELECT setval('public.lead_id_seq', 1, false);
SELECT setval('public.batch_id_seq', 1, false);

COMMIT;