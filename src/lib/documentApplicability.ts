/**
 * Smart academic document applicability — display/readiness only.
 *
 * Decides whether an academic document row should be shown in the checklist
 * based on the lead's `highest_qualification`. Non-academic docs are always
 * applicable. Unknown qualification → all applicable (safe fallback).
 *
 * No backend, schema, RLS, or status logic is touched.
 */
import type { LeadDocRequirement } from "@/hooks/useLeadDocumentsData";

export type AcademicLevel =
  | "tenth"
  | "twelfth"
  | "diploma"
  | "graduation"
  | "post_graduation"
  | "unknown";

export type AcademicDocKey =
  | "MARK_10"
  | "MARK_12"
  | "GRAD_MARK"
  | "GRAD_DEGREE"
  | "PG_MARK"
  | "PG_DEGREE";

/**
 * Normalize the `highest_qualification` text to an academic level.
 * Conservative: anything unrecognised → "unknown" (preserves current UI).
 */
export function normalizeQualificationLevel(value: string | null | undefined): AcademicLevel {
  if (!value) return "unknown";
  const v = value.trim().toLowerCase();
  if (!v) return "unknown";

  // PG / Masters / Doctorate (check first — "master" beats "bachelor of master…")
  if (
    /\b(phd|ph\.d|doctor|doctorate|post[\s-]?grad|postgrad|pg\b|master|m\.?tech|m\.?sc|m\.?a\b|m\.?com|mba|mca|mphil)\b/.test(
      v,
    )
  ) {
    return "post_graduation";
  }

  // Graduation / Bachelor / UG
  if (
    /\b(graduat|bachelor|undergrad|under[\s-]?grad|\bug\b|b\.?tech|b\.?sc|b\.?a\b|b\.?com|b\.?e\b|bba|bca)\b/.test(
      v,
    )
  ) {
    return "graduation";
  }

  // Diploma (treated conservatively — like 12th for academic doc applicability)
  if (/\bdiploma\b/.test(v)) return "diploma";

  // 12th / Senior Secondary / Higher Secondary
  if (/(12th|xii|senior secondary|higher secondary|intermediate|hsc|puc|pre[\s-]?univ)/.test(v)) {
    return "twelfth";
  }

  // 10th / SSC / Secondary / High School
  if (/(10th|\bx\b|ssc|secondary|high school|matric)/.test(v)) {
    return "tenth";
  }

  return "unknown";
}

/** Light normalization for name-based matching. */
function normName(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Identify which academic-doc bucket (if any) a requirement belongs to.
 * Tries document_code first, then display_name / document_name with fuzzy
 * keyword matching so the logic still works if codes drift.
 *
 * Returns null for non-academic documents (always applicable).
 */
export function classifyAcademicDoc(
  req: LeadDocRequirement,
): AcademicDocKey | null {
  const code = (req.document_master?.document_code ?? "").toUpperCase().trim();

  // 1) document_code exact match (canonical)
  switch (code) {
    case "MARK_10":
      return "MARK_10";
    case "MARK_12":
      return "MARK_12";
    case "GRAD_MARK":
      return "GRAD_MARK";
    case "GRAD_DEGREE":
      return "GRAD_DEGREE";
    case "PG_MARK":
      return "PG_MARK";
    case "PG_DEGREE":
      return "PG_DEGREE";
  }

  // 2) Fallback to name-based matching
  const name = `${normName(req.document_master?.display_name)} ${normName(
    req.document_master?.document_name,
  )}`.trim();
  if (!name) return null;

  const hasPG = /\b(post graduation|post graduate|postgrad|pg)\b/.test(name);
  const hasGrad = /\b(graduation|graduate|undergraduate|bachelor)\b/.test(name);
  const has10 = /\b(10th|tenth|class 10|x marksheet|ssc|secondary)\b/.test(name);
  const has12 = /\b(12th|twelfth|class 12|xii|higher secondary|senior secondary|intermediate|hsc|puc)\b/.test(
    name,
  );
  const isMarksheet = /(marksheet|mark sheet|transcript|marks)/.test(name);
  const isDegree = /(degree|certificate|provisional|convocation)/.test(name);

  if (hasPG && isMarksheet) return "PG_MARK";
  if (hasPG && isDegree) return "PG_DEGREE";
  if (hasGrad && isMarksheet) return "GRAD_MARK";
  if (hasGrad && isDegree) return "GRAD_DEGREE";
  if (has12 && isMarksheet) return "MARK_12";
  if (has10 && isMarksheet) return "MARK_10";

  return null;
}

/**
 * Applicability per academic level. Diploma is treated conservatively —
 * same as 12th (we don't currently have separate Diploma doc types).
 *
 * `unknown` → all true (preserves current checklist behavior when the
 * qualification is missing or unmapped).
 */
const APPLICABILITY: Record<AcademicLevel, Record<AcademicDocKey, boolean>> = {
  tenth: {
    MARK_10: true,
    MARK_12: false,
    GRAD_MARK: false,
    GRAD_DEGREE: false,
    PG_MARK: false,
    PG_DEGREE: false,
  },
  twelfth: {
    MARK_10: true,
    MARK_12: true,
    GRAD_MARK: false,
    GRAD_DEGREE: false,
    PG_MARK: false,
    PG_DEGREE: false,
  },
  // Diploma: same as 12th (no Diploma doc type exists yet — do NOT show grad/PG).
  diploma: {
    MARK_10: true,
    MARK_12: true,
    GRAD_MARK: false,
    GRAD_DEGREE: false,
    PG_MARK: false,
    PG_DEGREE: false,
  },
  graduation: {
    MARK_10: true,
    MARK_12: true,
    GRAD_MARK: true,
    GRAD_DEGREE: true,
    PG_MARK: false,
    PG_DEGREE: false,
  },
  post_graduation: {
    MARK_10: true,
    MARK_12: true,
    GRAD_MARK: true,
    GRAD_DEGREE: true,
    PG_MARK: true,
    PG_DEGREE: true,
  },
  unknown: {
    MARK_10: true,
    MARK_12: true,
    GRAD_MARK: true,
    GRAD_DEGREE: true,
    PG_MARK: true,
    PG_DEGREE: true,
  },
};

export function isRequirementApplicable(
  req: LeadDocRequirement,
  qualification: string | null | undefined,
): boolean {
  const key = classifyAcademicDoc(req);
  if (!key) return true; // non-academic — always applicable
  const level = normalizeQualificationLevel(qualification);
  return APPLICABILITY[level][key];
}

export interface PartitionedRequirements {
  applicable: LeadDocRequirement[];
  notApplicable: LeadDocRequirement[];
  level: AcademicLevel;
}

export function partitionRequirementsByApplicability(
  requirements: LeadDocRequirement[],
  qualification: string | null | undefined,
): PartitionedRequirements {
  const level = normalizeQualificationLevel(qualification);
  const applicable: LeadDocRequirement[] = [];
  const notApplicable: LeadDocRequirement[] = [];
  for (const r of requirements) {
    if (isRequirementApplicable(r, qualification)) applicable.push(r);
    else notApplicable.push(r);
  }
  return { applicable, notApplicable, level };
}
