/**
 * Single source of truth for the "Highest Qualification" allowed values.
 *
 * Used by:
 *  - Bulk upload validator (src/hooks/useBulkUploadProcessor.ts)
 *  - Bulk upload visible reference (src/pages/BulkUpload.tsx)
 *  - Manual lead creation (src/pages/AddLead.tsx)
 *  - Student portal education form (src/pages/student/StudentEducationDetails.tsx)
 *
 * Keep this list in sync with whatever the BRE / scoring engine expects.
 */
export const HIGHEST_QUALIFICATION_OPTIONS = [
  "12th / High School",
  "Diploma",
  "Bachelor's Degree",
  "Master's Degree",
  "PhD / Doctorate",
  "Other",
] as const;

export type HighestQualification = (typeof HIGHEST_QUALIFICATION_OPTIONS)[number];

/**
 * Case-insensitive match. Returns the canonical (correctly-cased) value when it
 * matches one of the allowed options, otherwise undefined.
 *
 * Used by the bulk upload validator so partners can type "bachelor's degree"
 * or "BACHELOR'S DEGREE" and still get a clean canonical save.
 */
export function matchHighestQualification(input: string): HighestQualification | undefined {
  if (!input) return undefined;
  const target = input.trim().toLowerCase();
  return HIGHEST_QUALIFICATION_OPTIONS.find((q) => q.toLowerCase() === target);
}
