/**
 * Shared business-bifurcation filter mapping for student_leads.
 * Single source of truth used by both Admin Lead Queue and Admin Reports.
 *
 * Maps clean UI labels (e.g. "Partner — Referral") to the real underlying
 * source_type / source_sub_type / collateral_available / intended_study_country rules.
 */
import type { Database } from "@/integrations/supabase/types";

export type StageEnum = Database["public"]["Enums"]["lead_stage_enum"];
export type StatusEnum = Database["public"]["Enums"]["lead_status_enum"];

export type SourceFilter =
  | "all"
  // Primary (admin-facing) buckets
  | "partner"
  | "student_direct"
  | "referral"
  // Legacy granular values — still supported for URL hydration & advanced detail
  | "partner_direct"
  | "partner_referral"
  | "student_portal"
  | "university_referral";
export type TypeFilter = "all" | "quick_lead" | "full_lead";
export type EntryModeFilter =
  | "all"
  | "add_lead"
  | "bulk_upload"
  | "quick_lead"
  | "student_portal";
export type RegionFilter = "all" | "domestic" | "international";
export type LoanRangeFilter = "all" | "lt10" | "10to25" | "25to50" | "gt50";
export type IntakeFilter = "all" | "Spring" | "Fall" | "Summer";
export type LoanTypeFilter = "all" | "secured" | "unsecured";

export interface BusinessFilterState {
  source: SourceFilter;
  type: TypeFilter;
  entryMode: EntryModeFilter;
  region: RegionFilter;
  loanRange: LoanRangeFilter;
  intake: IntakeFilter;
  loanType: LoanTypeFilter;
}

export const defaultBusinessFilters: BusinessFilterState = {
  source: "all",
  type: "all",
  entryMode: "all",
  region: "all",
  loanRange: "all",
  intake: "all",
  loanType: "all",
};

/**
 * Apply business-bifurcation filters to a PostgREST query builder for
 * the `student_leads` table. Returns the (mutated) query builder.
 *
 * IMPORTANT: keep this function in lock-step with the Lead Queue UI
 * — it is the only authoritative mapping from business labels to DB fields.
 */
export function applyBusinessFilters<T>(q: T, f: BusinessFilterState): T {
  let qb: any = q;

  // Source — three primary buckets are mutually exclusive in the visible Lead Queue.
  //   Partner        = source_type='partner' AND source_sub_type NOT ILIKE '%refer%'
  //   Student Direct = source_type='student_direct'
  //   Referral       = source_sub_type ILIKE '%refer%' (regardless of source_type)
  // A row that is partner-attributed but tagged as a referral counts ONLY as Referral.
  switch (f.source) {
    // Primary buckets (mutually exclusive)
    case "partner":
      qb = qb
        .eq("source_type", "partner")
        .or("source_sub_type.is.null,source_sub_type.not.ilike.%refer%");
      break;
    case "student_direct":
      qb = qb.eq("source_type", "student_direct");
      break;
    case "referral":
      qb = qb.ilike("source_sub_type", "%refer%");
      break;
    // Legacy granular (URL hydration only — collapsed to primary buckets in UI)
    case "partner_direct":
      qb = qb
        .eq("source_type", "partner")
        .or("source_sub_type.is.null,source_sub_type.not.ilike.%refer%");
      break;
    case "partner_referral":
      qb = qb.eq("source_type", "partner").ilike("source_sub_type", "%refer%");
      break;
    case "student_portal":
      qb = qb.eq("source_type", "student_direct");
      break;
    case "university_referral":
      qb = qb.eq("source_sub_type", "university_referral");
      break;
  }

  // Type
  if (f.type === "quick_lead") {
    qb = qb.eq("source_sub_type", "quick_lead");
  } else if (f.type === "full_lead") {
    qb = qb.or("source_sub_type.is.null,source_sub_type.neq.quick_lead");
  }

  // Entry Mode
  switch (f.entryMode) {
    case "add_lead":
      qb = qb.eq("source_type", "partner").not("source_sub_type", "in", "(quick_lead,bulk_upload)");
      break;
    case "bulk_upload":
      qb = qb.eq("source_sub_type", "bulk_upload");
      break;
    case "quick_lead":
      qb = qb.eq("source_sub_type", "quick_lead");
      break;
    case "student_portal":
      qb = qb.eq("source_type", "student_direct");
      break;
  }

  // Region
  if (f.region === "domestic") {
    qb = qb.eq("intended_study_country", "India");
  } else if (f.region === "international") {
    qb = qb.neq("intended_study_country", "India");
  }

  // Loan Range (₹) — 1L = 100000
  switch (f.loanRange) {
    case "lt10":
      qb = qb.lt("loan_amount_required", 1000000);
      break;
    case "10to25":
      qb = qb.gte("loan_amount_required", 1000000).lt("loan_amount_required", 2500000);
      break;
    case "25to50":
      qb = qb.gte("loan_amount_required", 2500000).lt("loan_amount_required", 5000000);
      break;
    case "gt50":
      qb = qb.gte("loan_amount_required", 5000000);
      break;
  }

  // Intake
  if (f.intake !== "all") qb = qb.eq("intake_term", f.intake);

  // Loan Type
  if (f.loanType === "secured") {
    qb = qb.eq("collateral_available", true);
  } else if (f.loanType === "unsecured") {
    qb = qb.or("collateral_available.is.null,collateral_available.eq.false");
  }

  return qb as T;
}

/** Human-readable labels (for chips, exports, etc.). */
export const SOURCE_LABELS: Record<SourceFilter, string> = {
  all: "All Sources",
  partner: "Partner",
  student_direct: "Student Direct",
  referral: "Referral",
  partner_direct: "Partner - Direct",
  partner_referral: "Partner - Referral",
  student_portal: "Student Portal",
  university_referral: "University Referral",
};
export const TYPE_LABELS: Record<TypeFilter, string> = {
  all: "All Types",
  quick_lead: "Quick Lead",
  full_lead: "Full Lead",
};
export const ENTRY_MODE_LABELS: Record<EntryModeFilter, string> = {
  all: "All Entry Modes",
  add_lead: "Manual Add",
  bulk_upload: "Bulk Upload",
  quick_lead: "Quick Lead",
  student_portal: "Student Portal",
};
export const REGION_LABELS: Record<RegionFilter, string> = {
  all: "All Regions",
  domestic: "Domestic (India)",
  international: "International",
};
export const LOAN_RANGE_LABELS: Record<LoanRangeFilter, string> = {
  all: "Any Loan Amount",
  lt10: "< ₹10L",
  "10to25": "₹10L – ₹25L",
  "25to50": "₹25L – ₹50L",
  gt50: "₹50L+",
};
export const INTAKE_LABELS: Record<IntakeFilter, string> = {
  all: "All Intakes",
  Spring: "Spring",
  Fall: "Fall",
  Summer: "Summer",
};
export const LOAN_TYPE_LABELS: Record<LoanTypeFilter, string> = {
  all: "Any Loan Type",
  secured: "Secured",
  unsecured: "Unsecured",
};

/** Derive the business "Type" label for a single lead row. */
export function deriveTypeLabel(source_sub_type: string | null | undefined): string {
  return source_sub_type === "quick_lead" ? "Quick Lead" : "Full Lead";
}

/** Derive the business "Entry Mode" label for a single lead row. */
export function deriveEntryModeLabel(source_type: string | null | undefined, source_sub_type: string | null | undefined): string {
  if (source_type === "student_direct") return "Student Portal";
  if (source_sub_type === "quick_lead") return "Quick Lead";
  if (source_sub_type === "bulk_upload") return "Bulk Upload";
  return "Add Lead";
}

/** Derive the business "Source" label for a single lead row. */
export function deriveSourceLabel(source_type: string | null | undefined, source_sub_type: string | null | undefined): string {
  if (source_type === "student_direct") return "Student Portal";
  if (source_sub_type === "university_referral") return "University Referral";
  if (source_sub_type && /refer/i.test(source_sub_type)) return "Partner — Referral";
  return "Partner — Direct";
}

/** Derive the business "Region" label for a single lead row. */
export function deriveRegionLabel(intended_study_country: string | null | undefined): string {
  if (!intended_study_country) return "—";
  return intended_study_country === "India" ? "Domestic" : "International";
}

/** Derive the business "Loan Type" label for a single lead row. */
export function deriveLoanTypeLabel(collateral_available: boolean | null | undefined): string {
  return collateral_available === true ? "Secured" : "Unsecured";
}
