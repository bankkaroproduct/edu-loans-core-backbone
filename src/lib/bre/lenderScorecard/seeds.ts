// Per-lender scorecard seeds — Tier 1 lenders get specific configs,
// others fall back to a balanced default. Weights sum to 100 per lender.
//
// IMPORTANT:
//   - Income floors marked `proposed` are NOT source-backed. ICICI/Axis use
//     ₹40,000 monthly as a proposed default (business validation pending).

import type { ProvenanceTag, ScorecardFactorKey } from "./types";

export interface ScorecardWeight {
  factor: ScorecardFactorKey;
  weight: number;
  provenance: ProvenanceTag;
}

export interface ScorecardSeed {
  lender_code: string; // matched case-insensitively
  display_label: string;
  weights: ScorecardWeight[];
  income_floor_monthly: number; // proposed unless tagged otherwise
  income_floor_provenance: ProvenanceTag;
  notes?: string;
}

export const DEFAULT_WEIGHTS: ScorecardWeight[] = [
  { factor: "cibil", weight: 18, provenance: "proposed" },
  { factor: "income", weight: 14, provenance: "proposed" },
  { factor: "emi_foir", weight: 10, provenance: "proposed" },
  { factor: "income_stability", weight: 8, provenance: "inferred" },
  { factor: "academics", weight: 10, provenance: "proposed" },
  { factor: "backlogs", weight: 5, provenance: "proposed" },
  { factor: "university_course", weight: 12, provenance: "inferred" },
  { factor: "collateral_route", weight: 10, provenance: "source_backed" },
  { factor: "loan_amount_fit", weight: 8, provenance: "source_backed" },
  { factor: "coverage", weight: 3, provenance: "source_backed" },
  { factor: "processing_ops", weight: 2, provenance: "inferred" },
];

export const DEFAULT_SEED: ScorecardSeed = {
  lender_code: "_default",
  display_label: "Default scorecard",
  weights: DEFAULT_WEIGHTS,
  income_floor_monthly: 35000,
  income_floor_provenance: "proposed",
};

export const SEEDS: ScorecardSeed[] = [
  {
    lender_code: "ICICI",
    display_label: "ICICI scorecard (income-weighted)",
    weights: [
      { factor: "cibil", weight: 20, provenance: "source_backed" },
      { factor: "income", weight: 18, provenance: "proposed" },
      { factor: "emi_foir", weight: 12, provenance: "proposed" },
      { factor: "income_stability", weight: 10, provenance: "inferred" },
      { factor: "academics", weight: 8, provenance: "proposed" },
      { factor: "backlogs", weight: 4, provenance: "proposed" },
      { factor: "university_course", weight: 10, provenance: "inferred" },
      { factor: "collateral_route", weight: 8, provenance: "source_backed" },
      { factor: "loan_amount_fit", weight: 6, provenance: "source_backed" },
      { factor: "coverage", weight: 2, provenance: "source_backed" },
      { factor: "processing_ops", weight: 2, provenance: "inferred" },
    ],
    income_floor_monthly: 40000,
    income_floor_provenance: "proposed",
    notes: "₹40k floor is proposed default; source conflict (30k vs 40k) — business validation pending.",
  },
  {
    lender_code: "AXIS",
    display_label: "Axis scorecard (income-weighted)",
    weights: [
      { factor: "cibil", weight: 18, provenance: "source_backed" },
      { factor: "income", weight: 18, provenance: "proposed" },
      { factor: "emi_foir", weight: 12, provenance: "proposed" },
      { factor: "income_stability", weight: 10, provenance: "inferred" },
      { factor: "academics", weight: 9, provenance: "proposed" },
      { factor: "backlogs", weight: 4, provenance: "proposed" },
      { factor: "university_course", weight: 10, provenance: "inferred" },
      { factor: "collateral_route", weight: 9, provenance: "source_backed" },
      { factor: "loan_amount_fit", weight: 6, provenance: "source_backed" },
      { factor: "coverage", weight: 2, provenance: "source_backed" },
      { factor: "processing_ops", weight: 2, provenance: "inferred" },
    ],
    income_floor_monthly: 40000,
    income_floor_provenance: "proposed",
    notes: "₹40k floor is proposed default; source conflict (35k vs 40k) — business validation pending.",
  },
  {
    lender_code: "CREDILA",
    display_label: "Credila scorecard (university-weighted)",
    weights: [
      { factor: "university_course", weight: 22, provenance: "source_backed" },
      { factor: "cibil", weight: 14, provenance: "source_backed" },
      { factor: "academics", weight: 12, provenance: "proposed" },
      { factor: "income", weight: 10, provenance: "proposed" },
      { factor: "emi_foir", weight: 8, provenance: "proposed" },
      { factor: "income_stability", weight: 6, provenance: "inferred" },
      { factor: "backlogs", weight: 4, provenance: "proposed" },
      { factor: "collateral_route", weight: 10, provenance: "source_backed" },
      { factor: "loan_amount_fit", weight: 8, provenance: "source_backed" },
      { factor: "coverage", weight: 4, provenance: "source_backed" },
      { factor: "processing_ops", weight: 2, provenance: "inferred" },
    ],
    income_floor_monthly: 30000,
    income_floor_provenance: "inferred",
  },
  {
    lender_code: "IDFC",
    display_label: "IDFC FIRST scorecard",
    weights: DEFAULT_WEIGHTS,
    income_floor_monthly: 35000,
    income_floor_provenance: "proposed",
  },
  {
    lender_code: "INCRED",
    display_label: "InCred scorecard",
    weights: DEFAULT_WEIGHTS,
    income_floor_monthly: 30000,
    income_floor_provenance: "proposed",
  },
];

export function getSeedForLender(lenderCode: string): ScorecardSeed {
  const code = (lenderCode || "").toUpperCase();
  const found = SEEDS.find((s) => code.includes(s.lender_code));
  return found ?? DEFAULT_SEED;
}
