// BRE Engine — shared TypeScript types
// Pure data types, no React / no Supabase imports.

export type BucketKey = "student" | "university" | "coapplicant";

export interface NumericBand {
  from: number;
  to: number;
  score: number;
  label?: string;
}

export interface EnumBand {
  value: string;
  score: number;
  label?: string;
}

export type Band = NumericBand | EnumBand;

export interface ScoringParameter {
  param_key: string;
  label: string;
  input_type: "number" | "enum" | "boolean";
  weight: number;
  bands: Band[];
  knockout_threshold?: { op: ">=" | "<=" | ">" | "<"; value: number } | null;
  tooltip?: string;
}

export interface OverallBandRow {
  from: number;
  to: number;
  band: string;
  loan_min: number;
  loan_max: number;
  rate_min: number;
  rate_max: number;
  label?: string;
}

export interface BreScoringConfig {
  id?: string;
  version_number: number;
  is_active: boolean;
  student_params: ScoringParameter[];
  university_params: ScoringParameter[];
  coapplicant_params: ScoringParameter[];
  overall_band_mapping: OverallBandRow[];
  bucket_threshold: number;
}

// ---------- Lender Rules ----------

export interface LenderBasicInfo {
  lender_name: string;
  lender_code: string;
  lender_type: string | null;
  active: boolean;
  spoc_name?: string | null;
  spoc_email?: string | null;
  logo_url?: string | null;
  /** Lender code-type taxonomy from breakdown sheet. Display + ops use only. */
  code_type?: "internal" | "external" | "internal_under_process" | null;
}

export interface LenderCommercials {
  payout_pct: number | null;
  payout_trigger_stage: string | null;
  processing_fee_pct: number | null;
  processing_fee_flat: number | null;
  /** Optional source-backed PF range (e.g. 1%–1.25%). Display-only. */
  processing_fee_pct_min?: number | null;
  processing_fee_pct_max?: number | null;
  /** Whether GST applies to PF. Display-only. */
  processing_fee_gst_applicable?: boolean | null;
  /** PF refundable on disbursement (e.g. PNB). Display-only. */
  processing_fee_refundable_on_disbursement?: boolean | null;
  /** VAS percentage charged by lender. Display-only. */
  vas_pct?: number | null;
  /** True when VAS varies per partner-lender (e.g. Gyandhan aggregator). Display-only. */
  vas_varies_by_lender?: boolean | null;
}

export interface LenderHardThresholds {
  min_coapplicant_income: number | null;
  min_age: number | null;
  max_age: number | null;
  min_cibil: number | null;
  max_dpd_months: number | null;
  min_itr_years: number | null;
  allowed_relationships: string[] | null;
  /** Student age range (knockout when set). */
  student_min_age?: number | null;
  student_max_age?: number | null;
  /** Co-applicant age range (knockout when set). Distinct from min_age/max_age legacy fields. */
  coapplicant_min_age?: number | null;
  coapplicant_max_age?: number | null;
  /** Minimum academic marks (knockout when set). */
  min_marks_class_x_pct?: number | null;
  min_marks_class_xii_pct?: number | null;
  min_marks_grad_pct?: number | null;
  /** Split CIBIL minimums (knockout when set). Falls back to min_cibil. */
  min_cibil_student?: number | null;
  min_cibil_coapplicant?: number | null;
  /** Income thresholds (knockout when set). */
  min_salary_monthly_salaried?: number | null;
  min_itr_annual_self_employed?: number | null;
  /** DPD limits over the trailing 12 months (knockout when set). */
  max_dpd_30?: number | null;
  max_dpd_60?: number | null;
  max_dpd_90?: number | null;
}

export interface LoanCapRange {
  min: number | null;
  max: number | null;
}

export interface LenderLoanCaps {
  secured: LoanCapRange;
  unsecured: LoanCapRange;
}

export interface LenderCollateralLtv {
  fd_ltv_pct: number | null;
  residential_ltv_pct: number | null;
  commercial_ltv_pct: number | null;
}

/**
 * Optional, descriptive expense-coverage flags for a lender.
 * Populated by Admins via the BRE Lender Rule editor and stored inside
 * the existing `bre_lender_rules.coverage` JSONB column. The BRE engine
 * does NOT read these values for scoring, knockout, ranking, or projection.
 * They are surfaced read-only on the Admin Lead Detail lender cards.
 */
export interface LenderExpenseCoverage {
  tuition?: boolean | null;
  living?: boolean | null;
  travel?: boolean | null;
  insurance?: boolean | null;
  other_education_expenses?: boolean | null;
  notes?: string | null;
}

export interface LenderCoverage {
  supported_countries: string[];
  excluded_states: string[];
  accepted_courses: string[];
  university_tier_overrides: { tier: string; allowed: boolean }[];
  /** Optional descriptive expense coverage. Engine does not consume this. */
  expenses?: LenderExpenseCoverage;
  /** ISO codes the lender will NOT fund. Knockout when set. */
  excluded_countries?: string[];
  /** Indian state codes/labels the lender will NOT fund (e.g. "JK", "NE"). Knockout when set. */
  excluded_indian_states?: string[];
  /** Indian city names the lender will NOT fund. Knockout when set. */
  excluded_indian_cities?: string[];
}

export interface LenderPolicy {
  processing_time_days: number | null;
  roi_min: number | null;
  roi_max: number | null;
  /** Optional source-backed secured-route ROI. Engine prefers this when product_type === "secured". */
  roi_secured_min?: number | null;
  roi_secured_max?: number | null;
  /** Optional source-backed unsecured-route ROI. Engine prefers this when product_type === "unsecured". */
  roi_unsecured_min?: number | null;
  roi_unsecured_max?: number | null;
  tenure_min_years: number | null;
  tenure_max_years: number | null;
  moratorium_months: number | null;
  notes?: string | null;
  /** Effective ROI after subvention/concessions, if known. Display-only. */
  effective_roi_min?: number | null;
  effective_roi_max?: number | null;
  /** Max tenure (years), redundant convenience field for breakdown imports. */
  tenure_years_max?: number | null;
  /** Allowed co-applicant relationships at policy level (mirrors hard_thresholds). */
  allowed_relationships?: string[] | null;
  /** University-list governance: premiere list / internal list / case-by-case. */
  university_list_mode?: "premiere" | "internal_list" | "case_to_case" | null;
  /** Course buckets covered (e.g. ["UG","PG"]). */
  courses_covered?: string[] | null;
}

export interface BreLenderRule {
  id: string;
  lender_id: string;
  version_number: number;
  is_active: boolean;
  basic_info: LenderBasicInfo;
  commercials: LenderCommercials;
  hard_thresholds: LenderHardThresholds;
  loan_caps: LenderLoanCaps;
  collateral_ltv: LenderCollateralLtv;
  coverage: LenderCoverage;
  policy: LenderPolicy;
}

// ---------- Profile input ----------

export interface BreProfileInput {
  // Loan request context
  loan_amount: number;
  destination_country: string; // ISO code
  course_category?: string;
  course_level?: string;
  collateral_route?: "secured" | "unsecured" | "either";
  state?: string;
  city?: string;

  // Student bucket
  student: Record<string, number | string | boolean | null | undefined>;

  // University bucket
  university: Record<string, number | string | boolean | null | undefined>;

  // Co-applicant bucket
  coapplicant: Record<string, number | string | boolean | null | undefined> & {
    age?: number | null;
    cibil_score?: number | null;
    relationship?: string | null;
  };
}

// ---------- Result ----------

export interface ParameterTrace {
  bucket: BucketKey;
  param_key: string;
  label: string;
  input: number | string | boolean | null | undefined;
  matched_band: Band | null;
  weight: number;
  band_score: number; // 0..100
  contribution: number; // weight * band_score / 100
}

export interface BucketResult {
  bucket: BucketKey;
  total: number; // 0..100
  passes: boolean; // total >= bucket_threshold
  trace: ParameterTrace[];
}

export interface LenderMatchResult {
  lender_id: string;
  lender_name: string;
  lender_code: string;
  eligible: boolean;
  reasons: string[]; // ineligibility reasons (empty if eligible)
  product_type: "secured" | "unsecured" | null;
  projected_loan_amount: number | null;
  projected_rate: number | null;
  payout_pct: number | null;
  rank: number | null;
  badge: "best_match" | "strong" | "backup" | null;
  /**
   * Pass-through copy of `lender.coverage.expenses` from the lender rule.
   * Descriptive only — never used by scoring, ranking, or eligibility logic.
   */
  coverage_expenses?: LenderExpenseCoverage;
  /**
   * Display-only ROI range (lower/upper bound) used to render "ROI Range: X% – Y%"
   * alongside the projected midpoint. Source indicates which precedence tier was
   * used: "secured" / "unsecured" (product-specific), "policy" (policy.roi_min/max),
   * or "band" (overall band fallback). Pass-through only — NEVER used by ranking,
   * scoring, eligibility, filtering, loan amount, or assignment logic.
   */
  roi_range_min?: number | null;
  roi_range_max?: number | null;
  roi_range_source?: "secured" | "unsecured" | "policy" | "band" | null;
  /**
   * Display-only Processing Fee pass-through from lender.commercials.
   * NEVER used by ranking, scoring, eligibility, filtering, loan amount
   * calculation, or assignment logic.
   */
  pf_pct?: number | null;
  pf_pct_min?: number | null;
  pf_pct_max?: number | null;
  pf_flat?: number | null;
  pf_gst_applicable?: boolean | null;
}

export interface BreResult {
  scoring_config_version: number;
  buckets: {
    student: BucketResult;
    university: BucketResult;
    coapplicant: BucketResult;
  };
  overall_score: number; // simple average of three buckets
  overall_band: OverallBandRow | null;
  eligibility_status: "Approved" | "Approved with conditions" | "Borderline" | "Rejected";
  rejection_reasons: string[];
  eligible_loan_range: { min: number; max: number } | null;
  indicative_rate_range: { min: number; max: number } | null;
  collateral_route: "secured" | "unsecured" | "both" | null;
  eligible_lenders: LenderMatchResult[];
  best_match_lender_id: string | null;
}
