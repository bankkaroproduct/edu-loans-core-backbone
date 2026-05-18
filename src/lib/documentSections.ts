/**
 * Frontend-only grouping for the Document Readiness UI.
 *
 * Maps `document_master.document_code` → one of 7 spec-defined sections.
 * Backing data (required flags, sort_order, statuses, upload pipeline) is
 * untouched. Grouping is presentation only and shared between the Admin
 * review panel and the Partner checklist so both portals render identically.
 */
import type { LeadDocRequirement, LeadDocFile } from "@/hooks/useLeadDocumentsData";
import type { EffectiveDocStatus } from "@/lib/leadDocumentViewModel";

export type SectionId =
  | "student_identity"
  | "education"
  | "admission"
  | "test_scores"
  | "coapplicant_identity"
  | "coapplicant_financial"
  | "collateral";

export interface DocSection {
  id: SectionId;
  title: string;
  purpose: string;
  /** Document codes in the display order required by spec. */
  codes: string[];
  /** When true, the section is entirely optional/conditional — show "Optional" tag instead of "0 of 0". */
  optionalSection?: boolean;
}

export const DOCUMENT_SECTIONS: DocSection[] = [
  {
    id: "student_identity",
    title: "Student Profile / Identity Documents",
    purpose: "Proves who the student is.",
    codes: ["CANDIDATE_PHOTO", "PAN", "AADHAAR", "PASSPORT"],
  },
  {
    id: "education",
    title: "Education & Academic History",
    purpose: "Proves academic background.",
    codes: ["MARK_10", "MARK_12", "GRAD_MARK", "GRAD_DEGREE", "PG_MARK", "PG_DEGREE"],
  },
  {
    id: "admission",
    title: "Admission & Study Intent",
    purpose: "Proves admission / real study plan.",
    codes: ["ADMIT_LETTER", "I20_CAS"],
  },
  {
    id: "test_scores",
    title: "Test Scores",
    purpose: "Shows entrance / language test proof where available.",
    codes: ["IELTS_TOEFL", "GRE_SCORE"],
    optionalSection: true,
  },
  {
    id: "coapplicant_identity",
    title: "Co-applicant Profile / Identity Documents",
    purpose: "Proves who the co-applicant is.",
    codes: ["COAPP_PHOTO", "COAPP_PAN", "COAPP_AADHAAR"],
  },
  {
    id: "coapplicant_financial",
    title: "Co-applicant Financial Documents",
    purpose: "Proves repayment capacity.",
    codes: ["SALARY_SLIP", "ITR", "BANK_STMT"],
  },
  {
    id: "collateral",
    title: "Collateral / Secured Loan Documents",
    purpose: "Used only when secured/collateral route applies.",
    codes: ["PROPERTY_DOC"],
    optionalSection: true,
  },
];

const CODE_TO_SECTION: Record<string, SectionId> = (() => {
  const m: Record<string, SectionId> = {};
  for (const s of DOCUMENT_SECTIONS) for (const c of s.codes) m[c] = s.id;
  return m;
})();

export interface GroupedSection {
  section: DocSection;
  rows: LeadDocRequirement[];
}

/**
 * Bucket requirements into the 7 sections by document_code, preserving
 * the spec-defined order within each section. Requirements with an
 * unknown code fall into an "Other" group so nothing silently disappears.
 */
export function groupRequirementsBySection(
  requirements: LeadDocRequirement[],
): GroupedSection[] {
  const byId = new Map<SectionId, LeadDocRequirement[]>();
  const unknown: LeadDocRequirement[] = [];

  for (const r of requirements) {
    const code = r.document_master?.document_code ?? "";
    const sid = CODE_TO_SECTION[code];
    if (!sid) {
      unknown.push(r);
      continue;
    }
    const arr = byId.get(sid) ?? [];
    arr.push(r);
    byId.set(sid, arr);
  }

  const out: GroupedSection[] = [];
  for (const section of DOCUMENT_SECTIONS) {
    const rows = byId.get(section.id) ?? [];
    if (rows.length === 0) continue;
    // Order rows by their position in section.codes
    const order = new Map(section.codes.map((c, i) => [c, i]));
    rows.sort((a, b) => {
      const ai = order.get(a.document_master?.document_code ?? "") ?? 9999;
      const bi = order.get(b.document_master?.document_code ?? "") ?? 9999;
      return ai - bi;
    });
    out.push({ section, rows });
  }
  if (unknown.length > 0) {
    out.push({
      section: {
        id: "student_identity", // placeholder type — not used for routing
        title: "Other Documents",
        purpose: "Documents not yet categorized.",
        codes: [],
      } as DocSection,
      rows: unknown,
    });
  }
  return out;
}

export type SectionStatus = "complete" | "rejected" | "under_review" | "pending" | "optional";

export interface SectionStatusInfo {
  status: SectionStatus;
  requiredTotal: number;
  requiredVerified: number;
  /** True when this section is conditional/optional and contains no required docs for this lead. */
  isOptionalOnly: boolean;
}

const BLOCKER_STATUSES: EffectiveDocStatus[] = ["rejected", "reupload_needed"];
const IN_FLIGHT_STATUSES: EffectiveDocStatus[] = ["uploaded", "under_review"];

/**
 * Derive a section's readiness state from its rows + latest-file map.
 *
 * - Effective status per row is the latest file's verification_status when
 *   present, else the requirement.status — same rule used elsewhere.
 * - Required-only denominator: optional rows never reduce the count.
 * - "Optional only" sections (zero required rows) get a dedicated state so
 *   the UI can show an "Optional" tag instead of "0 of 0".
 */
export function computeSectionStatus(
  rows: LeadDocRequirement[],
  latestByType: Map<string, LeadDocFile | null | undefined>,
): SectionStatusInfo {
  let requiredTotal = 0;
  let requiredVerified = 0;
  let anyBlocker = false;
  let anyInFlight = false;

  for (const r of rows) {
    const latest = latestByType.get(r.document_type_id) ?? null;
    const eff = (latest?.verification_status ?? r.status) as EffectiveDocStatus;

    if (BLOCKER_STATUSES.includes(eff)) anyBlocker = true;
    else if (IN_FLIGHT_STATUSES.includes(eff)) anyInFlight = true;

    if (r.required_flag && eff !== "waived" && eff !== "not_applicable") {
      requiredTotal += 1;
      if (eff === "verified") requiredVerified += 1;
    }
  }

  const isOptionalOnly = requiredTotal === 0;

  let status: SectionStatus;
  if (anyBlocker) status = "rejected";
  else if (isOptionalOnly) status = "optional";
  else if (requiredVerified === requiredTotal) status = "complete";
  else if (anyInFlight) status = "under_review";
  else status = "pending";

  return { status, requiredTotal, requiredVerified, isOptionalOnly };
}

export const SECTION_STATUS_LABEL: Record<SectionStatus, string> = {
  complete: "Complete",
  rejected: "Action Required",
  under_review: "Under Review",
  pending: "Pending",
  optional: "Optional",
};

export const SECTION_STATUS_VARIANT: Record<
  SectionStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  complete: "default",
  rejected: "destructive",
  under_review: "secondary",
  pending: "outline",
  optional: "outline",
};

/** Smart-open rule: open everything that needs attention; collapse complete/optional. */
export function shouldDefaultOpen(status: SectionStatus): boolean {
  return status === "rejected" || status === "pending" || status === "under_review";
}
