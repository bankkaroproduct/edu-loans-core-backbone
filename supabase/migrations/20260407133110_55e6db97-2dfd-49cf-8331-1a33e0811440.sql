
-- =============================================
-- PHASE 1: ENUM TYPES
-- =============================================

CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'partner_admin', 'partner_agent');
CREATE TYPE public.partner_type_enum AS ENUM ('education_consultant', 'study_abroad_agency', 'university_partner', 'digital_aggregator', 'freelance_counsellor', 'other');
CREATE TYPE public.partner_status_enum AS ENUM ('active', 'inactive', 'onboarding', 'suspended', 'terminated');
CREATE TYPE public.lead_stage_enum AS ENUM ('draft', 'submitted', 'under_initial_review', 'documents_pending', 'documents_under_review', 'bre_evaluated', 'sent_to_lender', 'login_submitted', 'credit_query', 'sanction_received', 'disbursed', 'rejected', 'dropped', 'on_hold');
CREATE TYPE public.lead_status_enum AS ENUM ('new', 'in_progress', 'pending_info', 'reupload_needed', 'awaiting_verification', 'verified', 'under_assessment', 'query_raised', 'query_resolved', 'approved', 'conditionally_approved', 'declined', 'withdrawn', 'on_hold', 'completed', 'not_applicable');
CREATE TYPE public.document_status_enum AS ENUM ('not_uploaded', 'uploaded', 'under_review', 'verified', 'rejected', 'reupload_needed', 'waived', 'not_applicable');
CREATE TYPE public.payout_status_enum AS ENUM ('pending', 'triggered', 'approved', 'paid', 'reversed', 'on_hold', 'cancelled');
CREATE TYPE public.bulk_upload_status_enum AS ENUM ('uploaded', 'processing', 'completed', 'completed_with_errors', 'failed');
CREATE TYPE public.notification_type_enum AS ENUM ('lead_created', 'lead_updated', 'stage_changed', 'document_uploaded', 'document_verified', 'document_rejected', 'payout_triggered', 'payout_approved', 'payout_paid', 'bulk_upload_completed', 'system_alert');
CREATE TYPE public.note_type_enum AS ENUM ('internal', 'partner_visible', 'system');
CREATE TYPE public.payout_basis_enum AS ENUM ('flat_fee', 'percentage_of_loan', 'percentage_of_disbursed', 'tiered', 'custom');
CREATE TYPE public.fit_category_enum AS ENUM ('best_fit', 'good_fit', 'premium_match', 'backup', 'not_eligible');

-- =============================================
-- PHASE 2: UTILITY FUNCTIONS
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =============================================
-- PHASE 2: CORE TABLES — USERS & PARTNERS
-- =============================================

CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role public.app_role NOT NULL DEFAULT 'partner_agent',
  partner_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(auth_user_id),
  UNIQUE(email)
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.partner_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_code TEXT NOT NULL UNIQUE,
  legal_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  partner_type public.partner_type_enum NOT NULL DEFAULT 'education_consultant',
  contact_person_name TEXT,
  contact_person_email TEXT,
  contact_person_phone TEXT,
  payout_entity_name TEXT,
  payout_terms TEXT,
  status public.partner_status_enum NOT NULL DEFAULT 'onboarding',
  onboarding_date DATE,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.partner_organizations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_partner_organizations_updated_at BEFORE UPDATE ON public.partner_organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add FK from users to partner_organizations
ALTER TABLE public.users ADD CONSTRAINT fk_users_partner FOREIGN KEY (partner_id) REFERENCES public.partner_organizations(id);

CREATE TABLE public.partner_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partner_organizations(id) ON DELETE CASCADE,
  branch_name TEXT NOT NULL,
  branch_code TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  contact_person TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.partner_branches ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_partner_branches_updated_at BEFORE UPDATE ON public.partner_branches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- PHASE 3: MASTER DATA TABLES
-- =============================================

CREATE TABLE public.countries_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_name TEXT NOT NULL UNIQUE,
  iso_code TEXT UNIQUE,
  active_flag BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.countries_master ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.universities_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_name TEXT NOT NULL,
  country TEXT NOT NULL,
  ranking_bucket TEXT,
  aliases TEXT[],
  active_flag BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.universities_master ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.courses_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_name TEXT NOT NULL,
  normalized_course_name TEXT,
  course_category TEXT,
  stem_flag BOOLEAN NOT NULL DEFAULT false,
  mba_flag BOOLEAN NOT NULL DEFAULT false,
  management_flag BOOLEAN NOT NULL DEFAULT false,
  active_flag BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.courses_master ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.lenders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_code TEXT NOT NULL UNIQUE,
  lender_name TEXT NOT NULL,
  lender_type TEXT,
  active_flag BOOLEAN NOT NULL DEFAULT true,
  processing_time_days INTEGER,
  loan_amount_min NUMERIC(15,2),
  loan_amount_max NUMERIC(15,2),
  income_expectations_min NUMERIC(15,2),
  supports_collateral BOOLEAN NOT NULL DEFAULT false,
  supports_unsecured BOOLEAN NOT NULL DEFAULT false,
  supported_countries TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lenders ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.document_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_code TEXT NOT NULL UNIQUE,
  document_name TEXT NOT NULL,
  document_category TEXT,
  applicable_for TEXT NOT NULL DEFAULT 'all',
  mandatory_flag BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  active_flag BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.document_master ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.lifecycle_stage_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_key public.lead_stage_enum NOT NULL UNIQUE,
  stage_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  is_terminal BOOLEAN NOT NULL DEFAULT false,
  active_flag BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lifecycle_stage_master ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.lifecycle_status_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_key public.lead_stage_enum NOT NULL,
  status_key public.lead_status_enum NOT NULL,
  status_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  active_flag BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(stage_key, status_key)
);
ALTER TABLE public.lifecycle_status_master ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.intake_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_term TEXT NOT NULL,
  intake_year INTEGER NOT NULL,
  active_flag BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(intake_term, intake_year)
);
ALTER TABLE public.intake_master ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PHASE 4: LEAD ENGINE
-- =============================================

CREATE SEQUENCE public.lead_id_seq START WITH 1;

CREATE OR REPLACE FUNCTION public.generate_lead_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.lead_id := 'EL-PL-' || LPAD(nextval('public.lead_id_seq')::text, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.student_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id TEXT UNIQUE,
  partner_id UUID NOT NULL REFERENCES public.partner_organizations(id),
  source_type TEXT NOT NULL DEFAULT 'partner',
  source_sub_type TEXT,
  partner_user_id UUID REFERENCES public.users(id),
  student_first_name TEXT NOT NULL,
  student_last_name TEXT,
  student_full_name TEXT GENERATED ALWAYS AS (COALESCE(student_first_name, '') || ' ' || COALESCE(student_last_name, '')) STORED,
  student_email TEXT,
  student_phone TEXT NOT NULL,
  student_whatsapp TEXT,
  city TEXT,
  state TEXT,
  country_of_residence TEXT,
  intended_study_country TEXT NOT NULL,
  intake_term TEXT NOT NULL,
  intake_year INTEGER NOT NULL,
  course_name TEXT NOT NULL,
  course_category TEXT,
  university_name_raw TEXT,
  university_id UUID REFERENCES public.universities_master(id),
  loan_amount_required NUMERIC(15,2) CHECK (loan_amount_required > 0),
  coapplicant_name TEXT,
  coapplicant_relation TEXT,
  coapplicant_income NUMERIC(15,2) CHECK (coapplicant_income >= 0),
  collateral_available BOOLEAN,
  collateral_notes TEXT,
  current_stage public.lead_stage_enum NOT NULL DEFAULT 'draft',
  current_status public.lead_status_enum NOT NULL DEFAULT 'new',
  status_reason TEXT,
  assigned_admin_id UUID REFERENCES public.users(id),
  student_portal_user_id UUID,
  duplicate_flag BOOLEAN NOT NULL DEFAULT false,
  fraud_flag BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.student_leads ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER generate_lead_id_trigger BEFORE INSERT ON public.student_leads FOR EACH ROW EXECUTE FUNCTION public.generate_lead_id();
CREATE TRIGGER update_student_leads_updated_at BEFORE UPDATE ON public.student_leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_student_leads_partner ON public.student_leads(partner_id);
CREATE INDEX idx_student_leads_stage ON public.student_leads(current_stage);
CREATE INDEX idx_student_leads_phone_intake ON public.student_leads(student_phone, intake_term, intake_year);

CREATE TABLE public.lead_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.student_leads(id) ON DELETE CASCADE,
  previous_stage public.lead_stage_enum,
  new_stage public.lead_stage_enum NOT NULL,
  previous_status public.lead_status_enum,
  new_status public.lead_status_enum NOT NULL,
  changed_by_user_id UUID REFERENCES public.users(id),
  changed_by_role public.app_role,
  change_reason TEXT,
  internal_note TEXT,
  partner_visible_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_stage_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_lead_stage_history_lead ON public.lead_stage_history(lead_id);

-- Trigger to auto-log stage changes
CREATE OR REPLACE FUNCTION public.log_lead_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.current_stage IS DISTINCT FROM NEW.current_stage OR OLD.current_status IS DISTINCT FROM NEW.current_status THEN
    INSERT INTO public.lead_stage_history (lead_id, previous_stage, new_stage, previous_status, new_status)
    VALUES (NEW.id, OLD.current_stage, NEW.current_stage, OLD.current_status, NEW.current_status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER log_lead_stage_change_trigger AFTER UPDATE ON public.student_leads FOR EACH ROW EXECUTE FUNCTION public.log_lead_stage_change();

CREATE TABLE public.lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.student_leads(id) ON DELETE CASCADE,
  note_type public.note_type_enum NOT NULL DEFAULT 'partner_visible',
  note_text TEXT NOT NULL,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_lead_notes_lead ON public.lead_notes(lead_id);

-- =============================================
-- PHASE 5: DOCUMENT ARCHITECTURE
-- =============================================

CREATE TABLE public.lead_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.student_leads(id) ON DELETE CASCADE,
  document_type_id UUID REFERENCES public.document_master(id),
  uploaded_by_user_id UUID REFERENCES public.users(id),
  uploaded_by_role public.app_role,
  file_name TEXT NOT NULL,
  file_url TEXT,
  storage_path TEXT,
  mime_type TEXT,
  verification_status public.document_status_enum NOT NULL DEFAULT 'uploaded',
  verification_remark TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_by UUID REFERENCES public.users(id),
  verified_at TIMESTAMPTZ,
  version_number INTEGER NOT NULL DEFAULT 1,
  is_latest BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.lead_documents ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_lead_documents_lead ON public.lead_documents(lead_id);

CREATE TABLE public.lead_document_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.student_leads(id) ON DELETE CASCADE,
  document_type_id UUID NOT NULL REFERENCES public.document_master(id),
  required_flag BOOLEAN NOT NULL DEFAULT true,
  status public.document_status_enum NOT NULL DEFAULT 'not_uploaded',
  lender_id UUID REFERENCES public.lenders(id),
  remarks TEXT,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_document_requirements ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PHASE 6: BRE COMPATIBILITY
-- =============================================

CREATE TABLE public.lead_lender_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.student_leads(id) ON DELETE CASCADE,
  lender_id UUID NOT NULL REFERENCES public.lenders(id),
  score NUMERIC(5,2),
  fit_category public.fit_category_enum,
  lock_status BOOLEAN NOT NULL DEFAULT false,
  recommendation_rank INTEGER,
  recommendation_reason_summary TEXT,
  bre_output_json JSONB,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_lender_matches ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_lead_lender_matches_lead ON public.lead_lender_matches(lead_id);

CREATE TABLE public.lender_university_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id UUID NOT NULL REFERENCES public.lenders(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES public.universities_master(id) ON DELETE CASCADE,
  mapping_type TEXT NOT NULL DEFAULT 'supported',
  priority_rank INTEGER,
  notes TEXT,
  active_flag BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lender_id, university_id)
);
ALTER TABLE public.lender_university_mappings ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PHASE 7: PAYOUT ARCHITECTURE
-- =============================================

CREATE TABLE public.partner_payout_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partner_organizations(id) ON DELETE CASCADE,
  lender_id UUID REFERENCES public.lenders(id),
  payout_basis public.payout_basis_enum NOT NULL DEFAULT 'flat_fee',
  payout_amount NUMERIC(15,2),
  payout_percent NUMERIC(5,2),
  payout_trigger_stage public.lead_stage_enum NOT NULL DEFAULT 'disbursed',
  clawback_rule TEXT,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  active_flag BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.partner_payout_rules ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.partner_payout_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.student_leads(id),
  partner_id UUID NOT NULL REFERENCES public.partner_organizations(id),
  payout_rule_id UUID REFERENCES public.partner_payout_rules(id),
  payout_status public.payout_status_enum NOT NULL DEFAULT 'pending',
  payout_amount NUMERIC(15,2),
  payout_triggered_at TIMESTAMPTZ,
  payout_approved_at TIMESTAMPTZ,
  payout_paid_at TIMESTAMPTZ,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.partner_payout_records ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PHASE 8: BULK UPLOAD
-- =============================================

CREATE SEQUENCE public.batch_id_seq START WITH 1;

CREATE OR REPLACE FUNCTION public.generate_batch_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.batch_id := 'BULK-' || LPAD(nextval('public.batch_id_seq')::text, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.bulk_upload_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id TEXT UNIQUE,
  partner_id UUID NOT NULL REFERENCES public.partner_organizations(id),
  uploaded_by UUID NOT NULL REFERENCES public.users(id),
  file_name TEXT NOT NULL,
  file_url TEXT,
  total_rows INTEGER NOT NULL DEFAULT 0,
  success_rows INTEGER NOT NULL DEFAULT 0,
  failed_rows INTEGER NOT NULL DEFAULT 0,
  batch_status public.bulk_upload_status_enum NOT NULL DEFAULT 'uploaded',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);
ALTER TABLE public.bulk_upload_batches ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER generate_batch_id_trigger BEFORE INSERT ON public.bulk_upload_batches FOR EACH ROW EXECUTE FUNCTION public.generate_batch_id();

CREATE TABLE public.bulk_upload_row_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.bulk_upload_batches(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  raw_payload JSONB,
  validation_status TEXT NOT NULL DEFAULT 'pending',
  failure_reason TEXT,
  created_lead_id UUID REFERENCES public.student_leads(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bulk_upload_row_results ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PHASE 9: AUDIT & NOTIFICATIONS
-- =============================================

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES public.users(id),
  actor_role public.app_role,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action_type TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_actor ON public.audit_logs(actor_user_id);

CREATE TABLE public.notifications_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT,
  entity_id UUID,
  recipient_user_id UUID REFERENCES public.users(id),
  recipient_role public.app_role,
  notification_type public.notification_type_enum NOT NULL,
  message_body TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications_queue ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PHASE 10: SECURITY DEFINER FUNCTIONS
-- =============================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_auth_id uuid)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE auth_user_id = _auth_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_user_partner_id(_auth_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT partner_id FROM public.users WHERE auth_user_id = _auth_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_super(_auth_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE auth_user_id = _auth_id AND role IN ('super_admin', 'admin')
  )
$$;

-- =============================================
-- PHASE 10: RLS POLICIES
-- =============================================

-- USERS table
CREATE POLICY "Admins can view all users" ON public.users FOR SELECT USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Partner users can view own org users" ON public.users FOR SELECT USING (partner_id = public.get_user_partner_id(auth.uid()));
CREATE POLICY "Admins can manage all users" ON public.users FOR ALL USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth_user_id = auth.uid());

-- USER_ROLES table
CREATE POLICY "Admins can manage user roles" ON public.user_roles FOR ALL USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (
  user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

-- PARTNER_ORGANIZATIONS
CREATE POLICY "Admins can manage all partners" ON public.partner_organizations FOR ALL USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Partners can view own org" ON public.partner_organizations FOR SELECT USING (id = public.get_user_partner_id(auth.uid()));

-- PARTNER_BRANCHES
CREATE POLICY "Admins can manage all branches" ON public.partner_branches FOR ALL USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Partners can view own branches" ON public.partner_branches FOR SELECT USING (partner_id = public.get_user_partner_id(auth.uid()));

-- MASTER TABLES (read for all authenticated, write for admins)
CREATE POLICY "Anyone can read countries" ON public.countries_master FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage countries" ON public.countries_master FOR ALL USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Anyone can read universities" ON public.universities_master FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage universities" ON public.universities_master FOR ALL USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Anyone can read courses" ON public.courses_master FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage courses" ON public.courses_master FOR ALL USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Anyone can read lenders" ON public.lenders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage lenders" ON public.lenders FOR ALL USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Anyone can read documents master" ON public.document_master FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage documents master" ON public.document_master FOR ALL USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Anyone can read lifecycle stages" ON public.lifecycle_stage_master FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage lifecycle stages" ON public.lifecycle_stage_master FOR ALL USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Anyone can read lifecycle statuses" ON public.lifecycle_status_master FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage lifecycle statuses" ON public.lifecycle_status_master FOR ALL USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Anyone can read intakes" ON public.intake_master FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage intakes" ON public.intake_master FOR ALL USING (public.is_admin_or_super(auth.uid()));

-- STUDENT_LEADS
CREATE POLICY "Admins can manage all leads" ON public.student_leads FOR ALL USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Partners can view own leads" ON public.student_leads FOR SELECT USING (partner_id = public.get_user_partner_id(auth.uid()));
CREATE POLICY "Partners can create leads for own org" ON public.student_leads FOR INSERT WITH CHECK (partner_id = public.get_user_partner_id(auth.uid()));

-- LEAD_STAGE_HISTORY
CREATE POLICY "Admins can view all history" ON public.lead_stage_history FOR ALL USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Partners can view own lead history" ON public.lead_stage_history FOR SELECT USING (
  lead_id IN (SELECT id FROM public.student_leads WHERE partner_id = public.get_user_partner_id(auth.uid()))
);

-- LEAD_NOTES (partner users cannot see internal notes)
CREATE POLICY "Admins can manage all notes" ON public.lead_notes FOR ALL USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Partners can view partner-visible notes on own leads" ON public.lead_notes FOR SELECT USING (
  note_type != 'internal' AND
  lead_id IN (SELECT id FROM public.student_leads WHERE partner_id = public.get_user_partner_id(auth.uid()))
);
CREATE POLICY "Partners can create notes on own leads" ON public.lead_notes FOR INSERT WITH CHECK (
  note_type = 'partner_visible' AND
  lead_id IN (SELECT id FROM public.student_leads WHERE partner_id = public.get_user_partner_id(auth.uid()))
);

-- LEAD_DOCUMENTS
CREATE POLICY "Admins can manage all documents" ON public.lead_documents FOR ALL USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Partners can view own lead documents" ON public.lead_documents FOR SELECT USING (
  lead_id IN (SELECT id FROM public.student_leads WHERE partner_id = public.get_user_partner_id(auth.uid()))
);
CREATE POLICY "Partners can upload documents to own leads" ON public.lead_documents FOR INSERT WITH CHECK (
  lead_id IN (SELECT id FROM public.student_leads WHERE partner_id = public.get_user_partner_id(auth.uid()))
);

-- LEAD_DOCUMENT_REQUIREMENTS
CREATE POLICY "Admins can manage all doc requirements" ON public.lead_document_requirements FOR ALL USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Partners can view own lead doc requirements" ON public.lead_document_requirements FOR SELECT USING (
  lead_id IN (SELECT id FROM public.student_leads WHERE partner_id = public.get_user_partner_id(auth.uid()))
);

-- LEAD_LENDER_MATCHES
CREATE POLICY "Admins can manage all lender matches" ON public.lead_lender_matches FOR ALL USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Partners can view own lead matches" ON public.lead_lender_matches FOR SELECT USING (
  lead_id IN (SELECT id FROM public.student_leads WHERE partner_id = public.get_user_partner_id(auth.uid()))
);

-- LENDER_UNIVERSITY_MAPPINGS
CREATE POLICY "Anyone can read lender university mappings" ON public.lender_university_mappings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage lender university mappings" ON public.lender_university_mappings FOR ALL USING (public.is_admin_or_super(auth.uid()));

-- PARTNER_PAYOUT_RULES (read-only for partners)
CREATE POLICY "Admins can manage all payout rules" ON public.partner_payout_rules FOR ALL USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Partners can view own payout rules" ON public.partner_payout_rules FOR SELECT USING (partner_id = public.get_user_partner_id(auth.uid()));

-- PARTNER_PAYOUT_RECORDS
CREATE POLICY "Admins can manage all payout records" ON public.partner_payout_records FOR ALL USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Partners can view own payout records" ON public.partner_payout_records FOR SELECT USING (partner_id = public.get_user_partner_id(auth.uid()));

-- BULK_UPLOAD_BATCHES
CREATE POLICY "Admins can manage all batches" ON public.bulk_upload_batches FOR ALL USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Partners can view own batches" ON public.bulk_upload_batches FOR SELECT USING (partner_id = public.get_user_partner_id(auth.uid()));
CREATE POLICY "Partners can create batches for own org" ON public.bulk_upload_batches FOR INSERT WITH CHECK (partner_id = public.get_user_partner_id(auth.uid()));

-- BULK_UPLOAD_ROW_RESULTS
CREATE POLICY "Admins can manage all row results" ON public.bulk_upload_row_results FOR ALL USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Partners can view own batch row results" ON public.bulk_upload_row_results FOR SELECT USING (
  batch_id IN (SELECT id FROM public.bulk_upload_batches WHERE partner_id = public.get_user_partner_id(auth.uid()))
);

-- AUDIT_LOGS (admin only)
CREATE POLICY "Admins can view all audit logs" ON public.audit_logs FOR SELECT USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "System can insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- NOTIFICATIONS_QUEUE
CREATE POLICY "Admins can manage all notifications" ON public.notifications_queue FOR ALL USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Users can view own notifications" ON public.notifications_queue FOR SELECT USING (
  recipient_user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);
