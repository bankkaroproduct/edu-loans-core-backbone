import { describe, it, expect } from "vitest";
import { evaluate, COAPPLICANT_AGE_CAP } from "../engine";
import { DEFAULT_SCORING_CONFIG_V1 } from "../defaults";
import { validateScoringConfig } from "../validate";
import type { BreLenderRule, BreProfileInput } from "../types";

const lenderRule = (over: Partial<BreLenderRule> = {}): BreLenderRule => ({
  id: "rule-1",
  lender_id: "lender-1",
  version_number: 1,
  is_active: true,
  basic_info: { lender_name: "Test Lender", lender_code: "TEST", lender_type: "NBFC", active: true },
  commercials: { payout_pct: 1.5, payout_trigger_stage: "disbursed", processing_fee_pct: null, processing_fee_flat: null },
  hard_thresholds: {
    min_coapplicant_income: null, min_age: null, max_age: null, min_cibil: null,
    max_dpd_months: null, min_itr_years: null, allowed_relationships: null,
  },
  loan_caps: { secured: { min: 100000, max: 10000000 }, unsecured: { min: 100000, max: 5000000 } },
  collateral_ltv: { fd_ltv_pct: null, residential_ltv_pct: null, commercial_ltv_pct: null },
  coverage: { supported_countries: ["US", "GB"], excluded_states: [], accepted_courses: [], university_tier_overrides: [] },
  policy: { processing_time_days: 10, roi_min: null, roi_max: null, tenure_min_years: null, tenure_max_years: null, moratorium_months: null },
  ...over,
});

const strongProfile: BreProfileInput = {
  loan_amount: 4000000,
  destination_country: "US",
  course_category: "stem",
  course_level: "masters",
  collateral_route: "either",
  student: {
    class_x_marks: 92,
    class_xii_marks: 88,
    graduation_marks: 82,
    entrance_rank: 91,
    work_experience_years: 3,
    english_proficiency: 7.5,
  },
  university: {
    university_tier: "tier_1",
    country_tier: "tier_1",
    course_category: "stem",
    course_level: "masters",
    employability_outlook: "high",
  },
  coapplicant: {
    relationship: "parent",
    age: 50,
    employment_type: "salaried_govt",
    monthly_income: 200000,
    income_stability_years: 10,
  },
};

describe("BRE — defaults", () => {
  it("default scoring config v1 passes validation", () => {
    const r = validateScoringConfig(DEFAULT_SCORING_CONFIG_V1);
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });
});

describe("BRE — engine determinism", () => {
  it("produces identical output across runs for the same input", () => {
    const a = evaluate(strongProfile, DEFAULT_SCORING_CONFIG_V1, [lenderRule()]);
    const b = evaluate(strongProfile, DEFAULT_SCORING_CONFIG_V1, [lenderRule()]);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("BRE — bucket threshold rejection", () => {
  it("rejects when student bucket falls below threshold", () => {
    const weak: BreProfileInput = {
      ...strongProfile,
      student: { class_x_marks: 40, class_xii_marks: 40, graduation_marks: 30, entrance_rank: 20, work_experience_years: 0, english_proficiency: 5 },
    };
    const r = evaluate(weak, DEFAULT_SCORING_CONFIG_V1, [lenderRule()]);
    expect(r.eligibility_status).toBe("Rejected");
    expect(r.buckets.student.passes).toBe(false);
    expect(r.rejection_reasons.length).toBeGreaterThan(0);
  });
});

describe("BRE — lender knockouts", () => {
  it("knocks out a lender that does not support the destination country", () => {
    const r = evaluate(strongProfile, DEFAULT_SCORING_CONFIG_V1, [
      lenderRule({ coverage: { supported_countries: ["DE"], excluded_states: [], accepted_courses: [], university_tier_overrides: [] } }),
    ]);
    expect(r.eligible_lenders[0].eligible).toBe(false);
    expect(r.eligible_lenders[0].reasons.some((s) => s.includes("not serviced"))).toBe(true);
  });

  it("ignores lender CIBIL minimum since CIBIL is universally excluded from BRE", () => {
    const r = evaluate(strongProfile, DEFAULT_SCORING_CONFIG_V1, [
      lenderRule({
        hard_thresholds: { ...lenderRule().hard_thresholds, min_cibil: 800 },
      }),
    ]);
    // CIBIL knockouts are intentionally disabled — lender remains eligible.
    expect(r.eligible_lenders[0].eligible).toBe(true);
    expect(r.eligible_lenders[0].reasons.every((s) => !/CIBIL/i.test(s))).toBe(true);
  });

  it("knocks out a lender when the loan amount exceeds caps", () => {
    const r = evaluate(
      { ...strongProfile, loan_amount: 50000000 },
      DEFAULT_SCORING_CONFIG_V1,
      [lenderRule()],
    );
    expect(r.eligible_lenders[0].eligible).toBe(false);
  });
});

describe("BRE — ranking", () => {
  it("ranks eligible lenders by rate asc, loan desc, payout desc", () => {
    const cheap = lenderRule({
      lender_id: "cheap", basic_info: { ...lenderRule().basic_info, lender_code: "CHEAP" },
      policy: { ...lenderRule().policy, roi_min: 9, roi_max: 9.5 },
    });
    const expensive = lenderRule({
      lender_id: "exp", basic_info: { ...lenderRule().basic_info, lender_code: "EXP" },
      policy: { ...lenderRule().policy, roi_min: 13, roi_max: 13.5 },
    });
    const r = evaluate(strongProfile, DEFAULT_SCORING_CONFIG_V1, [expensive, cheap]);
    const eligible = r.eligible_lenders.filter((l) => l.eligible).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
    expect(eligible[0].lender_id).toBe("cheap");
    expect(eligible[0].badge).toBe("best_match");
  });
});

describe("BRE — empty eligible set", () => {
  it("returns empty best match when no lender is eligible", () => {
    const r = evaluate(strongProfile, DEFAULT_SCORING_CONFIG_V1, [
      lenderRule({ coverage: { supported_countries: ["DE"], excluded_states: [], accepted_courses: [], university_tier_overrides: [] } }),
    ]);
    expect(r.best_match_lender_id).toBe(null);
    expect(r.eligible_lenders.every((l) => !l.eligible)).toBe(true);
  });
});

describe("BRE — Bug 1: hard-gate status override", () => {
  it("forces Rejected when no lender is eligible even with high score", () => {
    const r = evaluate(strongProfile, DEFAULT_SCORING_CONFIG_V1, [
      lenderRule({ coverage: { supported_countries: ["DE"], excluded_states: [], accepted_courses: [], university_tier_overrides: [] } }),
    ]);
    expect(r.eligibility_status).toBe("Rejected");
    expect(r.rejection_reasons.some((s) => s.includes("Hard eligibility gate"))).toBe(true);
  });

  it("forces Rejected when destination_country is missing", () => {
    const r = evaluate(
      { ...strongProfile, destination_country: "" },
      DEFAULT_SCORING_CONFIG_V1,
      [lenderRule()],
    );
    expect(r.eligibility_status).toBe("Rejected");
    expect(r.rejection_reasons.some((s) => s.includes("Destination country is required"))).toBe(true);
  });
});

describe("BRE — Bug 2: universal co-applicant age cap", () => {
  it(`rejects when co-applicant age exceeds ${COAPPLICANT_AGE_CAP} even if lender max_age is null`, () => {
    const r = evaluate(
      { ...strongProfile, coapplicant: { ...strongProfile.coapplicant, age: 64 } },
      DEFAULT_SCORING_CONFIG_V1,
      [lenderRule()],
    );
    expect(r.eligibility_status).toBe("Rejected");
    expect(r.rejection_reasons.some((s) => s.includes("age 64") && s.includes("60"))).toBe(true);
    expect(r.eligible_lenders.every((l) => !l.eligible)).toBe(true);
  });

  it("accepts when co-applicant age equals the cap", () => {
    const r = evaluate(
      { ...strongProfile, coapplicant: { ...strongProfile.coapplicant, age: COAPPLICANT_AGE_CAP } },
      DEFAULT_SCORING_CONFIG_V1,
      [lenderRule()],
    );
    expect(r.eligibility_status).not.toBe("Rejected");
  });
});

describe("BRE — Bug 3: dynamic global loan-cap message", () => {
  it("cites the global maximum across active lenders, not a single lender's cap", () => {
    const small = lenderRule({
      lender_id: "small",
      basic_info: { ...lenderRule().basic_info, lender_code: "SMALL" },
      loan_caps: { secured: { min: 100000, max: 1_00_00_000 }, unsecured: { min: 100000, max: 50_00_000 } },
    });
    const big = lenderRule({
      lender_id: "big",
      basic_info: { ...lenderRule().basic_info, lender_code: "BIG" },
      loan_caps: { secured: { min: 100000, max: 3_00_00_000 }, unsecured: { min: 100000, max: 1_50_00_000 } },
    });
    const r = evaluate(
      { ...strongProfile, loan_amount: 5_00_00_000, collateral_route: "either" },
      DEFAULT_SCORING_CONFIG_V1,
      [small, big],
    );
    expect(r.eligibility_status).toBe("Rejected");
    const top = r.rejection_reasons.find((s) => s.includes("exceeds maximum available"));
    expect(top).toBeDefined();
    expect(top!).toContain("3,00,00,000");
  });
});
