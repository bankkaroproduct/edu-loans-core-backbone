// Lender-specific BRE scorecard types (Layer 2).
// Additive — not consumed by Generic BRE scoring/ranking/eligibility.

export type ProvenanceTag = "source_backed" | "inferred" | "proposed" | "needs_business_validation";

export type LenderRiskBand =
  | "Low Risk"
  | "Medium Risk"
  | "High Risk"
  | "Needs Review"
  | "Not Eligible";

export type ScorecardFactorKey =
  | "academics"
  | "backlogs"
  | "university_course"
  | "cibil"
  | "income"
  | "emi_foir"
  | "income_stability"
  | "collateral_route"
  | "loan_amount_fit"
  | "coverage"
  | "processing_ops";

export interface FactorComponent {
  factor: ScorecardFactorKey;
  weight: number; // 0..100 (sum across enabled factors should be 100)
  raw_score: number; // 0..100
  weighted: number; // raw_score * weight / 100
  provenance: ProvenanceTag;
  note?: string;
}

export type RationaleChipKey =
  | "cibil_strong"
  | "cibil_weak"
  | "income_supports_repayment"
  | "income_below_floor"
  | "high_emi_burden"
  | "route_matches_collateral"
  | "collateral_review_needed"
  | "premiere_university_match"
  | "loan_amount_fits_cap"
  | "academics_strong"
  | "academics_weak"
  | "backlogs_increase_risk"
  | "coverage_fit";

export interface RationaleChip {
  key: RationaleChipKey;
  label: string;
  tone: "positive" | "neutral" | "negative";
  provenance: ProvenanceTag;
}

export interface LenderScorecardOutput {
  lender_specific_score: number; // 0..100
  lender_risk_band: LenderRiskBand;
  risk_based_indicative_roi: number | null; // clamped within route ROI range
  lender_indicative_roi: number | null; // alias
  lender_specific_rationale: RationaleChip[];
  lender_rationale_chips: RationaleChip[]; // alias
  score_breakdown: FactorComponent[];
  scorecard_provenance: ProvenanceTag; // overall worst-case tag
  scorecard_version: string;
}
