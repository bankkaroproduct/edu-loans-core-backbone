/**
 * Single source-of-truth derivation for the admin document UI.
 *
 * Both the embedded "Document Review" section in Admin Lead Detail and the
 * full /admin/leads/:id/documents page render through this view-model so that
 * the same lead always shows the same requirement count, the same per-row
 * status meaning, the same upload/reupload affordance, and the same empty
 * state across both surfaces.
 *
 * No upload, OCR, validation, versioning, audit, communications, or BRE
 * logic is changed here — this file is presentation-only.
 */
import type { LeadDocFile, LeadDocRequirement } from "@/hooks/useLeadDocumentsData";

export type EffectiveDocStatus =
  | "verified"
  | "uploaded"
  | "under_review"
  | "rejected"
  | "reupload_needed"
  | "not_uploaded"
  | "waived"
  | "not_applicable";

export interface AdminDocRowVM {
  requirement: LeadDocRequirement;
  latest: LeadDocFile | null;
  versionCount: number;
  /** Latest file's verification status when a file exists, else the requirement status. */
  effectiveStatus: EffectiveDocStatus;
  /** True when admin can upload-on-behalf or reupload from this row. */
  isActionable: boolean;
  /** True when the action is a reupload (vs a first upload). */
  isReupload: boolean;
}

export interface AdminDocCounts {
  total: number;
  not_uploaded: number;
  uploaded: number;
  under_review: number;
  verified: number;
  rejected: number;
  reupload_needed: number;
  waived: number;
  /** Required, non-waived rows. */
  requiredTotal: number;
  /** Required, non-waived rows whose effective status is "verified". */
  requiredVerified: number;
}

export interface AdminDocViewModel {
  rows: AdminDocRowVM[];
  counts: AdminDocCounts;
  hasRequirements: boolean;
}

const ACTIONABLE_STATUSES: EffectiveDocStatus[] = [
  "not_uploaded",
  "rejected",
  "reupload_needed",
];

const WAIVED_STATUSES: EffectiveDocStatus[] = ["waived", "not_applicable"];

export function buildAdminDocViewModel(
  requirements: LeadDocRequirement[],
  documents: LeadDocFile[],
): AdminDocViewModel {
  // Group documents by document_type_id to find latest + version count
  const byType = new Map<string, { latest: LeadDocFile | null; count: number }>();
  for (const d of documents ?? []) {
    if (!d.document_type_id) continue;
    const slot = byType.get(d.document_type_id) ?? { latest: null, count: 0 };
    slot.count += 1;
    if (d.is_latest) slot.latest = d;
    byType.set(d.document_type_id, slot);
  }

  const rows: AdminDocRowVM[] = (requirements ?? []).map((req) => {
    const slot = byType.get(req.document_type_id) ?? { latest: null, count: 0 };
    const effectiveStatus = (slot.latest?.verification_status ?? req.status) as EffectiveDocStatus;
    const isActionable = ACTIONABLE_STATUSES.includes(effectiveStatus);
    const isReupload = effectiveStatus === "rejected" || effectiveStatus === "reupload_needed";
    return {
      requirement: req,
      latest: slot.latest,
      versionCount: slot.count,
      effectiveStatus,
      isActionable,
      isReupload,
    };
  });

  const counts: AdminDocCounts = {
    total: rows.length,
    not_uploaded: 0,
    uploaded: 0,
    under_review: 0,
    verified: 0,
    rejected: 0,
    reupload_needed: 0,
    waived: 0,
    requiredTotal: 0,
    requiredVerified: 0,
  };

  for (const row of rows) {
    const s = row.effectiveStatus;
    if (s === "waived" || s === "not_applicable") counts.waived += 1;
    else if (s in counts) (counts as unknown as Record<string, number>)[s] += 1;

    if (row.requirement.required_flag && !WAIVED_STATUSES.includes(s)) {
      counts.requiredTotal += 1;
      if (s === "verified") counts.requiredVerified += 1;
    }
  }

  return {
    rows,
    counts,
    hasRequirements: rows.length > 0,
  };
}

export const STATUS_LABEL: Record<EffectiveDocStatus, string> = {
  verified: "Verified",
  uploaded: "Uploaded",
  under_review: "Under Review",
  rejected: "Rejected",
  reupload_needed: "Reupload Needed",
  not_uploaded: "Not Uploaded",
  waived: "Waived",
  not_applicable: "N/A",
};

export const STATUS_BADGE_VARIANT: Record<
  EffectiveDocStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  verified: "default",
  uploaded: "secondary",
  under_review: "secondary",
  rejected: "destructive",
  reupload_needed: "destructive",
  not_uploaded: "outline",
  waived: "outline",
  not_applicable: "outline",
};
