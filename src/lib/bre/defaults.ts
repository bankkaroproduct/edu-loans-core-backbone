// Default scoring config — single source of truth shared with the DB seed.
// Keep this file in sync with the active row in `bre_scoring_configs`.
//
// v3 (current): CIBIL Score and Existing EMI Burden permanently removed from
// the Co-applicant bucket (universal product-level decision). Remaining
// Co-applicant weights renormalized to sum to 100. Student/University buckets,
// bucket threshold, and overall band mapping unchanged from v2.
// Historical co-applicant CIBIL/EMI/Employer data remains in the DB but is
// never read by the engine — see engine.ts BRE_DEPRECATED_PARAM_KEYS.

import type { BreScoringConfig } from "./types";

export const DEFAULT_SCORING_CONFIG_V1: BreScoringConfig = {
  version_number: 3,
  is_active: true,
  bucket_threshold: 60,
  student_params: [
    {
      param_key: "class_x_marks",
      label: "Class X marks (%)",
      input_type: "number",
      weight: 20,
      bands: [
        { from: 90, to: 100, score: 100, label: "Excellent" },
        { from: 75, to: 89.99, score: 80, label: "Good" },
        { from: 60, to: 74.99, score: 60, label: "Average" },
        { from: 0, to: 59.99, score: 30, label: "Weak" },
      ],
    },
    {
      param_key: "class_xii_marks",
      label: "Class XII marks (%)",
      input_type: "number",
      weight: 27,
      bands: [
        { from: 90, to: 100, score: 100, label: "Excellent" },
        { from: 75, to: 89.99, score: 80, label: "Good" },
        { from: 60, to: 74.99, score: 60, label: "Average" },
        { from: 0, to: 59.99, score: 30, label: "Weak" },
      ],
    },
    {
      param_key: "graduation_marks",
      label: "Graduation marks (%)",
      input_type: "number",
      weight: 33,
      bands: [
        { from: 80, to: 100, score: 100, label: "Excellent" },
        { from: 65, to: 79.99, score: 80, label: "Good" },
        { from: 50, to: 64.99, score: 60, label: "Average" },
        { from: 0, to: 49.99, score: 30, label: "Weak" },
      ],
    },
    {
      param_key: "work_experience_years",
      label: "Work experience (years)",
      input_type: "number",
      weight: 20,
      bands: [
        { from: 3, to: 99, score: 100, label: "3+ years" },
        { from: 1, to: 2.99, score: 70, label: "1-3 years" },
        { from: 0, to: 0.99, score: 40, label: "Fresher" },
      ],
    },
  ],
  university_params: [
    {
      param_key: "university_tier",
      label: "University tier",
      input_type: "enum",
      weight: 40,
      bands: [
        { value: "premium", score: 100, label: "Premium / Ivy" },
        { value: "tier_1", score: 85, label: "Tier 1" },
        { value: "tier_2", score: 65, label: "Tier 2" },
        { value: "tier_3", score: 40, label: "Tier 3" },
        { value: "unranked", score: 20, label: "Unranked" },
      ],
    },
    {
      param_key: "country_tier",
      label: "Destination country tier",
      input_type: "enum",
      weight: 25,
      bands: [
        { value: "tier_1", score: 100, label: "US / UK / CA / AU / DE" },
        { value: "tier_2", score: 75, label: "NZ / IE / SG / NL / FR" },
        { value: "tier_3", score: 50, label: "Other developed" },
        { value: "tier_4", score: 25, label: "Emerging" },
      ],
    },
    {
      param_key: "course_category",
      label: "Course category",
      input_type: "enum",
      weight: 20,
      bands: [
        { value: "stem", score: 100, label: "STEM" },
        { value: "mba", score: 95, label: "MBA" },
        { value: "management", score: 80, label: "Management / Business" },
        { value: "healthcare", score: 85, label: "Healthcare" },
        { value: "arts", score: 55, label: "Arts / Humanities" },
        { value: "other", score: 50, label: "Other" },
      ],
    },
    {
      param_key: "course_level",
      label: "Course level",
      input_type: "enum",
      weight: 10,
      bands: [
        { value: "masters", score: 100, label: "Masters" },
        { value: "phd", score: 90, label: "PhD" },
        { value: "bachelors", score: 70, label: "Bachelors" },
        { value: "diploma", score: 40, label: "Diploma" },
      ],
    },
    {
      param_key: "employability_outlook",
      label: "Employability outlook",
      input_type: "enum",
      weight: 5,
      bands: [
        { value: "high", score: 100, label: "High" },
        { value: "medium", score: 70, label: "Medium" },
        { value: "low", score: 40, label: "Low" },
      ],
    },
  ],
  coapplicant_params: [
    {
      param_key: "relationship",
      label: "Relationship to student",
      input_type: "enum",
      weight: 15,
      bands: [
        { value: "parent", score: 100, label: "Parent" },
        { value: "sibling", score: 80, label: "Sibling" },
        { value: "spouse", score: 85, label: "Spouse" },
        { value: "relative", score: 60, label: "Other relative" },
        { value: "other", score: 30, label: "Other" },
      ],
    },
    {
      param_key: "age",
      label: "Co-applicant age (years)",
      input_type: "number",
      weight: 15,
      bands: [
        { from: 35, to: 55, score: 100, label: "Prime" },
        { from: 25, to: 34.99, score: 80, label: "Young earner" },
        { from: 56, to: 62, score: 60, label: "Pre-retirement" },
        { from: 63, to: 99, score: 20, label: "Retired" },
      ],
    },
    {
      param_key: "employment_type",
      label: "Employment type",
      input_type: "enum",
      weight: 15,
      bands: [
        { value: "salaried_govt", score: 100, label: "Salaried (Govt / PSU)" },
        { value: "salaried_private", score: 85, label: "Salaried (Private)" },
        { value: "self_employed_professional", score: 75, label: "Self-employed Professional" },
        { value: "self_employed_business", score: 65, label: "Self-employed Business" },
        { value: "retired_with_pension", score: 55, label: "Retired (Pension)" },
        { value: "other", score: 40, label: "Other" },
        { value: "unemployed", score: 10, label: "Unemployed" },
      ],
    },
    {
      param_key: "monthly_income",
      label: "Monthly income (INR)",
      input_type: "number",
      weight: 45,
      bands: [
        { from: 150000, to: 99999999, score: 100, label: "₹1.5L+" },
        { from: 75000, to: 149999.99, score: 85, label: "₹75K-1.5L" },
        { from: 40000, to: 74999.99, score: 65, label: "₹40K-75K" },
        { from: 25000, to: 39999.99, score: 40, label: "₹25K-40K" },
        { from: 0, to: 24999.99, score: 20, label: "Below ₹25K" },
      ],
    },
    {
      param_key: "income_stability_years",
      label: "Income stability (years)",
      input_type: "number",
      weight: 10,
      bands: [
        { from: 5, to: 99, score: 100, label: "5+ years" },
        { from: 2, to: 4.99, score: 75, label: "2-5 years" },
        { from: 0, to: 1.99, score: 40, label: "<2 years" },
      ],
    },
  ],
  overall_band_mapping: [
    { from: 85, to: 100, band: "A+", loan_min: 3000000, loan_max: 15000000, rate_min: 9.5, rate_max: 10.75, label: "Strong approval" },
    { from: 70, to: 84.99, band: "A", loan_min: 2000000, loan_max: 10000000, rate_min: 10.5, rate_max: 11.75, label: "Approval" },
    { from: 60, to: 69.99, band: "B", loan_min: 1000000, loan_max: 6000000, rate_min: 11.5, rate_max: 13, label: "Approval with conditions" },
    { from: 40, to: 59.99, band: "C", loan_min: 500000, loan_max: 3000000, rate_min: 12.5, rate_max: 14.5, label: "Borderline" },
    { from: 0, to: 39.99, band: "D", loan_min: 0, loan_max: 0, rate_min: 0, rate_max: 0, label: "Reject" },
  ],
};
