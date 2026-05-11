// Pre-canned profile inputs for the BRE simulator.
// Designed to exercise each major engine path:
//   - Strong       → Approved, lots of eligible lenders, high band
//   - Average      → Approved with conditions, mid band
//   - Weak Coapp   → coapplicant bucket fails → Rejected
//   - No Collateral → only unsecured lenders survive

import type { BreProfileInput } from "./types";

export type PresetKey = "strong" | "average" | "weak_coapplicant" | "no_collateral" | "custom";

export interface PresetOption {
  key: PresetKey;
  label: string;
  description: string;
}

export const PRESET_OPTIONS: PresetOption[] = [
  { key: "custom", label: "Custom", description: "Start from a blank profile" },
  { key: "strong", label: "Strong Profile", description: "Top academics, premium uni, strong co-applicant" },
  { key: "average", label: "Average Profile", description: "Solid academics, tier-2 uni, salaried parent" },
  { key: "weak_coapplicant", label: "Weak Co-applicant", description: "Strong student, weak co-applicant — should be rejected" },
  { key: "no_collateral", label: "No Collateral", description: "Unsecured-only route, larger loan amount" },
];

const EMPTY: BreProfileInput = {
  loan_amount: 0,
  destination_country: "",
  course_category: undefined,
  course_level: undefined,
  collateral_route: "either",
  state: undefined,
  student: {},
  university: {},
  coapplicant: {
    age: null,
    relationship: null,
  },
};

export function getPreset(key: PresetKey): BreProfileInput {
  switch (key) {
    case "strong":
      return {
        loan_amount: 5000000,
        destination_country: "US",
        course_category: "stem",
        course_level: "masters",
        collateral_route: "either",
        student: {
          class_x_marks: 92,
          class_xii_marks: 91,
          graduation_marks: 85,
          entrance_rank: 92,
          work_experience_years: 2,
          english_proficiency: 8,
        },
        university: {
          university_tier: "premium",
          country_tier: "tier_1",
          course_category: "stem",
          course_level: "masters",
          employability_outlook: "high",
        },
        coapplicant: {
          relationship: "parent",
          age: 48,
          employment_type: "salaried_private",
          monthly_income: 200000,
          income_stability_years: 18,
        },
      };

    case "average":
      return {
        loan_amount: 2500000,
        destination_country: "CA",
        course_category: "stem",
        course_level: "masters",
        collateral_route: "either",
        student: {
          class_x_marks: 78,
          class_xii_marks: 76,
          graduation_marks: 68,
          entrance_rank: 70,
          work_experience_years: 1,
          english_proficiency: 6.8,
        },
        university: {
          university_tier: "tier_2",
          country_tier: "tier_1",
          course_category: "stem",
          course_level: "masters",
          employability_outlook: "medium",
        },
        coapplicant: {
          relationship: "parent",
          age: 50,
          employment_type: "salaried_private",
          monthly_income: 85000,
          income_stability_years: 10,
        },
      };

    case "weak_coapplicant":
      return {
        loan_amount: 3000000,
        destination_country: "GB",
        course_category: "mba",
        course_level: "masters",
        collateral_route: "either",
        student: {
          class_x_marks: 88,
          class_xii_marks: 86,
          graduation_marks: 80,
          entrance_rank: 85,
          work_experience_years: 4,
          english_proficiency: 7.5,
        },
        university: {
          university_tier: "tier_1",
          country_tier: "tier_1",
          course_category: "mba",
          course_level: "masters",
          employability_outlook: "high",
        },
        coapplicant: {
          relationship: "sibling",
          age: 32,
          employment_type: "self_employed_business",
          monthly_income: 28000,
          income_stability_years: 1,
        },
      };

    case "no_collateral":
      return {
        loan_amount: 4000000,
        destination_country: "US",
        course_category: "stem",
        course_level: "masters",
        collateral_route: "unsecured",
        student: {
          class_x_marks: 80,
          class_xii_marks: 78,
          graduation_marks: 72,
          entrance_rank: 75,
          work_experience_years: 1.5,
          english_proficiency: 7,
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
          age: 52,
          employment_type: "salaried_govt",
          monthly_income: 120000,
          income_stability_years: 20,
        },
      };

    case "custom":
    default:
      return JSON.parse(JSON.stringify(EMPTY)) as BreProfileInput;
  }
}
