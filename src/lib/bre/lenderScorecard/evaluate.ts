// Pure evaluator for lender-specific BRE Layer 2.
// Additive output only — does NOT modify Generic BRE behavior, ranking,
// recommendation_rank, fit_category, or persisted lead data.

import type { BreLenderRule, BreProfileInput, LenderMatchResult } from "../types";
import {
  scoreAcademics,
  scoreBacklogs,
  scoreCibil,
  scoreCollateralRoute,
  scoreCoverage,
  scoreFoir,
  scoreIncome,
  scoreIncomeStability,
  scoreLoanAmountFit,
  scoreProcessingOps,
  scoreUniversityCourse,
} from "./bands";
import { buildRationale } from "./rationale";
import { DEFAULT_WEIGHTS, getSeedForLender, type ScorecardSeed } from "./seeds";
import type {
  FactorComponent,
  LenderRiskBand,
  LenderScorecardOutput,
  ProvenanceTag,
} from "./types";

const SCORECARD_VERSION = "lender-scorecard@v1";

function pickScorecardConfig(lender: BreLenderRule): ScorecardSeed {
  // If lender row carries a stored scorecard, prefer it (shape-checked best-effort).
  const stored = (lender as unknown as { scorecard?: unknown }).scorecard;
  if (stored && typeof stored === "object") {
    const s = stored as Partial<ScorecardSeed>;
    if (Array.isArray(s.weights) && s.weights.length > 0 && typeof s.income_floor_monthly === "number") {
      return {
        lender_code: lender.basic_info.lender_code,
        display_label: s.display_label ?? "Custom scorecard",
        weights: s.weights,
        income_floor_monthly: s.income_floor_monthly,
        income_floor_provenance: (s.income_floor_provenance as ProvenanceTag) ?? "proposed",
        notes: s.notes,
      };
    }
  }
  return getSeedForLender(lender.basic_info.lender_code);
}

function bandFromScore(score: number, eligible: boolean): LenderRiskBand {
  if (!eligible) return "Not Eligible";
  if (score >= 75) return "Low Risk";
  if (score >= 55) return "Medium Risk";
  if (score >= 35) return "High Risk";
  return "Needs Review";
}

function worstProvenance(tags: ProvenanceTag[]): ProvenanceTag {
  const order: ProvenanceTag[] = ["source_backed", "inferred", "proposed", "needs_business_validation"];
  let worst: ProvenanceTag = "source_backed";
  for (const t of tags) if (order.indexOf(t) > order.indexOf(worst)) worst = t;
  return worst;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function evaluateLenderScorecard(
  profile: BreProfileInput,
  lender: BreLenderRule,
  match: LenderMatchResult,
): LenderScorecardOutput {
  const cfg = pickScorecardConfig(lender);
  const weights = cfg.weights.length > 0 ? cfg.weights : DEFAULT_WEIGHTS;

  // Inputs
  const co = profile.coapplicant ?? {};
  const stu = profile.student ?? {};
  const uni = profile.university ?? {};
  const cibil = (co.cibil_score as number | null | undefined) ?? null;
  const monthlyIncome = (co.monthly_income as number | null | undefined) ?? null;
  const monthlyEmi =
    (co.existing_emi as number | null | undefined) ??
    (co.monthly_emi as number | null | undefined) ??
    null;
  const employmentType = (co.employment_type as string | null | undefined) ?? null;
  const itrYears = (co.itr_years as number | null | undefined) ?? null;
  const classX = (stu.class_x_pct as number | null | undefined) ?? null;
  const classXII = (stu.class_xii_pct as number | null | undefined) ?? null;
  const grad = (stu.grad_pct as number | null | undefined) ?? null;
  const backlogs = (stu.backlogs as number | null | undefined) ?? null;
  const tier = (uni.tier as string | null | undefined) ?? null;
  const isPremiere = (uni.is_premiere as boolean | null | undefined) ?? null;
  const hasCollateral = profile.collateral_route === "secured";
  const collateralNotes = (profile as unknown as { collateral_notes?: string | null }).collateral_notes ?? null;

  const cap = match.product_type === "secured" ? lender.loan_caps.secured : match.product_type === "unsecured" ? lender.loan_caps.unsecured : { min: null, max: null };
  const countrySupported = (lender.coverage.supported_countries || []).length === 0 || (lender.coverage.supported_countries || []).includes(profile.destination_country);
  const courseAccepted = (lender.coverage.accepted_courses || []).length === 0 || (profile.course_category ? (lender.coverage.accepted_courses || []).includes(profile.course_category) : true);

  // Score factors
  const cibilB = scoreCibil(cibil);
  const incomeB = scoreIncome(monthlyIncome, cfg.income_floor_monthly, cfg.income_floor_provenance);
  const foirB = scoreFoir(monthlyIncome, monthlyEmi);
  const stabilityB = scoreIncomeStability(employmentType, itrYears);
  const academicsB = scoreAcademics(classX, classXII, grad);
  const backlogsB = scoreBacklogs(backlogs);
  const uniB = scoreUniversityCourse(tier, isPremiere ?? false);
  const collatB = scoreCollateralRoute(match.product_type, hasCollateral, collateralNotes);
  const fitB = scoreLoanAmountFit(profile.loan_amount, cap.min ?? null, cap.max ?? null);
  const covB = scoreCoverage(countrySupported, courseAccepted);
  const opsB = scoreProcessingOps();

  const map: Record<string, { raw: number; prov: ProvenanceTag; note?: string }> = {
    cibil: { raw: cibilB.raw_score, prov: cibilB.provenance, note: cibilB.note },
    income: { raw: incomeB.raw_score, prov: incomeB.provenance, note: incomeB.note },
    emi_foir: { raw: foirB.raw_score, prov: foirB.provenance, note: foirB.note },
    income_stability: { raw: stabilityB.raw_score, prov: stabilityB.provenance, note: stabilityB.note },
    academics: { raw: academicsB.raw_score, prov: academicsB.provenance, note: academicsB.note },
    backlogs: { raw: backlogsB.raw_score, prov: backlogsB.provenance, note: backlogsB.note },
    university_course: { raw: uniB.raw_score, prov: uniB.provenance, note: uniB.note },
    collateral_route: { raw: collatB.raw_score, prov: collatB.provenance, note: collatB.note },
    loan_amount_fit: { raw: fitB.raw_score, prov: fitB.provenance, note: fitB.note },
    coverage: { raw: covB.raw_score, prov: covB.provenance, note: covB.note },
    processing_ops: { raw: opsB.raw_score, prov: opsB.provenance, note: opsB.note },
  };

  const totalWeight = weights.reduce((a, w) => a + w.weight, 0) || 100;
  const breakdown: FactorComponent[] = weights.map((w) => {
    const m = map[w.factor];
    const raw = m?.raw ?? 50;
    const weighted = (raw * w.weight) / totalWeight;
    const prov = worstProvenance([w.provenance, m?.prov ?? "inferred"]);
    return {
      factor: w.factor,
      weight: w.weight,
      raw_score: Math.round(raw),
      weighted: Math.round(weighted * 100) / 100,
      provenance: prov,
      note: m?.note,
    };
  });

  const score = Math.round(breakdown.reduce((a, c) => a + c.weighted, 0));
  const eligible = match.eligible;
  const risk_band = bandFromScore(score, eligible);

  // Risk-based indicative ROI — clamp inside the route ROI range. Never use Effective ROI.
  let risk_roi: number | null = null;
  if (match.roi_range_min != null && match.roi_range_max != null && score >= 0) {
    const lo = match.roi_range_min;
    const hi = match.roi_range_max;
    // Higher score → closer to lo; lower score → closer to hi.
    const t = clamp((100 - score) / 100, 0, 1);
    risk_roi = Math.round((lo + t * (hi - lo)) * 100) / 100;
    risk_roi = clamp(risk_roi, lo, hi);
  }

  const incomeBelowFloor = monthlyIncome != null && Number(monthlyIncome) < cfg.income_floor_monthly;
  const rationale = buildRationale(breakdown, {
    routeMatch: match.product_type != null && (profile.collateral_route === "either" || profile.collateral_route === match.product_type || !profile.collateral_route),
    collateralNotesMissing: hasCollateral && (!collateralNotes || String(collateralNotes).trim() === ""),
    premiereMatch: isPremiere === true,
    loanFitsCap: (cap.min == null || profile.loan_amount >= cap.min) && (cap.max == null || profile.loan_amount <= cap.max),
    incomeBelowFloor,
    coverageOk: countrySupported && courseAccepted,
  });

  const overallProv = worstProvenance(breakdown.map((b) => b.provenance));

  return {
    lender_specific_score: score,
    lender_risk_band: risk_band,
    risk_based_indicative_roi: risk_roi,
    lender_indicative_roi: risk_roi,
    lender_specific_rationale: rationale,
    lender_rationale_chips: rationale,
    score_breakdown: breakdown,
    scorecard_provenance: overallProv,
    scorecard_version: SCORECARD_VERSION,
  };
}
