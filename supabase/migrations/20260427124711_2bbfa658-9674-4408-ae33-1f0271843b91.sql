-- Hard DB-level gate: no new lead initiation against an inactive partner organization.
-- Affects: student_leads INSERT, bulk_upload_batches INSERT, lead_edit_requests INSERT.
-- Existing rows remain fully readable/updatable; this only blocks NEW initiation.

CREATE OR REPLACE FUNCTION public.is_partner_org_active(_partner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT status = 'active'::partner_status_enum
       FROM public.partner_organizations
      WHERE id = _partner_id
      LIMIT 1),
    false
  )
$$;

-- student_leads: replace partner INSERT policy with status check
DROP POLICY IF EXISTS "Partners can create leads for own org" ON public.student_leads;
CREATE POLICY "Partners can create leads for own org"
  ON public.student_leads
  FOR INSERT
  TO public
  WITH CHECK (
    partner_id = public.get_user_partner_id(auth.uid())
    AND public.is_partner_org_active(partner_id)
  );

-- Admins: replace blanket ALL with split policies so admin INSERT is also blocked
-- when targeting an inactive partner (covers admin-as-partner / on-behalf creation).
DROP POLICY IF EXISTS "Admins can manage all leads" ON public.student_leads;

CREATE POLICY "Admins can read all leads"
  ON public.student_leads
  FOR SELECT
  TO public
  USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can update all leads"
  ON public.student_leads
  FOR UPDATE
  TO public
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can delete all leads"
  ON public.student_leads
  FOR DELETE
  TO public
  USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can insert leads only for active partners"
  ON public.student_leads
  FOR INSERT
  TO public
  WITH CHECK (
    public.is_admin_or_super(auth.uid())
    AND public.is_partner_org_active(partner_id)
  );

-- bulk_upload_batches: same treatment for partner + admin INSERTs
DROP POLICY IF EXISTS "Partners can create batches for own org" ON public.bulk_upload_batches;
CREATE POLICY "Partners can create batches for own org"
  ON public.bulk_upload_batches
  FOR INSERT
  TO public
  WITH CHECK (
    partner_id = public.get_user_partner_id(auth.uid())
    AND public.is_partner_org_active(partner_id)
  );

DROP POLICY IF EXISTS "Admins can manage all batches" ON public.bulk_upload_batches;

CREATE POLICY "Admins can read all batches"
  ON public.bulk_upload_batches
  FOR SELECT TO public
  USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can update all batches"
  ON public.bulk_upload_batches
  FOR UPDATE TO public
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can delete all batches"
  ON public.bulk_upload_batches
  FOR DELETE TO public
  USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can insert batches only for active partners"
  ON public.bulk_upload_batches
  FOR INSERT TO public
  WITH CHECK (
    public.is_admin_or_super(auth.uid())
    AND public.is_partner_org_active(partner_id)
  );