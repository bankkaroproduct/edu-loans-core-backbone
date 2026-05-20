/**
 * Smart document applicability — display/readiness only.
 *
 * Decides whether a document row should be shown in the checklist based on
 * lead context:
 *   - highest_qualification (academic docs)
 *   - intended_study_country (I-20 / CAS / CoE row)
 *   - collateral_available (property documents)
 *   - coapplicant_employment_type (salary slips)
 *
 * Non-applicable rows are either:
 *   - bucketed into a `notApplicableGroups` map by reason, so consumers can
 *     render the existing dashed "Not Applicable" accordion per reason; or
 *   - silently suppressed (country-specific admission docs for destinations
 *     that don't use I-20/CAS/CoE — Canada, Germany, etc.)
 *
 * No backend, schema, RLS, or status logic is touched.
 */
import type { LeadDocRequirement } from "@/hooks/useLeadDocumentsData";
import { normalizeCountry } from "@/lib/countryAliases";

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

/** Reasons a row may be moved into the "Not Applicable" buckets. */
export type NotApplicableReason = "qualification" | "collateral" | "employment";

/** Lead context fed into the applicability engine. All fields optional/nullable. */
export interface LeadApplicabilityContext {
  highest_qualification?: string | null;
  intended_study_country?: string | null;
  collateral_available?: boolean | null;
  coapplicant_employment_type?: string | null;
}

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
 * Returns null for non-academic documents.
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

export type ConditionalDocKey = "I20_CAS" | "PROPERTY_DOC" | "SALARY_SLIP";

/**
 * Classify a requirement as one of the conditional non-academic docs.
 * Code-first, then a forgiving name fallback.
 */
export function classifyConditionalDoc(req: LeadDocRequirement): ConditionalDocKey | null {
  const code = (req.document_master?.document_code ?? "").toUpperCase().trim();
  if (code === "I20_CAS") return "I20_CAS";
  if (code === "PROPERTY_DOC") return "PROPERTY_DOC";
  if (code === "SALARY_SLIP") return "SALARY_SLIP";

  const name = `${normName(req.document_master?.display_name)} ${normName(
    req.document_master?.document_name,
  )}`.trim();
  if (!name) return null;
  if (/\b(i\s*20|i20|cas|coe|confirmation of enrolment|confirmation of enrollment)\b/.test(name)) {
    return "I20_CAS";
  }
  if (/\b(property|collateral)\b/.test(name)) return "PROPERTY_DOC";
  if (/\b(salary slip|salary slips|payslip|payslips|pay slip|pay slips)\b/.test(name)) {
    return "SALARY_SLIP";
  }
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

/** Internal: only explicitly non-salaried employment types suppress Salary Slip. */
function isExplicitlyNonSalaried(value: string | null | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  if (!v) return false;
  if (/\b(self[\s-]?employed|self employment|self-employment)\b/.test(v)) return true;
  if (/\b(business\s*owner|businessman|business person|entrepreneur|proprietor)\b/.test(v)) return true;
  if (/\b(retired|retiree|pensioner)\b/.test(v)) return true;
  return false;
}

export type ApplicabilityDecision =
  | { applicable: true }
  | { applicable: false; reason: NotApplicableReason }
  | { applicable: false; reason: "country"; silent: true };

/**
 * Decide applicability for a single requirement under the given lead context.
 * Returns either applicable=true, or applicable=false with the reason it was
 * hidden. Country-mismatched admission docs return `silent: true` so callers
 * suppress them from UI entirely (no hidden accordion).
 */
export function decideApplicability(
  req: LeadDocRequirement,
  ctx: LeadApplicabilityContext,
): ApplicabilityDecision {
  // Academic
  const academic = classifyAcademicDoc(req);
  if (academic) {
    const level = normalizeQualificationLevel(ctx.highest_qualification);
    return APPLICABILITY[level][academic]
      ? { applicable: true }
      : { applicable: false, reason: "qualification" };
  }

  // Conditional non-academic
  const conditional = classifyConditionalDoc(req);
  if (conditional === "I20_CAS") {
    const c = normalizeCountry(ctx.intended_study_country);
    if (c === "united_states" || c === "united_kingdom" || c === "australia") {
      return { applicable: true };
    }
    // Silent suppression for other / unknown destinations.
    return { applicable: false, reason: "country", silent: true };
  }
  if (conditional === "PROPERTY_DOC") {
    if (ctx.collateral_available === true) return { applicable: true };
    if (ctx.collateral_available === false) {
      return { applicable: false, reason: "collateral" };
    }
    // null/undefined collateral → keep visible (conservative — same spirit as
    // unknown qualification not hiding academic docs).
    return { applicable: true };
  }
  if (conditional === "SALARY_SLIP") {
    if (isExplicitlyNonSalaried(ctx.coapplicant_employment_type)) {
      return { applicable: false, reason: "employment" };
    }
    return { applicable: true };
  }

  return { applicable: true };
}

/** Backwards-compatible helper used by older call sites. */
export function isRequirementApplicable(
  req: LeadDocRequirement,
  qualification: string | null | undefined,
): boolean {
  const key = classifyAcademicDoc(req);
  if (!key) return true; // non-academic — always applicable via this legacy API
  const level = normalizeQualificationLevel(qualification);
  return APPLICABILITY[level][key];
}

export interface PartitionedRequirements {
  applicable: LeadDocRequirement[];
  notApplicable: LeadDocRequirement[];
  level: AcademicLevel;
}

/** Legacy — qualification-only partition. Kept for back-compat. */
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

export interface PartitionedWithReasons {
  applicable: LeadDocRequirement[];
  /** Buckets per reason — only populated when at least one row is hidden for that reason. */
  notApplicableGroups: Partial<Record<NotApplicableReason, LeadDocRequirement[]>>;
  level: AcademicLevel;
}

/**
 * Partition requirements using the full lead context. Rows that are silently
 * suppressed (e.g. I-20 for a Canada lead) appear in neither bucket.
 */
export function partitionRequirementsWithReasons(
  requirements: LeadDocRequirement[],
  ctx: LeadApplicabilityContext,
): PartitionedWithReasons {
  const level = normalizeQualificationLevel(ctx.highest_qualification);
  const applicable: LeadDocRequirement[] = [];
  const groups: Partial<Record<NotApplicableReason, LeadDocRequirement[]>> = {};

  for (const r of requirements) {
    const decision = decideApplicability(r, ctx);
    if (decision.applicable) {
      applicable.push(r);
      continue;
    }
    if (decision.reason === "country") continue; // silently suppressed
    (groups[decision.reason] ??= []).push(r);
  }

  return { applicable, notApplicableGroups: groups, level };
}

/** Stable display order for the 3 reason accordions. */
export const NOT_APPLICABLE_REASON_ORDER: NotApplicableReason[] = [
  "qualification",
  "collateral",
  "employment",
];

export const NOT_APPLICABLE_REASON_LABEL: Record<NotApplicableReason, string> = {
  qualification: "Not Applicable based on highest qualification",
  collateral: "Not Applicable based on collateral information provided",
  employment: "Not Applicable based on employment type",
};
