/**
 * Canonical catalog of variables supported by the communication template engine.
 *
 * Keep aligned with `leadToVariables()` in `render.ts` and the variables
 * accepted by the `send-communication` edge function. The `example` value is
 * used to pre-fill the live preview in the template editor so admins
 * immediately see realistic output.
 */
export interface TemplateVariable {
  key: string;
  label: string;
  example: string;
  description?: string;
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  { key: "student_name", label: "Student name", example: "Aarav Sharma" },
  { key: "lead_id", label: "Lead ID", example: "EL-PL-000123" },
  { key: "application_status", label: "Application status", example: "documents pending" },
  { key: "dashboard_link", label: "Dashboard link", example: "https://app.eduloans.com/leads" },
  { key: "advisor_name", label: "Advisor name", example: "Your EduLoans Advisor" },
  { key: "pending_document_name", label: "Pending document", example: "Passport" },
  { key: "lender_name", label: "Lender name", example: "HDFC Credila" },
  { key: "partner_name", label: "Partner name", example: "Acme Education" },
  { key: "timestamp", label: "Timestamp", example: new Date().toLocaleString() },
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
