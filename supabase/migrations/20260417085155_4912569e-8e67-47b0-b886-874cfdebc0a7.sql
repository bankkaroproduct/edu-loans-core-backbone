-- Allow partners to update their own bulk upload batches (batch summary write at end of processing)
CREATE POLICY "Partners can update own batches"
ON public.bulk_upload_batches
FOR UPDATE
USING (partner_id = get_user_partner_id(auth.uid()))
WITH CHECK (partner_id = get_user_partner_id(auth.uid()));