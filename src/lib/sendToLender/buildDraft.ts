/**
 * Pure helpers that turn a Lead + Lender into the prefilled compose draft
 * (subject, body variables, default attachment selection).
 *
 * No side effects, no Supabase calls — easy to unit-test and safe to use
 * from the new Send-to-Lender page without touching any other flow.
 */
import type { Tables } from "@/integrations/supabase/types";

export type LeadRow = Tables<"student_leads">;
export type LenderRow = Tables<"lenders">;
export type LeadDocFile = Tables<"lead_documents"> & {
  document_master?: { document_name: string } | null;
};

const fmtINR = (n: number | null | undefined): string => {
  if (n === null || n === undefined || isNaN(Number(n))) return "—";
  try {
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(n));
  } catch {
    return String(n);
  }
};

const safe = (v: string | number | null | undefined): string => {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  return s.length === 0 ? "—" : s;
};

export interface DraftVars {
  // Lender
  lender_name: string;
  // Applicant
  student_name: string;
  lead_id: string;
  student_phone: string;
  student_email: string;
  // Study
  study_country: string;
  university_name: string;
  course_name: string;
  course_category: string;
  intake_term: string;
  intake_year: string;
  // Loan
  loan_amount: string;
  collateral_summary: string;
  // Co-applicant
  coapplicant_name: string;
  coapplicant_relation: string;
  coapplicant_income: string;
  coapplicant_employment_type: string;
  // Academics
  highest_qualification: string;
  marks_gpa: string;
  // Sender
  advisor_name: string;
}

export function buildDraftVariables(
  lead: LeadRow,
  lender: Pick<LenderRow, "lender_name"> | null,
  advisorName: string,
): DraftVars {
  const studentName =
    lead.student_full_name ||
    [lead.student_first_name, lead.student_last_name].filter(Boolean).join(" ").trim() ||
    "Applicant";

  return {
    lender_name: lender?.lender_name ?? "Lender",
    student_name: studentName,
    lead_id: safe(lead.lead_id),
    student_phone: safe(lead.student_phone),
    student_email: safe(lead.student_email),
    study_country: safe(lead.intended_study_country),
    university_name: safe(lead.university_name_raw),
    course_name: safe(lead.course_name),
    course_category: safe(lead.course_category),
    intake_term: safe(lead.intake_term),
    intake_year: safe(lead.intake_year),
    loan_amount: fmtINR(lead.loan_amount_required as unknown as number),
    collateral_summary:
      lead.collateral_available
        ? `Yes${lead.collateral_notes ? ` — ${lead.collateral_notes}` : ""}`
        : "No",
    coapplicant_name: safe(lead.coapplicant_name),
    coapplicant_relation: safe(lead.coapplicant_relation),
    coapplicant_income: fmtINR(lead.coapplicant_income as unknown as number),
    coapplicant_employment_type: safe(lead.coapplicant_employment_type),
    highest_qualification: safe(lead.highest_qualification),
    marks_gpa: safe(lead.marks_gpa),
    advisor_name: advisorName || "Your EduLoans Advisor",
  };
}

export function defaultSubject(vars: DraftVars): string {
  return `EduLoans Application Submission – ${vars.student_name} – ${vars.lead_id}`;
}

export function defaultBody(vars: DraftVars): string {
  return [
    `Hello ${vars.lender_name} Team,`,
    ``,
    `Please find below the application details for our applicant. Supporting documents are attached.`,
    ``,
    `— Applicant —`,
    `Name: ${vars.student_name}`,
    `Lead ID: ${vars.lead_id}`,
    `Phone: ${vars.student_phone}`,
    `Email: ${vars.student_email}`,
    ``,
    `— Study Plan —`,
    `Country: ${vars.study_country}`,
    `University: ${vars.university_name}`,
    `Course: ${vars.course_name} (${vars.course_category})`,
    `Intake: ${vars.intake_term} ${vars.intake_year}`,
    ``,
    `— Loan —`,
    `Amount Required: INR ${vars.loan_amount}`,
    `Collateral: ${vars.collateral_summary}`,
    ``,
    `— Co-applicant —`,
    `Name: ${vars.coapplicant_name} (${vars.coapplicant_relation})`,
    `Income: INR ${vars.coapplicant_income}`,
    `Employment: ${vars.coapplicant_employment_type}`,
    ``,
    `— Academics —`,
    `Highest Qualification: ${vars.highest_qualification}`,
    `Marks/GPA: ${vars.marks_gpa}`,
    ``,
    `Please review and revert with sanction terms.`,
    ``,
    `Regards,`,
    `${vars.advisor_name}`,
    `EduLoans (CashKaro)`,
  ].join("\n");
}

/**
 * Defaults attachments to: latest version of each document type that is
 * verified or uploaded (not rejected/needs-reupload). Admin can toggle.
 */
export function defaultSelectedAttachmentIds(docs: LeadDocFile[]): string[] {
  return docs
    .filter((d) => d.is_latest)
    .filter(
      (d) =>
        d.verification_status === "verified" ||
        d.verification_status === "uploaded",
    )
    .map((d) => d.id);
}

/** Simple list of comma/semicolon-separated emails → string[] */
export function parseEmailList(input: string): string[] {
  return input
    .split(/[,;\n]/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(e: string): boolean {
  return EMAIL_RE.test(e.trim());
}
