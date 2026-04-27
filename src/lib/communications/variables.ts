/**
 * Canonical catalog of variables supported by the communication template engine.
 *
 * Keep aligned with `leadToVariables()` in `render.ts` and the variables
 * accepted by the `send-communication` edge function. The `example` value is
 * used to pre-fill the live preview in the template editor so admins
 * immediately see realistic output.
 *
 * `liveBound` indicates whether the variable is auto-resolved from a lead
 * row by `leadToVariables()` today. Variables with `liveBound: false` only
 * preview in the Test Panel — they will become live when the data layer
 * (e.g. loan_applications, lender_queries, lead_holds tables) catches up
 * and `leadToVariables()` is extended in a dedicated pass.
 */
export interface TemplateVariable {
  key: string;
  label: string;
  example: string;
  description?: string;
  /** True if leadToVariables() resolves this from a lead row at send time. */
  liveBound?: boolean;
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  // ────────── Live-bound today (leadToVariables in render.ts) ──────────
  { key: "student_name", label: "Student name", example: "Aarav Sharma", liveBound: true },
  { key: "lead_id", label: "Lead ID", example: "EL-PL-000123", liveBound: true },
  { key: "application_status", label: "Application status", example: "documents pending", liveBound: true },
  { key: "dashboard_link", label: "Dashboard link", example: "https://app.eduloans.com/leads", liveBound: true },
  { key: "advisor_name", label: "Advisor name", example: "Your EduLoans Advisor", liveBound: true },
  { key: "pending_document_name", label: "Pending document", example: "Passport", liveBound: true },
  { key: "lender_name", label: "Lender name", example: "HDFC Credila", liveBound: true },
  { key: "partner_name", label: "Partner name", example: "Acme Education", liveBound: true },
  { key: "timestamp", label: "Timestamp", example: new Date().toLocaleString(), liveBound: true },

  // ────────── Preview-only (resolvable from existing schema, not yet live-bound) ──────────
  {
    key: "advisor_phone",
    label: "Advisor phone",
    example: "+91 98765 43210",
    description: "users.phone via student_leads.assigned_admin_id",
  },
  {
    key: "advisor_email",
    label: "Advisor email",
    example: "advisor@eduloans.com",
    description: "users.email via student_leads.assigned_admin_id",
  },
  {
    key: "document_checklist",
    label: "Document checklist",
    example: "- Passport\n- 10th Marksheet\n- 12th Marksheet\n- Co-applicant PAN\n- Co-applicant ITR (last 2 years)",
    description: "Bullet list from lead_document_requirements where required_flag=true and status='not_uploaded'",
  },
  {
    key: "lender_tat",
    label: "Lender TAT",
    example: "5 working days",
    description: "lenders.processing_time_days for the top-ranked match in lead_lender_matches",
  },
  {
    key: "rejected_document_name",
    label: "Rejected document",
    example: "Passport",
    description: "document_master.document_name for most recent lead_documents row with verification_status='rejected'",
  },
  {
    key: "rejection_reason",
    label: "Rejection reason",
    example: "Pages 3 and 4 are not clearly visible. Please re-scan.",
    description: "lead_documents.verification_remark (doc-level) or student_leads.status_reason (lead-level)",
  },
  {
    key: "alternative_options_count",
    label: "Alternative options count",
    example: "3",
    description: "Count of remaining eligible lenders from lead_lender_matches",
  },
  {
    key: "alternative_options",
    label: "Alternative options list",
    example: "- Avanse Financial Services\n- InCred Education Loans\n- Auxilo Finserve",
    description: "Bullet list of remaining eligible lenders from lead_lender_matches",
  },
  {
    key: "co_applicant_name",
    label: "Co-applicant name",
    example: "Rajesh Sharma",
    description: "student_leads.coapplicant_name (denormalized — no co_applicants table yet)",
  },
  {
    key: "co_applicant_phone",
    label: "Co-applicant phone",
    example: "+91 98765 11111",
    description: "student_leads.coapplicant_mobile (used as recipient, not body variable)",
  },
  {
    key: "days_inactive",
    label: "Days inactive",
    example: "14",
    description: "Derived from now() − student_leads.updated_at (no last_activity_at column yet)",
  },
  {
    key: "pending_document_count",
    label: "Pending document count",
    example: "3",
    description: "Count from lead_document_requirements where required_flag=true and status='not_uploaded'",
  },
  {
    key: "pending_documents_list",
    label: "Pending documents list",
    example: "- Passport\n- Co-applicant PAN\n- Co-applicant ITR",
    description: "Bullet list from lead_document_requirements where required_flag=true and status='not_uploaded'",
  },

  // ────────── Preview-only (source NOT in schema — placeholder examples awaiting data layer) ──────────
  {
    key: "sanctioned_amount",
    label: "Sanctioned amount",
    example: "40,00,000",
    description: "PLACEHOLDER — needs loan_applications.sanctioned_amount (table missing)",
  },
  {
    key: "interest_rate",
    label: "Interest rate",
    example: "10.5%",
    description: "PLACEHOLDER — needs loan_applications.interest_rate (table missing)",
  },
  {
    key: "disbursed_amount",
    label: "Disbursed amount",
    example: "40,00,000",
    description: "PLACEHOLDER — needs loan_applications.disbursed_amount (table missing)",
  },
  {
    key: "disbursal_destination",
    label: "Disbursal destination",
    example: "your university directly",
    description: "PLACEHOLDER — needs loan_applications.disbursal_destination (table missing)",
  },
  {
    key: "lender_query_text",
    label: "Lender query text",
    example: "Please share the latest 3 months of co-applicant salary slips.",
    description: "PLACEHOLDER — needs lender_queries.query_text (table missing)",
  },
  {
    key: "query_due_date",
    label: "Query due date",
    example: "12 May 2026",
    description: "PLACEHOLDER — needs lender_queries.due_date (table missing)",
  },
  {
    key: "hold_reason_short",
    label: "Hold reason (short)",
    example: "Awaiting co-applicant docs",
    description: "PLACEHOLDER — needs lead_holds.reason_short (table missing)",
  },
  {
    key: "hold_reason",
    label: "Hold reason",
    example: "We are waiting on the co-applicant's salary slips and bank statements before the lender can resume review.",
    description: "PLACEHOLDER — needs lead_holds.reason_full (table missing)",
  },
  {
    key: "hold_expected_resolution",
    label: "Hold expected resolution",
    example: "Within 5 working days of receiving the pending documents.",
    description: "PLACEHOLDER — needs lead_holds.expected_resolution_text (table missing)",
  },
  {
    key: "coapplicant_action_required",
    label: "Co-applicant action required",
    example: "Please share your latest 3 months of salary slips and bank statements.",
    description: "PLACEHOLDER — needs co_applicant_actions.action_text (table missing)",
  },
  {
    key: "coapplicant_due_date",
    label: "Co-applicant action due date",
    example: "12 May 2026",
    description: "PLACEHOLDER — needs co_applicant_actions.due_date (table missing)",
  },
  {
    key: "processing_fee_amount",
    label: "Processing fee amount",
    example: "25,000",
    description: "PLACEHOLDER — needs loan_applications.processing_fee_amount (table missing)",
  },
  {
    key: "processing_fee_due_date",
    label: "Processing fee due date",
    example: "20 May 2026",
    description: "PLACEHOLDER — needs loan_applications.processing_fee_due_date (table missing)",
  },
  {
    key: "processing_fee_link",
    label: "Processing fee payment link",
    example: "https://pay.eduloans.com/pf/EL-PL-000123",
    description: "PLACEHOLDER — needs loan_applications.processing_fee_link (table missing)",
  },
  {
    key: "disbursal_tat",
    label: "Disbursal TAT",
    example: "3 working days",
    description: "PLACEHOLDER — needs lenders.disbursal_tat_days (column missing)",
  },
];

/** Build a default `vars` map from the catalog (used to seed the live preview). */
export function defaultVariableValues(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of TEMPLATE_VARIABLES) out[v.key] = v.example;
  return out;
}

export function findVariable(key: string): TemplateVariable | undefined {
  return TEMPLATE_VARIABLES.find((v) => v.key === key);
}
