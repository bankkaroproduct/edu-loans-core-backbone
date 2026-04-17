ALTER TABLE public.lead_documents
  ADD COLUMN IF NOT EXISTS validation_result jsonb;

CREATE INDEX IF NOT EXISTS idx_lead_documents_validation_flag
  ON public.lead_documents ((validation_result->>'overall_flag'))
  WHERE validation_result IS NOT NULL;