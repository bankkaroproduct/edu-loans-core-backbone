-- Templates table
CREATE TABLE public.communication_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL UNIQUE,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  subject text,
  body text NOT NULL,
  description text,
  active_flag boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_communication_templates_channel ON public.communication_templates(channel) WHERE active_flag = true;

ALTER TABLE public.communication_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage communication templates"
  ON public.communication_templates
  FOR ALL
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Authenticated can read active templates"
  ON public.communication_templates
  FOR SELECT
  TO authenticated
  USING (active_flag = true);

CREATE TRIGGER update_communication_templates_updated_at
  BEFORE UPDATE ON public.communication_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Logs table (admin-only)
CREATE TABLE public.communication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  provider text NOT NULL CHECK (provider IN ('mock', 'resend', 'twilio_sandbox')),
  template_key text NOT NULL,
  recipient text NOT NULL,
  lead_id uuid,
  payload_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  mode_used text NOT NULL CHECK (mode_used IN ('mock', 'demo_live')),
  send_status text NOT NULL CHECK (send_status IN ('simulated', 'sent', 'failed')),
  provider_message_id text,
  error_message text,
  triggered_by_user uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_communication_logs_lead_id ON public.communication_logs(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX idx_communication_logs_created_at ON public.communication_logs(created_at DESC);
CREATE INDEX idx_communication_logs_channel_status ON public.communication_logs(channel, send_status);

ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;

-- ADMIN-ONLY (correction 1: no partner read access)
CREATE POLICY "Admins manage communication logs"
  ON public.communication_logs
  FOR ALL
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

-- Seed 8 demo templates
INSERT INTO public.communication_templates (template_key, channel, subject, body, description) VALUES
  ('lead_received_email', 'email', 'We received your loan application — {{lead_id}}',
   E'Hi {{student_name}},\n\nThank you for reaching out to EduLoans. We have received your education loan enquiry (Reference: {{lead_id}}).\n\nOur advisor will review your profile and get in touch shortly.\n\nYou can track your application here: {{dashboard_link}}\n\nBest regards,\nEduLoans Team',
   'Sent when a new lead is created'),

  ('application_submitted_email', 'email', 'Your application has been submitted — {{lead_id}}',
   E'Hi {{student_name}},\n\nGreat news! Your education loan application ({{lead_id}}) has been submitted for processing.\n\nYour advisor {{advisor_name}} will guide you through the next steps.\n\nBest regards,\nEduLoans Team',
   'Sent when application moves to submitted stage'),

  ('document_pending_email', 'email', 'Action required: document pending — {{lead_id}}',
   E'Hi {{student_name}},\n\nWe need one more document to continue processing your application ({{lead_id}}):\n\n• {{pending_document_name}}\n\nPlease upload it at your earliest convenience.\n\nBest regards,\nEduLoans Team',
   'Reminder for missing/pending documents'),

  ('status_update_email', 'email', 'Status update on your application — {{lead_id}}',
   E'Hi {{student_name}},\n\nYour application ({{lead_id}}) status has been updated to: {{application_status}}.\n\nLender: {{lender_name}}\n\nWe will keep you posted on the next steps.\n\nBest regards,\nEduLoans Team',
   'General status change notification'),

  ('lead_received_whatsapp', 'whatsapp', NULL,
   E'Hi {{student_name}}! 👋\n\nWe received your EduLoans enquiry. Your reference: {{lead_id}}.\n\nOur team will reach out shortly.',
   'WhatsApp confirmation when lead is created'),

  ('advisor_will_contact_whatsapp', 'whatsapp', NULL,
   E'Hi {{student_name}}, this is {{advisor_name}} from EduLoans. I will be your loan advisor. I''ll call you within the next 24 hours to walk you through the process.',
   'WhatsApp from assigned advisor'),

  ('document_reminder_whatsapp', 'whatsapp', NULL,
   E'Hi {{student_name}}, quick reminder — we still need *{{pending_document_name}}* to proceed with your loan application. Please upload it when you get a moment. 🙏',
   'WhatsApp document reminder'),

  ('status_update_whatsapp', 'whatsapp', NULL,
   E'Hi {{student_name}}, your EduLoans application status is now: *{{application_status}}*. We''ll share next steps shortly.',
   'WhatsApp status update');