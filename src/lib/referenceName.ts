// Single source of truth for the "expected name on document" reference.
// Used by upload dialogs and any UI that needs to show what the validator
// will compare an uploaded document's extracted name against.

export type NameSubject = "student" | "coapplicant";

export interface LeadNameFields {
  student_full_name?: string | null;
  student_first_name?: string | null;
  student_last_name?: string | null;
  coapplicant_name?: string | null;
}

export function getReferenceName(
  lead: LeadNameFields | null | undefined,
  subject: NameSubject,
): string | null {
  if (!lead) return null;
  if (subject === "coapplicant") {
    const n = (lead.coapplicant_name ?? "").trim();
    return n.length > 0 ? n : null;
  }
  // student: prefer full_name, fallback to first + last
  const full = (lead.student_full_name ?? "").trim();
  if (full.length > 0) return full;
  const composed = `${lead.student_first_name ?? ""} ${lead.student_last_name ?? ""}`.trim();
  return composed.length > 0 ? composed : null;
}

// Map a document's `applicable_for` field (from document_master) to the subject
// whose name should be matched. Defaults to "student" when ambiguous.
export function subjectForApplicableFor(applicableFor: string | null | undefined): NameSubject {
  return applicableFor === "coapplicant" ? "coapplicant" : "student";
}
