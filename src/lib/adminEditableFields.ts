// Full superset of fields an admin can write through the AddLead form.
// Used to compute audit diffs for direct admin edits — broader than the
// partner edit-request whitelist in editRequestFields.ts.

export interface AdminFieldDef {
  key: string;
  label: string;
}

export const ADMIN_EDITABLE_FIELDS: AdminFieldDef[] = [
  // Profile
  { key: "student_first_name", label: "First name" },
  { key: "student_last_name", label: "Last name" },
  { key: "student_email", label: "Email" },
  { key: "student_phone", label: "Phone" },
  { key: "student_whatsapp", label: "WhatsApp" },
  { key: "student_dob", label: "Date of birth" },
  { key: "student_gender", label: "Gender" },

  // Address
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "country_of_residence", label: "Country of residence" },
  { key: "pincode", label: "Pincode" },

  // Study
  { key: "intended_study_country", label: "Destination country" },
  { key: "intake_term", label: "Intake term" },
  { key: "intake_year", label: "Intake year" },
  { key: "course_name", label: "Course name" },
  { key: "course_category", label: "Course category" },
  { key: "university_id", label: "University (master)" },
  { key: "university_name_raw", label: "University (raw)" },
  { key: "loan_amount_required", label: "Loan amount required" },

  // Academic
  { key: "highest_qualification", label: "Highest qualification" },
  { key: "marks_gpa", label: "Marks / GPA" },

  // Co-applicant
  { key: "coapplicant_name", label: "Co-applicant name" },
  { key: "coapplicant_relation", label: "Co-applicant relation" },
  { key: "coapplicant_mobile", label: "Co-applicant mobile" },
  { key: "coapplicant_email", label: "Co-applicant email" },
  { key: "coapplicant_income", label: "Co-applicant income" },
  { key: "coapplicant_employment_type", label: "Co-applicant employment type" },
  { key: "coapplicant_employer", label: "Co-applicant employer" },
  { key: "coapplicant_existing_emi", label: "Co-applicant existing EMI" },

  // Collateral
  { key: "collateral_available", label: "Collateral available" },
  { key: "collateral_notes", label: "Collateral notes" },

  // Source / attribution (admin can adjust)
  { key: "source_type", label: "Source type" },
  { key: "source_sub_type", label: "Source subtype" },
  { key: "partner_id", label: "Partner" },
  { key: "partner_user_id", label: "Partner user" },
  { key: "assigned_admin_id", label: "Assigned admin" },
];

export const ADMIN_EDITABLE_KEYS = new Set(ADMIN_EDITABLE_FIELDS.map((f) => f.key));

export function getAdminFieldLabel(key: string): string {
  return ADMIN_EDITABLE_FIELDS.find((f) => f.key === key)?.label ?? key;
}

/** Diff helper covering the full admin-editable scope. */
export function computeAdminDiff(
  original: Record<string, unknown>,
  edited: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const f of ADMIN_EDITABLE_FIELDS) {
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
