/**
 * Phase 2 — University Rank Modifier (display/projection overlay only).
 *
 * Pure helper. Does NOT mutate engine output, lender rules, eligibility,
 * commercials, or assignment. Applied AFTER `evaluate()` to adjust the
 * displayed projected loan amount and projected interest rate per lender,
 * based on the resolved university rank band.
 *
 * Master switch: ENABLE_RANK_MODIFIER. Set to `false` to disable the entire
 * overlay instantly (no DB rollback required).
 */

import type { BreLenderRule } from "./types";

export const ENABLE_RANK_MODIFIER = true;

export type RankBand =
  | "premium"
  | "tier_1" | "tier_2" | "tier_3" | "tier_4" | "tier_5"
  | "tier_6" | "tier_7" | "tier_8" | "tier_9" | "tier_10"
  | "unranked"
  | "no_match";

/** Loan amount modifier (% of base projected loan). */
export const RANK_LOAN_MODIFIER: Record<RankBand, number> = {
  premium: 0.15,
  tier_1: 0.12,
  tier_2: 0.10,
  tier_3: 0.07,
  tier_4: 0.04,
  tier_5: 0.00,
  tier_6: -0.05,
  tier_7: -0.10,
  tier_8: -0.15,
  tier_9: -0.20,
  tier_10: -0.25,
  unranked: -0.25,
  no_match: -0.25,
};

/** Interest rate modifier (absolute % points). */
export const RANK_RATE_MODIFIER: Record<RankBand, number> = {
  premium: -0.50,
  tier_1: -0.35,
  tier_2: -0.25,
  tier_3: -0.15,
  tier_4: -0.05,
  tier_5: 0.00,
  tier_6: 0.10,
  tier_7: 0.20,
  tier_8: 0.35,
  tier_9: 0.50,
  tier_10: 0.75,
  unranked: 0.75,
  no_match: 0.75,
};

const BAND_LABEL: Record<RankBand, string> = {
  premium: "Premium",
  tier_1: "Tier 1",
  tier_2: "Tier 2",
  tier_3: "Tier 3",
  tier_4: "Tier 4",
  tier_5: "Tier 5",
  tier_6: "Tier 6",
  tier_7: "Tier 7",
  tier_8: "Tier 8",
  tier_9: "Tier 9",
  tier_10: "Tier 10",
  unranked: "Unranked",
  no_match: "No Match",
};

export function normalizeRankBand(b: string | null | undefined): RankBand {
  if (!b) return "no_match";
  const k = String(b).trim().toLowerCase();
  if (k in RANK_LOAN_MODIFIER) return k as RankBand;
  return "no_match";
}

export interface RankModifierInput {
  band: RankBand;
  globalRank: number | null;
  baseProjectedLoan: number | null;
  baseProjectedRate: number | null;
  requestedLoan: number | null;
  productType: "secured" | "unsecured" | null;
  rule: BreLenderRule | null;
  /**
   * Display-only ROI range emitted by the engine for this lender.
   * Used as the rate clamp range when present.
   */
  roiRangeMin: number | null;
  roiRangeMax: number | null;
}

export interface RankModifierResult {
  enabled: boolean;
  band: RankBand;
  bandLabel: string;
  globalRank: number | null;
  loanModifierPct: number;          // e.g. +0.04 = +4%
  rateModifierPct: number;          // e.g. -0.05 = -0.05% absolute
  baseProjectedLoan: number | null;
  baseProjectedRate: number | null;
  adjustedProjectedLoan: number | null;
  adjustedProjectedRate: number | null;
  lenderMaxCap: number | null;
  lenderMinCap: number | null;
  clampApplied: string | null;      // e.g. "lender_max_cap" / "requested_loan" / "rate_min" / null
  explanation: string;              // human-readable line for Admin UI
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pickLenderCap(
  rule: BreLenderRule | null,
  productType: "secured" | "unsecured" | null,
): { min: number | null; max: number | null } {
  if (!rule || !productType) return { min: null, max: null };
  const cap = productType === "secured" ? rule.loan_caps?.secured : rule.loan_caps?.unsecured;
  return { min: cap?.min ?? null, max: cap?.max ?? null };
}

function pickRateRange(
  rule: BreLenderRule | null,
  productType: "secured" | "unsecured" | null,
  fallbackMin: number | null,
  fallbackMax: number | null,
): { min: number | null; max: number | null } {
  if (!rule) return { min: fallbackMin, max: fallbackMax };
  const p = rule.policy ?? ({} as BreLenderRule["policy"]);
  if (productType === "secured" && p.roi_secured_min != null && p.roi_secured_max != null) {
    return { min: p.roi_secured_min, max: p.roi_secured_max };
  }
  if (productType === "unsecured" && p.roi_unsecured_min != null && p.roi_unsecured_max != null) {
    return { min: p.roi_unsecured_min, max: p.roi_unsecured_max };
  }
  if (p.roi_min != null && p.roi_max != null) return { min: p.roi_min, max: p.roi_max };
  return { min: fallbackMin, max: fallbackMax };
}

export function applyRankModifier(input: RankModifierInput): RankModifierResult {
  const { band, globalRank, baseProjectedLoan, baseProjectedRate, requestedLoan } = input;
  const loanPct = RANK_LOAN_MODIFIER[band];
  const ratePct = RANK_RATE_MODIFIER[band];

  if (!ENABLE_RANK_MODIFIER) {
    return {
      enabled: false,
      band,
      bandLabel: BAND_LABEL[band],
      globalRank,
      loanModifierPct: 0,
      rateModifierPct: 0,
      baseProjectedLoan,
      baseProjectedRate,
      adjustedProjectedLoan: baseProjectedLoan,
      adjustedProjectedRate: baseProjectedRate,
      lenderMaxCap: null,
      lenderMinCap: null,
      clampApplied: null,
      explanation: "Rank modifier disabled.",
    };
  }

  // ---- Loan adjustment ----
  let adjLoan: number | null = null;
  let lenderCapMax: number | null = null;
  let lenderCapMin: number | null = null;
  const clamps: string[] = [];

  if (baseProjectedLoan != null && Number.isFinite(baseProjectedLoan) && baseProjectedLoan > 0) {
    const cap = pickLenderCap(input.rule, input.productType);
    lenderCapMax = cap.max;
    lenderCapMin = cap.min;
    let candidate = baseProjectedLoan * (1 + loanPct);
    // Never exceed requested loan
    if (requestedLoan != null && candidate > requestedLoan) {
      candidate = requestedLoan;
      clamps.push("requested_loan");
    }
    // Never exceed lender max cap
    if (lenderCapMax != null && candidate > lenderCapMax) {
      candidate = lenderCapMax;
      clamps.push("lender_max_cap");
    }
    // Never go below lender min
    if (lenderCapMin != null && candidate < lenderCapMin) {
      candidate = lenderCapMin;
      clamps.push("lender_min_cap");
    }
    if (candidate < 0) candidate = 0;
    adjLoan = round2(candidate);
  }

  // ---- Rate adjustment ----
  let adjRate: number | null = null;
  if (baseProjectedRate != null && Number.isFinite(baseProjectedRate)) {
    const range = pickRateRange(input.rule, input.productType, input.roiRangeMin, input.roiRangeMax);
    let candidate = baseProjectedRate + ratePct;
    if (range.min != null && candidate < range.min) {
      candidate = range.min;
      clamps.push("rate_min");
    }
    if (range.max != null && candidate > range.max) {
      candidate = range.max;
      clamps.push("rate_max");
    }
    adjRate = round2(candidate);
  }

  // ---- Explanation ----
  let explanation: string;
  if (band === "no_match" || band === "unranked") {
    explanation = `University rank impact: No exact rank available; fallback applied (${
      loanPct === 0 ? "no loan adjustment" : `loan ${loanPct > 0 ? "+" : ""}${(loanPct * 100).toFixed(0)}%`
    }, ${ratePct === 0 ? "no rate adjustment" : `rate ${ratePct > 0 ? "+" : ""}${ratePct.toFixed(2)}%`}).`;
  } else if (loanPct === 0 && ratePct === 0) {
    explanation = `University rank impact: ${
      globalRank != null ? `Rank #${globalRank}, ` : ""
    }${BAND_LABEL[band]} — no loan/rate adjustment.`;
  } else {
    const loanPart =
      loanPct === 0
        ? "no loan adjustment"
        : `loan projection ${loanPct > 0 ? "increased" : "reduced"} by ${Math.abs(loanPct * 100).toFixed(0)}%`;
    const ratePart =
      ratePct === 0
        ? "no rate adjustment"
        : `rate ${ratePct > 0 ? "increased" : "reduced"} by ${Math.abs(ratePct).toFixed(2)}%`;
    explanation = `University rank impact: ${
      globalRank != null ? `Rank #${globalRank}, ` : ""
    }${BAND_LABEL[band]} — ${loanPart}, ${ratePart}.`;
  }
  if (clamps.length > 0) {
    explanation += ` Clamp applied: ${Array.from(new Set(clamps)).join(", ")}.`;
  }

  return {
    enabled: true,
    band,
    bandLabel: BAND_LABEL[band],
    globalRank,
    loanModifierPct: loanPct,
    rateModifierPct: ratePct,
    baseProjectedLoan,
    baseProjectedRate,
    adjustedProjectedLoan: adjLoan,
    adjustedProjectedRate: adjRate,
    lenderMaxCap,
    lenderMinCap,
    clampApplied: clamps.length > 0 ? Array.from(new Set(clamps)).join(",") : null,
    explanation,
  };
}

/**
 * Resolve the rank band to apply for the lead, from the BuildProfileResolution
 * `university_match.effective_band` (Phase 1 already computes this).
 * Falls back to "no_match" when university_match is missing or "no_match"/"none".
 */
export function resolveRankBandFromResolution(
  um:
    | { kind: "by_id" | "fuzzy"; effective_band?: string | null; global_rank?: number | null }
    | { kind: "ambiguous" | "no_match" | "none"; [k: string]: unknown }
    | undefined
    | null,
): { band: RankBand; globalRank: number | null } {
  if (!um) return { band: "no_match", globalRank: null };
  if (um.kind === "by_id" || um.kind === "fuzzy") {
    return {
      band: normalizeRankBand((um as { effective_band?: string | null }).effective_band ?? null),
      globalRank: (um as { global_rank?: number | null }).global_rank ?? null,
    };
  }
  return { band: "no_match", globalRank: null };
}
