// Blank factories used by the BRE editors when admins add a new parameter / band.
// These are deliberately conservative: an empty parameter has weight 0 and a single
// 0-100 numeric band scoring 0 — admins must edit before saving (UI validation will
// catch incomplete configs before the DB is touched).

import type {
  ScoringParameter,
  NumericBand,
  EnumBand,
  OverallBandRow,
  BreLenderRule,
} from "./types";

export function emptyNumericBand(): NumericBand {
  return { from: 0, to: 0, score: 0, label: "" };
}

export function emptyEnumBand(): EnumBand {
  return { value: "", score: 0, label: "" };
}

export function emptyParameter(input_type: "number" | "enum" = "number"): ScoringParameter {
  return {
    param_key: "",
    label: "",
    input_type,
    weight: 0,
    bands: input_type === "number" ? [emptyNumericBand()] : [emptyEnumBand()],
    knockout_threshold: null,
    tooltip: "",
  };
}

export function emptyOverallBandRow(): OverallBandRow {
  return {
    from: 0,
    to: 0,
    band: "",
    loan_min: 0,
    loan_max: 0,
    rate_min: 0,
    rate_max: 0,
    label: "",
  };
}

/** Build a brand-new empty lender rule for a given lender id. Used only as a fallback. */
export function emptyLenderRule(lenderId: string): Omit<BreLenderRule, "id"> {
  return {
    lender_id: lenderId,
    version_number: 1,
    is_active: false,
    basic_info: {
      lender_name: "",
      lender_code: "",
      lender_type: null,
      active: true,
      spoc_name: null,
      spoc_email: null,
      logo_url: null,
    },
    commercials: {
      payout_pct: null,
      payout_trigger_stage: null,
      processing_fee_pct: null,
      processing_fee_flat: null,
    },
    hard_thresholds: {
      min_coapplicant_income: null,
      min_age: null,
      max_age: null,
      min_cibil: null,
      max_dpd_months: null,
      min_itr_years: null,
      allowed_relationships: null,
    },
    loan_caps: {
      secured: { min: null, max: null },
      unsecured: { min: null, max: null },
    },
    collateral_ltv: {
      fd_ltv_pct: null,
      residential_ltv_pct: null,
      commercial_ltv_pct: null,
    },
    coverage: {
      supported_countries: [],
      excluded_states: [],
      accepted_courses: [],
      university_tier_overrides: [],
    },
    policy: {
      processing_time_days: null,
      roi_min: null,
      roi_max: null,
      tenure_min_years: null,
      tenure_max_years: null,
      moratorium_months: null,
      notes: null,
    },
  };
}
