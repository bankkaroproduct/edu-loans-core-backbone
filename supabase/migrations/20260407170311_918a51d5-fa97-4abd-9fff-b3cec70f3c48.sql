-- Add updated_at triggers to all tables that have updated_at columns but missing triggers

CREATE TRIGGER update_lenders_updated_at
  BEFORE UPDATE ON public.lenders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_courses_master_updated_at
  BEFORE UPDATE ON public.courses_master
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_countries_master_updated_at
  BEFORE UPDATE ON public.countries_master
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_universities_master_updated_at
  BEFORE UPDATE ON public.universities_master
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_document_master_updated_at
  BEFORE UPDATE ON public.document_master
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_partner_payout_rules_updated_at
  BEFORE UPDATE ON public.partner_payout_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_partner_payout_records_updated_at
  BEFORE UPDATE ON public.partner_payout_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lead_document_requirements_updated_at
  BEFORE UPDATE ON public.lead_document_requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();