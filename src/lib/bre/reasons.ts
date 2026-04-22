// Human-readable reason strings for BRE engine flags.

export const REASON = {
  bucket_below_threshold: (bucket: string, score: number, threshold: number) =>
    `${bucket} bucket score ${score.toFixed(1)} is below the required threshold of ${threshold}`,
  country_not_supported: (country: string) =>
    `Country ${country} is not serviced by this lender`,
  state_excluded: (state: string) => `State ${state} is excluded by this lender`,
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
};
