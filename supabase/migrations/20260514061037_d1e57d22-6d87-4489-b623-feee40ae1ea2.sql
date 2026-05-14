ALTER TABLE public.communication_templates
ADD COLUMN IF NOT EXISTS resend_template_id text;

COMMENT ON COLUMN public.communication_templates.resend_template_id IS
'Optional Resend template ID or alias. When set on an email template and no body_override is provided at send time, send-communication uses Resend template mode (template + variables) instead of inline HTML. NULL = legacy HTML path (default).';