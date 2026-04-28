-- Additive: lender contact fields used by the Send-to-Lender compose flow.
ALTER TABLE public.lenders
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS cc_emails    text[] NOT NULL DEFAULT '{}'::text[];

-- Seed the default email template used to prefill the compose screen.
-- Uses {{var}} tokens that render.ts already supports + new lender/case vars
-- which the page passes in as `variables` to send-communication.
INSERT INTO public.communication_templates
  (template_key, channel, subject, body, description, active_flag)
VALUES (
  'lender_application_submission',
  'email',
  'EduLoans Application Submission – {{student_name}} – {{lead_id}}',
  E'Hello {{lender_name}} Team,\n\n' ||
  E'Please find below the application details for our applicant. Supporting documents are attached.\n\n' ||
  E'— Applicant —\n' ||
  E'Name: {{student_name}}\n' ||
  E'Lead ID: {{lead_id}}\n' ||
  E'Phone: {{student_phone}}\n' ||
  E'Email: {{student_email}}\n\n' ||
  E'— Study Plan —\n' ||
  E'Country: {{study_country}}\n' ||
  E'University: {{university_name}}\n' ||
  E'Course: {{course_name}} ({{course_category}})\n' ||
  E'Intake: {{intake_term}} {{intake_year}}\n\n' ||
  E'— Loan —\n' ||
  E'Amount Required: INR {{loan_amount}}\n' ||
  E'Collateral: {{collateral_summary}}\n\n' ||
  E'— Co-applicant —\n' ||
  E'Name: {{coapplicant_name}} ({{coapplicant_relation}})\n' ||
  E'Income: INR {{coapplicant_income}}\n' ||
  E'Employment: {{coapplicant_employment_type}}\n\n' ||
  E'— Academics —\n' ||
  E'Highest Qualification: {{highest_qualification}}\n' ||
  E'Marks/GPA: {{marks_gpa}}\n\n' ||
  E'Please review and revert with sanction terms.\n\n' ||
  E'Regards,\n{{advisor_name}}\nEduLoans (CashKaro)',
  'Default subject + body used by the Admin "Send to Lender" compose flow.',
  true
)
ON CONFLICT (template_key) DO NOTHING;