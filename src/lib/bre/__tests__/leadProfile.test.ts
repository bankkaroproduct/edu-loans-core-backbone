import { describe, it, expect, vi } from "vitest";

// The mapper imports the supabase client at module top-level. Stub it so the
// sync mapper can run without a live client.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null }) }),
        ilike: () => ({ data: [] }),
      }),
    }),
  },
}));

import {
  buildBreProfileFromLead,
  deriveCourseCategoryFromName,
} from "../leadProfile";
import { evaluate } from "../engine";
import { DEFAULT_SCORING_CONFIG_V1 } from "../defaults";

function leadStub(overrides: Record<string, unknown> = {}): any {
  return {
    id: "test",
    intended_study_country: "United States",
    loan_amount_required: 4000000,
    course_category: null,
    course_name: null,
    coapplicant_income: 100000,
    coapplicant_relation: "Father",
    coapplicant_employment_type: "Salaried",
    test_scores: {},
    collateral_available: false,
    collateral_notes: null,
    marks_gpa: null,
    highest_qualification: null,
    state: null,
    university_id: null,
    university_name_raw: null,
    ...overrides,
  };
}

describe("course_category derivation", () => {
  it("'Master in professional accounting' → management via course_name_keyword (accounting)", () => {
    const { profile, resolution } = buildBreProfileFromLead(
      leadStub({ course_name: "Master in professional accounting" }),
    );
    expect(profile.course_category).toBe("management");
    expect(profile.course_level).toBe("masters");
    expect(resolution?.course_category_derivation?.source).toBe("course_name_keyword");
    expect(resolution?.course_category_derivation?.matched_keyword).toMatch(/accounting/);
    expect(resolution?.course_category_derivation?.derived).toBe("management");
  });

  it("Unknown free text with no keyword → defaults to 'other'", () => {
    const { profile, resolution } = buildBreProfileFromLead(
      leadStub({ course_name: "Underwater basket weaving program" }),
    );
    expect(profile.course_category).toBe("other");
    expect(resolution?.course_category_derivation?.source).toBe("default_other");
  });

  it("Blank/null course_name → category null with source 'none'", () => {
    const { profile, resolution } = buildBreProfileFromLead(
      leadStub({ course_name: null, course_category: null }),
    );
    expect(profile.course_category).toBeUndefined();
    expect(resolution?.course_category_derivation?.source).toBe("none");
    expect(resolution?.course_category_derivation?.derived).toBeNull();
  });

  it("Explicit valid course_category overrides course_name", () => {
    const { profile, resolution } = buildBreProfileFromLead(
      leadStub({ course_category: "STEM (Science/Tech/Eng/Math)", course_name: "MBA Finance" }),
    );
    expect(profile.course_category).toBe("stem");
    expect(resolution?.course_category_derivation?.source).toBe("explicit");
  });

  it("Invalid explicit course_category falls back to course_name keyword", () => {
    const { profile, resolution } = buildBreProfileFromLead(
      leadStub({ course_category: "Totally Made Up", course_name: "Bachelor of Commerce" }),
    );
    expect(profile.course_category).toBe("management");
    expect(resolution?.course_category_derivation?.source).toBe("course_name_keyword");
  });

  it("Direct helper: finance / banking / fintech / supply chain → management", () => {
    expect(deriveCourseCategoryFromName("MS Finance")?.category).toBe("management");
    expect(deriveCourseCategoryFromName("Banking and Insurance")?.category).toBe("management");
    expect(deriveCourseCategoryFromName("Fintech Innovation")?.category).toBe("management");
    expect(deriveCourseCategoryFromName("Supply Chain Operations")?.category).toBe("management");
    expect(deriveCourseCategoryFromName("Business Analytics")?.category).toBe("management");
  });

  it("Direct helper: data science / AI / cyber security → stem", () => {
    expect(deriveCourseCategoryFromName("MS Data Science")?.category).toBe("stem");
    expect(deriveCourseCategoryFromName("AI and Machine Learning")?.category).toBe("stem");
    expect(deriveCourseCategoryFromName("MSc Cyber Security")?.category).toBe("stem");
  });
});

describe("employability_outlook universal exclusion", () => {
  it("is dropped from University bucket scoring and weights renormalize to 100", () => {
    const profile: any = {
      loan_amount: 4000000,
      destination_country: "US",
      course_category: "stem",
      course_level: "masters",
      collateral_route: "unsecured",
      student: {
        class_x_marks: 90,
        class_xii_marks: 90,
        graduation_marks: 80,
        work_experience_years: 3,
      },
      university: {
        university_tier: "tier_1",
        country_tier: "tier_1",
        course_category: "stem",
        course_level: "masters",
        employability_outlook: "high", // should be ignored
      },
      coapplicant: {
        relationship: "parent",
        age: 50,
        employment_type: "salaried_private",
        monthly_income: 150000,
        income_stability_years: 10,
      },
    };
    const r = evaluate(profile, DEFAULT_SCORING_CONFIG_V1, []);
    const uni = r.buckets.university;

    // No trace entry for employability_outlook
    expect(uni.trace.some((t) => t.param_key === "employability_outlook")).toBe(false);

    // Weights of remaining 4 university params (40+25+20+10 = 95) must be
    // renormalized to ~100 — sum of weights in the trace equals 100 (±0.5).
    const traceWeightSum = uni.trace.reduce((s, t) => s + (t.weight ?? 0), 0);
    expect(traceWeightSum).toBeGreaterThanOrEqual(99.5);
    expect(traceWeightSum).toBeLessThanOrEqual(100.5);

    // No rejection reason or missing-data blocker mentions employability_outlook
    expect(r.rejection_reasons.every((s) => !/employability/i.test(s))).toBe(true);
  });

  it("derivation logic is NOT hardcoded to any specific lead id", () => {
    // Same `course_name` produces the same result regardless of any lead identifier.
    const a = buildBreProfileFromLead(
      leadStub({ id: "EL-PL-000070", course_name: "Master in professional accounting" }),
    );
    const b = buildBreProfileFromLead(
      leadStub({ id: "EL-PL-999999", course_name: "Master in professional accounting" }),
    );
    expect(a.profile.course_category).toBe(b.profile.course_category);
    expect(a.profile.course_category).toBe("management");
  });
});
