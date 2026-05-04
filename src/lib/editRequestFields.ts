// Whitelist of fields a partner may request edits for.
// Mirrored server-side in submit_edit_request RPC.

export type EditFieldType = "text" | "textarea" | "number" | "date" | "boolean" | "select";

export interface EditFieldDef {
  key: string;
  label: string;
  group: "Contact" | "Profile" | "Address" | "Study" | "Academic" | "Co-applicant" | "Collateral";
  type: EditFieldType;
  options?: string[];
}

export const EDITABLE_FIELDS: EditFieldDef[] = [
  // Contact
  { key: "student_email", label: "Email", group: "Contact", type: "text" },
  { key: "student_phone", label: "Phone", group: "Contact", type: "text" },
  { key: "student_whatsapp", label: "WhatsApp", group: "Contact", type: "text" },

  // Profile
  { key: "student_first_name", label: "First name", group: "Profile", type: "text" },
  { key: "student_last_name", label: "Last name", group: "Profile", type: "text" },
  // Note: student_full_name is auto-derived from first+last by the database (generated column).
  { key: "student_dob", label: "Date of birth", group: "Profile", type: "date" },
  { key: "student_gender", label: "Gender", group: "Profile", type: "select", options: ["Male", "Female", "Other"] },

  // Address
  { key: "city", label: "City", group: "Address", type: "text" },
  { key: "state", label: "State", group: "Address", type: "text" },
  { key: "country_of_residence", label: "Country of residence", group: "Address", type: "text" },
  { key: "pincode", label: "Pincode", group: "Address", type: "text" },

  // Study
  { key: "intended_study_country", label: "Destination country", group: "Study", type: "text" },
  { key: "intake_term", label: "Intake term", group: "Study", type: "text" },
  { key: "intake_year", label: "Intake year", group: "Study", type: "number" },
  { key: "course_name", label: "Course name", group: "Study", type: "text" },
  { key: "course_category", label: "Course category", group: "Study", type: "text" },
  { key: "university_name_raw", label: "University", group: "Study", type: "text" },
  { key: "loan_amount_required", label: "Loan amount required", group: "Study", type: "number" },

  // Academic
  { key: "highest_qualification", label: "Highest qualification", group: "Academic", type: "text" },
  { key: "marks_gpa", label: "Marks / GPA", group: "Academic", type: "text" },
  // New academic-total denominators (stored on test_scores JSONB) — exposed via
  // InlineEditField using jsonbColumn="test_scores"; whitelisted here so partner
  // edit-requests and audit diffs treat them as known fields.
  { key: "tenth_total", label: "10th Total Marks", group: "Academic", type: "text" },
  { key: "twelfth_total", label: "12th Total Marks", group: "Academic", type: "text" },
  { key: "graduation_total", label: "Graduation Total Marks / CGPA Scale", group: "Academic", type: "text" },
  { key: "highest_qualification_total", label: "Highest Qualification Total Marks / CGPA Scale", group: "Academic", type: "text" },
  // Co-applicant work experience (stored on test_scores JSONB) — feeds BRE
  // coapplicant.income_stability_years.
  { key: "coapplicant_work_experience_years", label: "Co-applicant Work Experience (years)", group: "Co-applicant", type: "number" },
  { key: "coapplicant_work_experience_months", label: "Co-applicant Work Experience (months)", group: "Co-applicant", type: "number" },

  // Co-applicant
  { key: "coapplicant_name", label: "Co-applicant name", group: "Co-applicant", type: "text" },
  { key: "coapplicant_relation", label: "Relation", group: "Co-applicant", type: "text" },
  { key: "coapplicant_mobile", label: "Co-applicant mobile", group: "Co-applicant", type: "text" },
  { key: "coapplicant_email", label: "Co-applicant email", group: "Co-applicant", type: "text" },
  { key: "coapplicant_income", label: "Co-applicant income", group: "Co-applicant", type: "number" },
  { key: "coapplicant_employment_type", label: "Employment type", group: "Co-applicant", type: "text" },
  { key: "coapplicant_employer", label: "Employer", group: "Co-applicant", type: "text" },
  { key: "coapplicant_existing_emi", label: "Existing EMI", group: "Co-applicant", type: "number" },

  // Collateral
  { key: "collateral_available", label: "Collateral available", group: "Collateral", type: "boolean" },
  { key: "collateral_notes", label: "Collateral notes", group: "Collateral", type: "textarea" },
];

export const EDITABLE_KEYS = new Set(EDITABLE_FIELDS.map((f) => f.key));

export function getFieldLabel(key: string): string {
  return EDITABLE_FIELDS.find((f) => f.key === key)?.label ?? key;
}

/** Compute diff between current lead row and form values. Only whitelisted keys. */
export function computeDiff(
  original: Record<string, unknown>,
  edited: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const f of EDITABLE_FIELDS) {
    const a = original[f.key];
    const b = edited[f.key];
    const aNorm = a === undefined || a === "" ? null : a;
    const bNorm = b === undefined || b === "" ? null : b;
    if (JSON.stringify(aNorm) !== JSON.stringify(bNorm)) {
      diff[f.key] = { from: aNorm, to: bNorm };
    }
  }
  return diff;
}

/** Reduce diff to a flat { key: newValue } payload for submit_edit_request. */
export function diffToChanges(
  diff: Record<string, { from: unknown; to: unknown }>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(diff)) out[k] = v.to;
  return out;
}
