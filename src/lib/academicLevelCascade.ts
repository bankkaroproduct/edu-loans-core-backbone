/**
 * Single source of truth for the Highest-Qualification → academic-level
 * cascade. Used by:
 *   - Partner/Admin AddLead form (src/pages/AddLead.tsx)
 *   - Student Education form (src/pages/student/StudentEducationDetails.tsx)
 *   - Student submit payload (src/hooks/useStudentApplication.ts)
 *   - Review & Submit screens on all three portals
 *
 * Rules (approved):
 *   - (none / unknown / "Other"): all enabled (conservative fallback)
 *   - "12th / High School": 10th + 12th enabled. Graduation + HighestQual
 *     disabled. HighestQual mirrors 12th.
 *   - "Diploma":      10th + 12th + Graduation enabled. HighestQual disabled,
 *                     mirrors Graduation.
 *   - "Bachelor's Degree": same as Diploma.
 *   - "Master's Degree" / "PhD / Doctorate": all enabled (HighestQual is the
 *     master's/PhD score input itself — no mirroring).
 */

export type AcademicLevel = "tenth" | "twelfth" | "graduation" | "highest_qualification";

export interface EnabledLevels {
  tenth: boolean;
  twelfth: boolean;
  graduation: boolean;
  highest_qualification: boolean;
}

export interface MirrorSourceScores {
  tenth?: string;
  tenth_total?: string;
  twelfth?: string;
  twelfth_total?: string;
  graduation?: string;
  graduation_total?: string;
}

export function getEnabledLevels(highestQual: string | null | undefined): EnabledLevels {
  switch ((highestQual ?? "").trim()) {
    case "":
      return { tenth: true, twelfth: true, graduation: true, highest_qualification: true };
    case "12th / High School":
      return { tenth: true, twelfth: true, graduation: false, highest_qualification: false };
    case "Diploma":
    case "Bachelor's Degree":
      return { tenth: true, twelfth: true, graduation: true, highest_qualification: false };
    case "Master's Degree":
    case "PhD / Doctorate":
      return { tenth: true, twelfth: true, graduation: true, highest_qualification: true };
    default:
      // "Other" or any future admin-added option — leave everything editable.
      return { tenth: true, twelfth: true, graduation: true, highest_qualification: true };
  }
}

/**
 * Returns the score+total that should mirror into highest_qualification_*
 * when the HighestQual pair is disabled. Returns empty strings when no
 * mirroring applies (Master's/PhD/Other) or when the source is blank.
 */
export function getMirroredHighestQual(
  highestQual: string | null | undefined,
  scores: MirrorSourceScores,
): { score: string; total: string } {
  switch ((highestQual ?? "").trim()) {
    case "12th / High School":
      return { score: scores.twelfth ?? "", total: scores.twelfth_total ?? "" };
    case "Diploma":
    case "Bachelor's Degree":
      return { score: scores.graduation ?? "", total: scores.graduation_total ?? "" };
    default:
      return { score: "", total: "" };
  }
}
