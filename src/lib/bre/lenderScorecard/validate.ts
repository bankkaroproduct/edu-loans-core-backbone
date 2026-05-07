// Client-side validation of a lender-specific scorecard draft.
// Mirrors structural rules expected by the BRE engine's evaluateLenderScorecard.

import type { ProvenanceTag, ScorecardFactorKey } from "./types";
import type { NormalizedScorecard } from "./normalizeScorecard";

export interface ScorecardValidationError {
  bucket?: string;
  param_key?: string;
  message: string;
}

const VALID_PROV: ProvenanceTag[] = [
  "source_backed",
  "inferred",
  "proposed",
  "needs_business_validation",
];

export const REQUIRED_FACTORS: ScorecardFactorKey[] = [
  "academics",
  "backlogs",
  "university_course",
  "cibil",
  "income",
  "emi_foir",
  "income_stability",
  "collateral_route",
  "loan_amount_fit",
  "coverage",
  "processing_ops",
];

export function validateLenderScorecard(sc: NormalizedScorecard): ScorecardValidationError[] {
  const errors: ScorecardValidationError[] = [];

  // All required factors present
  const present = new Set(sc.weights.map((w) => w.factor));
  for (const f of REQUIRED_FACTORS) {
    if (!present.has(f)) {
      errors.push({ bucket: "weights", param_key: f, message: `Factor "${f}" is missing` });
    }
  }

  // Per-factor checks
  let sum = 0;
  for (const w of sc.weights) {
    if (!REQUIRED_FACTORS.includes(w.factor)) {
      errors.push({ bucket: "weights", param_key: w.factor, message: `Unknown factor "${w.factor}"` });
      continue;
    }
    if (typeof w.weight !== "number" || !Number.isFinite(w.weight)) {
      errors.push({ bucket: "weights", param_key: w.factor, message: `Weight must be a number` });
      continue;
    }
    if (w.weight < 0 || w.weight > 100) {
      errors.push({ bucket: "weights", param_key: w.factor, message: `Weight must be between 0 and 100` });
    }
    if (!Number.isInteger(w.weight)) {
      errors.push({ bucket: "weights", param_key: w.factor, message: `Weight must be a whole number` });
    }
    if (!VALID_PROV.includes(w.provenance)) {
      errors.push({ bucket: "weights", param_key: w.factor, message: `Invalid provenance` });
    }
    sum += w.weight;
  }

  if (sum !== 100) {
    errors.push({ bucket: "weights", message: `Weights must sum to 100 (got ${sum})` });
  }

  // Income floor
  if (typeof sc.income_floor_monthly !== "number" || !Number.isFinite(sc.income_floor_monthly) || sc.income_floor_monthly < 0) {
    errors.push({ bucket: "income_floor", message: `Income floor must be a non-negative number` });
  }
  if (!VALID_PROV.includes(sc.income_floor_provenance)) {
    errors.push({ bucket: "income_floor", message: `Invalid income floor provenance` });
  }

  // Display label
  if (!sc.display_label || !sc.display_label.trim()) {
    errors.push({ bucket: "meta", message: `Display label is required` });
  }

  return errors;
}
