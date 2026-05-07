// Deterministic rationale chip generation from evaluated factors.

import type { FactorComponent, RationaleChip } from "./types";

export function buildRationale(
  components: FactorComponent[],
  ctx: {
    routeMatch: boolean;
    collateralNotesMissing: boolean;
    premiereMatch: boolean;
    loanFitsCap: boolean;
    incomeBelowFloor: boolean;
    coverageOk: boolean;
  },
): RationaleChip[] {
  const out: RationaleChip[] = [];
  const byFactor = new Map(components.map((c) => [c.factor, c] as const));

  const cibil = byFactor.get("cibil");
  if (cibil) {
    if (cibil.raw_score >= 80) out.push({ key: "cibil_strong", label: "Strong CIBIL", tone: "positive", provenance: cibil.provenance });
    else if (cibil.raw_score <= 40) out.push({ key: "cibil_weak", label: "Weak CIBIL", tone: "negative", provenance: cibil.provenance });
  }

  const income = byFactor.get("income");
  if (income) {
    if (ctx.incomeBelowFloor) out.push({ key: "income_below_floor", label: "Income below lender floor", tone: "negative", provenance: income.provenance });
    else if (income.raw_score >= 70) out.push({ key: "income_supports_repayment", label: "Income supports repayment", tone: "positive", provenance: income.provenance });
  }

  const foir = byFactor.get("emi_foir");
  if (foir && foir.raw_score <= 35) out.push({ key: "high_emi_burden", label: "High EMI burden", tone: "negative", provenance: foir.provenance });

  const collat = byFactor.get("collateral_route");
  if (collat) {
    if (ctx.collateralNotesMissing) out.push({ key: "collateral_review_needed", label: "Collateral review needed", tone: "neutral", provenance: collat.provenance });
    else if (ctx.routeMatch) out.push({ key: "route_matches_collateral", label: "Route matches collateral status", tone: "positive", provenance: collat.provenance });
  }

  if (ctx.premiereMatch) out.push({ key: "premiere_university_match", label: "Premiere university match", tone: "positive", provenance: "source_backed" });

  const acads = byFactor.get("academics");
  if (acads) {
    if (acads.raw_score >= 80) out.push({ key: "academics_strong", label: "Strong academic profile", tone: "positive", provenance: acads.provenance });
    else if (acads.raw_score <= 35) out.push({ key: "academics_weak", label: "Weak academic profile", tone: "negative", provenance: acads.provenance });
  }

  const back = byFactor.get("backlogs");
  if (back && back.raw_score <= 50) out.push({ key: "backlogs_increase_risk", label: "Backlogs increase risk", tone: "negative", provenance: back.provenance });

  if (ctx.loanFitsCap) {
    const fit = byFactor.get("loan_amount_fit");
    if (fit && fit.raw_score >= 80) out.push({ key: "loan_amount_fits_cap", label: "Loan amount fits lender cap", tone: "positive", provenance: fit.provenance });
  }

  const cov = byFactor.get("coverage");
  if (cov && ctx.coverageOk) out.push({ key: "coverage_fit", label: "Coverage fit", tone: "positive", provenance: cov.provenance });

  return out;
}
