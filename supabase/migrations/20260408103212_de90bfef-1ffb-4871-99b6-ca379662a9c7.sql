
-- Create storage bucket for lead documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('lead-documents', 'lead-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Partners can upload to their own leads' folder
CREATE POLICY "Partners can upload lead documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lead-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.student_leads
    WHERE partner_id = public.get_user_partner_id(auth.uid())
  )
);

-- RLS: Partners can view their own leads' documents
CREATE POLICY "Partners can view own lead documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'lead-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.student_leads
    WHERE partner_id = public.get_user_partner_id(auth.uid())
  )
);

-- RLS: Admins can manage all lead documents
CREATE POLICY "Admins can manage all lead documents"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'lead-documents'
  AND public.is_admin_or_super(auth.uid())
);

-- RLS: Partners can update their own documents
CREATE POLICY "Partners can update own lead documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'lead-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.student_leads
    WHERE partner_id = public.get_user_partner_id(auth.uid())
  )
);
