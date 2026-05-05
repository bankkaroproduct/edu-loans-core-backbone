/**
 * Phase 3 — Display-only ranking for Admin BRE & Lender Recommendation cards.
 *
 * Pure helper. Does NOT mutate engine output, lead_lender_matches, ranking,
 * eligibility, lender rules, ROI, PF, or coverage. Consumes engine
 * `eligible_lenders` (already filtered by route/loan/eligibility) and a
 * premiere match map, and produces a display order, rank badge, fit label,
 * and rationale chips per lender.
 *
 * Scoring (total = 100):
 *   premiere       25
 *   route fit      20
 *   total cost     25  (ROI 70% + PF 30%)
 *   loan-amount    15
 *   coverage       10
 *   ops time        5
 *
 * Missing data → neutral (0.5) where the spec says "do not penalize".
 * Missing premiere → 0 (premiere is binary and explicit).
 */

import type { BreResult } from "./types";

export type DisplayCollateralState =
  | "secured"
  | "secured_review_needed"
  | "unsecured"
  | null;

export interface DisplayRankingInput {
  lender: BreResult["eligible_lenders"][number];
  isPremiere: boolean;
  premiereKnown: boolean; // false when lookup is unavailable / errored
  processingTimeDays: number | null;
  loanAmountRequested: number | null;
  loanCapMin: number | null;
  loanCapMax: number | null;
}

export interface DisplayRankingOutput {
  lender_id: string;
  displayRank: number;
  displayScore: number; // 0..100
  fitLabel: "best_fit" | "good_fit" | "backup";
  routeFit: number; // 0..1
  costFit: number; // 0..1
  effectivePfPct: number | null; // % normalized
  rationale: string[]; // chips
  premiereKnown: boolean;
  isPremiere: boolean;
}

const W = {
  premiere: 25,
  route: 20,
  cost: 25,
  loan: 15,
  coverage: 10,
  ops: 5,
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Effective PF % normalised against the projected loan amount.
 * - percentage range → use max (conservative)
 * - single percentage → use as-is
 * - flat ₹ → flat / projected_loan * 100
 * - unknown → null (caller treats as neutral 0.5)
 */
export function computeEffectivePfPct(
  l: BreResult["eligible_lenders"][number],
): number | null {
  if (l.pf_pct_max != null) return Number(l.pf_pct_max);
  if (l.pf_pct != null) return Number(l.pf_pct);
  if (l.pf_flat != null && l.projected_loan_amount && l.projected_loan_amount > 0) {
    return (Number(l.pf_flat) / Number(l.projected_loan_amount)) * 100;
  }
  return null;
}

function routeFitFor(
  productType: "secured" | "unsecured" | null,
  collateralState: DisplayCollateralState,
): number {
  if (!productType) return 0;
  if (collateralState === "unsecured") return productType === "unsecured" ? 1 : 0;
  if (collateralState === "secured") return productType === "secured" ? 1 : 0.4;
  if (collateralState === "secured_review_needed") {
    return productType === "secured" ? 0.6 : 0.4;
  }
  return 0.5;
}

function loanFitFor(
  requested: number | null,
  min: number | null,
  max: number | null,
): number {
  if (requested == null || requested <= 0) return 0.5;
  if (min != null && requested < min) return 0; // engine should have filtered
  if (max != null && requested > max) return 0;
  if (max != null && max > 0) {
    const ratio = requested / max;
    if (ratio <= 0.7) return 1;
    if (ratio <= 0.9) return 0.85;
    return 0.7;
  }
  return 0.85;
}

function coverageFitFor(
  exp: BreResult["eligible_lenders"][number]["coverage_expenses"],
): number {
  if (!exp || typeof exp !== "object") return 0.5;
  const keys = ["tuition", "living", "travel", "insurance", "other_education_expenses"] as const;
  let trues = 0;
  let known = 0;
  for (const k of keys) {
    const v = (exp as Record<string, unknown>)[k];
    if (typeof v === "boolean") {
      known += 1;
      if (v) trues += 1;
    }
  }
  if (known === 0) return 0.5;
  return trues / keys.length;
}

/**
 * Compute display ranking for the visible eligible-lender cohort.
 */
export function computeDisplayRanking(
  inputs: DisplayRankingInput[],
  collateralState: DisplayCollateralState,
): DisplayRankingOutput[] {
  if (inputs.length === 0) return [];

  // Pre-compute effective PF and ROI for cohort-relative scoring.
  const effPf = inputs.map((x) => computeEffectivePfPct(x.lender));
  const rois = inputs.map((x) =>
    x.lender.projected_rate != null ? Number(x.lender.projected_rate) : null,
  );
  const ops = inputs.map((x) =>
    x.processingTimeDays != null && x.processingTimeDays > 0 ? x.processingTimeDays : null,
  );

  const knownRois = rois.filter((v): v is number => v != null);
  const knownPf = effPf.filter((v): v is number => v != null);
  const knownOps = ops.filter((v): v is number => v != null);

  const roiMin = knownRois.length ? Math.min(...knownRois) : 0;
  const roiMax = knownRois.length ? Math.max(...knownRois) : 0;
  const pfMin = knownPf.length ? Math.min(...knownPf) : 0;
  const pfMax = knownPf.length ? Math.max(...knownPf) : 0;
  const opsMin = knownOps.length ? Math.min(...knownOps) : 0;
  const opsMax = knownOps.length ? Math.max(...knownOps) : 0;

  const linearBest = (v: number | null, min: number, max: number): number => {
    if (v == null) return 0.5;
    if (max <= min) return 1; // single-lender or all equal
    return clamp01(1 - (v - min) / (max - min));
  };

  type Scored = DisplayRankingOutput & {
    _routeFit: number;
    _projectedRate: number | null;
    _effPf: number | null;
    _coverageCount: number;
    _projectedLoan: number;
    _ops: number | null;
    _lenderCode: string;
  };

  const scored: Scored[] = inputs.map((x, i) => {
    const route = routeFitFor(x.lender.product_type, collateralState);
    const roiSub = linearBest(rois[i], roiMin, roiMax);
    const pfSub = effPf[i] == null ? 0.5 : linearBest(effPf[i], pfMin, pfMax);
    const cost = clamp01(roiSub * 0.7 + pfSub * 0.3);
    const loan = loanFitFor(x.loanAmountRequested, x.loanCapMin, x.loanCapMax);
    const cov = coverageFitFor(x.lender.coverage_expenses);
    const opsScore = ops[i] == null ? 0.5 : linearBest(ops[i], opsMin, opsMax);
    const premiereSub = x.premiereKnown ? (x.isPremiere ? 1 : 0) : 0;

    const score =
      premiereSub * W.premiere +
      route * W.route +
      cost * W.cost +
      loan * W.loan +
      cov * W.coverage +
      opsScore * W.ops;

    // Rationale chips — only real factors
    const chips: string[] = [];
    if (route >= 1) {
      chips.push(
        x.lender.product_type === "secured"
          ? "Route matches collateral status"
          : "Route matches no-collateral status",
      );
    } else if (route >= 0.6 && collateralState === "secured_review_needed") {
      chips.push("Collateral review needed");
    }
    if (rois[i] != null && roiMax > roiMin && rois[i] === roiMin) {
      chips.push("Lower projected ROI");
    }
    if (effPf[i] != null && pfMax > pfMin && effPf[i] === pfMin) {
      chips.push("Lower PF");
    }
    if (x.premiereKnown && x.isPremiere) {
      chips.push("Premiere university match");
    }
    const trueCov = (() => {
      const exp = x.lender.coverage_expenses;
      if (!exp || typeof exp !== "object") return 0;
      return ["tuition", "living", "travel", "insurance", "other_education_expenses"].reduce(
        (acc, k) => acc + ((exp as Record<string, unknown>)[k] === true ? 1 : 0),
        0,
      );
    })();
    if (trueCov >= 3) chips.push(`Covers ${trueCov} expense categories`);
    if (loan >= 0.85 && x.loanAmountRequested && x.loanAmountRequested > 0) {
      chips.push("Loan amount fits lender range");
    }
    if (
      ops[i] != null &&
      opsMax > opsMin &&
      ops[i] === opsMin
    ) {
      chips.push("Faster processing time");
    }

    return {
      lender_id: x.lender.lender_id,
      displayRank: 0,
      displayScore: Math.round(score * 100) / 100,
      fitLabel: "backup",
      routeFit: route,
      costFit: cost,
      effectivePfPct: effPf[i],
      rationale: chips,
      premiereKnown: x.premiereKnown,
      isPremiere: x.isPremiere,
      _routeFit: route,
      _projectedRate: rois[i],
      _effPf: effPf[i],
      _coverageCount: trueCov,
      _projectedLoan: x.lender.projected_loan_amount ?? 0,
      _ops: ops[i],
      _lenderCode: x.lender.lender_code ?? "",
    };
  });

  scored.sort((a, b) => {
    if (b.displayScore !== a.displayScore) return b.displayScore - a.displayScore;
    if (b._routeFit !== a._routeFit) return b._routeFit - a._routeFit;
    const ar = a._projectedRate ?? Number.POSITIVE_INFINITY;
    const br = b._projectedRate ?? Number.POSITIVE_INFINITY;
    if (ar !== br) return ar - br;
    const ap = a._effPf ?? Number.POSITIVE_INFINITY;
    const bp = b._effPf ?? Number.POSITIVE_INFINITY;
    if (ap !== bp) return ap - bp;
    if (a.isPremiere !== b.isPremiere) return a.isPremiere ? -1 : 1;
    if (a._projectedLoan !== b._projectedLoan) return b._projectedLoan - a._projectedLoan;
    if (a._coverageCount !== b._coverageCount) return b._coverageCount - a._coverageCount;
    const ao = a._ops ?? Number.POSITIVE_INFINITY;
    const bo = b._ops ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    return a._lenderCode.localeCompare(b._lenderCode);
  });

  scored.forEach((s, i) => {
    s.displayRank = i + 1;
    if (s.displayScore >= 75) s.fitLabel = "best_fit";
    else if (s.displayScore >= 55) s.fitLabel = "good_fit";
    else s.fitLabel = "backup";
    // Tiny cohorts: ensure top eligible lender is at least good_fit when otherwise backup.
    if (i === 0 && s.fitLabel === "backup" && scored.length <= 2) {
      s.fitLabel = "good_fit";
    }
  });

  // Strip private fields
  return scored.map((s) => ({
    lender_id: s.lender_id,
    displayRank: s.displayRank,
    displayScore: s.displayScore,
    fitLabel: s.fitLabel,
    routeFit: s.routeFit,
    costFit: s.costFit,
    effectivePfPct: s.effectivePfPct,
    rationale: s.rationale,
    premiereKnown: s.premiereKnown,
    isPremiere: s.isPremiere,
  }));
}
