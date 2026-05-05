// Human-readable reason strings for BRE engine flags.

import type { BreLenderRule } from "./types";

/**
 * Compute the maximum loan amount available across all active lender rules
 * for the chosen collateral route. Used for accurate top-level rejection messages.
 */
export function getMaxCapForRoute(
  rules: BreLenderRule[],
  route: "secured" | "unsecured" | "either" | undefined,
): number | null {
  const caps: number[] = [];
  for (const r of rules) {
    if (r.basic_info?.active === false) continue;
    const sec = r.loan_caps?.secured?.max;
    const uns = r.loan_caps?.unsecured?.max;
    if (route === "secured") {
      if (sec != null) caps.push(sec);
    } else if (route === "unsecured") {
      if (uns != null) caps.push(uns);
    } else {
      // "either" or undefined → consider the better of the two for each lender
      const best = Math.max(sec ?? -Infinity, uns ?? -Infinity);
      if (Number.isFinite(best)) caps.push(best);
    }
  }
  return caps.length > 0 ? Math.max(...caps) : null;
}

export const REASON = {
  bucket_below_threshold: (bucket: string, score: number, threshold: number) =>
    `${bucket} bucket score ${score.toFixed(1)} is below the required threshold of ${threshold}`,
  country_not_supported: (country: string) =>
    `Country ${country} is not serviced by this lender`,
  country_excluded: (country: string) =>
    `Country ${country} is explicitly excluded by this lender`,
  state_excluded: (state: string) => `State ${state} is excluded by this lender`,
  city_excluded: (city: string) => `City ${city} is excluded by this lender`,
  marks_below_min: (level: string, min: number) =>
    `Academic marks (${level}) are below the lender's minimum of ${min}%`,
  salary_below_min: (min: number) =>
    `Salaried co-applicant monthly income is below the lender's minimum of ₹${min.toLocaleString("en-IN")}`,
  itr_below_min: (min: number) =>
    `Self-employed co-applicant annual ITR is below the lender's minimum of ₹${min.toLocaleString("en-IN")}`,
  student_age_out_of_range: (age: number, min: number | null, max: number | null) =>
    `Student age ${age} is outside the lender's permitted range (${min ?? "—"}–${max ?? "—"})`,
  loan_below_min: (min: number) =>
    `Requested loan amount is below the lender's minimum of ₹${min.toLocaleString("en-IN")}`,
  loan_above_max: (max: number) =>
    `Requested loan amount exceeds the lender's maximum of ₹${max.toLocaleString("en-IN")}`,
  cibil_too_low: (min: number) =>
    `Co-applicant CIBIL is below the lender's minimum of ${min}`,
  age_below_min: (min: number) => `Co-applicant age is below the lender's minimum of ${min}`,
  age_above_max: (max: number) => `Co-applicant age is above the lender's maximum of ${max}`,
  income_below_min: (min: number) =>
    `Co-applicant income is below the lender's minimum of ₹${min.toLocaleString("en-IN")}`,
  collateral_route_not_supported: (route: string) =>
    `Lender does not offer ${route} loans`,
  course_not_accepted: (course: string) =>
    `Course "${course}" is not in the lender's accepted list`,
  relationship_not_allowed: (rel: string) =>
    `Co-applicant relationship "${rel}" is not accepted by this lender`,
  no_overall_band: () => "Overall score does not map to any approval band",
  loan_above_global_max: (loan: number, globalMax: number, route: string) =>
    `Loan amount ₹${loan.toLocaleString("en-IN")} exceeds maximum available ₹${globalMax.toLocaleString("en-IN")} for ${route} route`,
  coapplicant_age_cap: (age: number, cap: number) =>
    `Co-applicant age ${age} exceeds maximum permitted age ${cap}`,
  hard_gate_failed: () =>
    "Hard eligibility gate failed — no lender can fund this profile",
  missing_destination_country: () =>
    "Destination country is required but missing",
  missing_loan_amount: () =>
    "Loan amount is required but missing or invalid",
};
