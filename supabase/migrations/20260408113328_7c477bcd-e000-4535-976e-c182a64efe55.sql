-- Allow partners to insert stage history records for their own leads
CREATE POLICY "Partners can insert own lead stage history"
ON public.lead_stage_history
FOR INSERT
TO authenticated
WITH CHECK (
  lead_id IN (
    SELECT id FROM public.student_leads
    WHERE partner_id = get_user_partner_id(auth.uid())
  )
);

-- Allow partners to update their own lead documents (for is_latest flag during reupload)
CREATE POLICY "Partners can update own lead documents"
ON public.lead_documents
FOR UPDATE
TO authenticated
USING (
  lead_id IN (
    SELECT id FROM public.student_leads
    WHERE partner_id = get_user_partner_id(auth.uid())
  )
)
WITH CHECK (
  lead_id IN (
    SELECT id FROM public.student_leads
    WHERE partner_id = get_user_partner_id(auth.uid())
  )
);