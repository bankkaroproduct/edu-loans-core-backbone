// BRE deterministic engine — pure TypeScript.
// Same input + same config + same lender rules → identical output, every run.
//
// 8-step contract (per spec section 4):
//  1. knockout pass per lender (geography, loan caps, CIBIL/age/income, collateral route)
//  2. score each bucket (student / university / coapplicant) → 0..100
//  3. approval gate: any bucket < threshold → Rejected
//  4. overall_score = simple average of three bucket scores
//  5. map overall_score → overall_band (loan range, rate range)
//  6. for each surviving lender: project loan amount + projected rate from band ∩ caps
//  7. rank by (projected_rate asc, projected_loan_amount desc, payout_pct desc)
//  8. return BreResult with full parameter trace

import type {
  Band,
  BreLenderRule,
  BreProfileInput,
  BreResult,
  BreScoringConfig,
  BucketKey,
  BucketResult,
  EnumBand,
  LenderMatchResult,
  NumericBand,
  OverallBandRow,
  ParameterTrace,
  ScoringParameter,
} from "./types";
import { REASON, getMaxCapForRoute } from "./reasons";

/**
 * Universal business cap for co-applicant age. Applied before per-lender
 * checks so a single rule covers all lenders even when individual
 * lender_rules have max_age = null.
 */
export const COAPPLICANT_AGE_CAP = 60;

const BUCKETS: { key: BucketKey; field: keyof BreScoringConfig }[] = [
  { key: "student", field: "student_params" },
  { key: "university", field: "university_params" },
  { key: "coapplicant", field: "coapplicant_params" },
];

function isNumericBand(b: Band): b is NumericBand {
  return typeof (b as NumericBand).from === "number" && typeof (b as NumericBand).to === "number";
}

function findMatchingBand(param: ScoringParameter, raw: unknown): Band | null {
  if (raw == null || raw === "") return null;
  if (param.input_type === "number") {
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    for (const b of param.bands) {
      if (isNumericBand(b) && n >= b.from && n <= b.to) return b;
    }
    return null;
  }
  // enum / boolean — match by stringified value
  const v = String(raw);
  for (const b of param.bands) {
    if (!isNumericBand(b) && (b as EnumBand).value === v) return b;
  }
  return null;
}

function scoreBucket(
  bucket: BucketKey,
  params: ScoringParameter[],
  inputs: Record<string, unknown>,
  threshold: number,
): BucketResult {
  const trace: ParameterTrace[] = [];
  let total = 0;
  for (const p of params) {
    const raw = inputs[p.param_key];
    const band = findMatchingBand(p, raw);
    const bandScore = band ? band.score : 0;
    const contribution = (p.weight * bandScore) / 100;
    total += contribution;
    trace.push({
      bucket,
      param_key: p.param_key,
      label: p.label,
      input: raw as ParameterTrace["input"],
      matched_band: band,
      weight: p.weight,
      band_score: bandScore,
      contribution: round2(contribution),
    });
  }
  total = round2(total);
  return { bucket, total, passes: total >= threshold, trace };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function mapOverallBand(score: number, mapping: OverallBandRow[]): OverallBandRow | null {
  for (const row of mapping) {
    if (score >= row.from && score <= row.to) return row;
  }
  return null;
}

function eligibilityStatusFromBand(band: OverallBandRow | null, anyBucketFailed: boolean): BreResult["eligibility_status"] {
  if (anyBucketFailed) return "Rejected";
  if (!band) return "Rejected";
  if (band.band === "A+" || band.band === "A") return "Approved";
  if (band.band === "B") return "Approved with conditions";
  if (band.band === "C") return "Borderline";
  return "Rejected";
}

function checkLenderKnockouts(
  lender: BreLenderRule,
  profile: BreProfileInput,
): { eligible: boolean; reasons: string[]; product_type: "secured" | "unsecured" | null } {
  const reasons: string[] = [];

  // 1. country (supported list)
  const countries = lender.coverage.supported_countries || [];
  if (countries.length > 0 && !countries.includes(profile.destination_country)) {
    reasons.push(REASON.country_not_supported(profile.destination_country));
  }

  // 1b. country (excluded list — explicit deny overrides)
  const excludedCountries = lender.coverage.excluded_countries || [];
  if (excludedCountries.length > 0 && excludedCountries.includes(profile.destination_country)) {
    reasons.push(REASON.country_excluded(profile.destination_country));
  }

  // 2. excluded states (legacy + new Indian state list)
  if (profile.state && (lender.coverage.excluded_states || []).includes(profile.state)) {
    reasons.push(REASON.state_excluded(profile.state));
  }
  if (profile.state && (lender.coverage.excluded_indian_states || []).includes(profile.state)) {
    reasons.push(REASON.state_excluded(profile.state));
  }

  // 2b. excluded Indian cities
  if (profile.city && (lender.coverage.excluded_indian_cities || []).includes(profile.city)) {
    reasons.push(REASON.city_excluded(profile.city));
  }

  // 3. accepted courses (only enforce if the list is non-empty)
  const accepted = lender.coverage.accepted_courses || [];
  if (accepted.length > 0 && profile.course_category && !accepted.includes(profile.course_category)) {
    reasons.push(REASON.course_not_accepted(profile.course_category));
  }

  // 4. determine product_type from collateral route + lender support
  const wantsSecured = profile.collateral_route === "secured" || profile.collateral_route === "either";
  const wantsUnsecured = profile.collateral_route === "unsecured" || profile.collateral_route === "either" || !profile.collateral_route;
  const securedCap = lender.loan_caps?.secured;
  const unsecuredCap = lender.loan_caps?.unsecured;
  const securedAvailable = wantsSecured && securedCap && (securedCap.min != null || securedCap.max != null);
  const unsecuredAvailable = wantsUnsecured && unsecuredCap && (unsecuredCap.min != null || unsecuredCap.max != null);

  let product_type: "secured" | "unsecured" | null = null;
  let appliedCap = null as null | { min: number | null; max: number | null };

  // Prefer secured if both available (lower rate typically); deterministic tie-break
  if (securedAvailable) {
    product_type = "secured";
    appliedCap = securedCap;
  } else if (unsecuredAvailable) {
    product_type = "unsecured";
    appliedCap = unsecuredCap;
  } else {
    if (profile.collateral_route && profile.collateral_route !== "either") {
      reasons.push(REASON.collateral_route_not_supported(profile.collateral_route));
    } else {
      reasons.push(REASON.collateral_route_not_supported("any"));
    }
  }

  // 5. loan amount caps
  if (appliedCap) {
    if (appliedCap.min != null && profile.loan_amount < appliedCap.min) {
      reasons.push(REASON.loan_below_min(appliedCap.min));
    }
    if (appliedCap.max != null && profile.loan_amount > appliedCap.max) {
      reasons.push(REASON.loan_above_max(appliedCap.max));
    }
  }

  // 6. CIBIL
  const cibil = profile.coapplicant?.cibil_score as number | null | undefined;
  if (lender.hard_thresholds.min_cibil != null && cibil != null && cibil < lender.hard_thresholds.min_cibil) {
    reasons.push(REASON.cibil_too_low(lender.hard_thresholds.min_cibil));
  }

  // 7. age
  const age = profile.coapplicant?.age as number | null | undefined;
  if (lender.hard_thresholds.min_age != null && age != null && age < lender.hard_thresholds.min_age) {
    reasons.push(REASON.age_below_min(lender.hard_thresholds.min_age));
  }
  if (lender.hard_thresholds.max_age != null && age != null && age > lender.hard_thresholds.max_age) {
    reasons.push(REASON.age_above_max(lender.hard_thresholds.max_age));
  }

  // 8. min co-applicant income
  const income = profile.coapplicant?.monthly_income as number | null | undefined;
  if (lender.hard_thresholds.min_coapplicant_income != null && income != null) {
    const annual = income * 12;
    if (annual < lender.hard_thresholds.min_coapplicant_income) {
      reasons.push(REASON.income_below_min(lender.hard_thresholds.min_coapplicant_income));
    }
  }

  // 9. relationship allow-list
  const rel = profile.coapplicant?.relationship as string | null | undefined;
  const allowedRels = lender.hard_thresholds.allowed_relationships || null;
  if (allowedRels && rel && !allowedRels.includes(rel)) {
    reasons.push(REASON.relationship_not_allowed(rel));
  }

  return { eligible: reasons.length === 0, reasons, product_type };
}

function projectLoanAndRate(
  lender: BreLenderRule,
  product_type: "secured" | "unsecured" | null,
  band: OverallBandRow | null,
  profile: BreProfileInput,
): {
  projected_loan: number | null;
  projected_rate: number | null;
  roi_range_min: number | null;
  roi_range_max: number | null;
  roi_range_source: "secured" | "unsecured" | "policy" | "band" | null;
} {
  if (!band || !product_type)
    return {
      projected_loan: null,
      projected_rate: null,
      roi_range_min: null,
      roi_range_max: null,
      roi_range_source: null,
    };

  const cap = product_type === "secured" ? lender.loan_caps.secured : lender.loan_caps.unsecured;
  const lenderMin = cap.min ?? band.loan_min;
  const lenderMax = cap.max ?? band.loan_max;

  // Effective range = intersection of band and lender cap
  const effMin = Math.max(band.loan_min, lenderMin);
  const effMax = Math.min(band.loan_max, lenderMax);
  if (effMax < effMin)
    return {
      projected_loan: null,
      projected_rate: null,
      roi_range_min: null,
      roi_range_max: null,
      roi_range_source: null,
    };

  const projected_loan = Math.min(Math.max(profile.loan_amount, effMin), effMax);

  // Rate selection precedence (deterministic) — UNCHANGED logic:
  // 1) product_type-specific ROI (secured / unsecured) if both bounds present
  // 2) generic policy.roi_min/max if present
  // 3) overall band rate range (existing fallback)
  let rateMin: number;
  let rateMax: number;
  let roi_range_source: "secured" | "unsecured" | "policy" | "band";
  const sMin = lender.policy.roi_secured_min;
  const sMax = lender.policy.roi_secured_max;
  const uMin = lender.policy.roi_unsecured_min;
  const uMax = lender.policy.roi_unsecured_max;
  if (product_type === "secured" && sMin != null && sMax != null) {
    rateMin = sMin;
    rateMax = sMax;
    roi_range_source = "secured";
  } else if (product_type === "unsecured" && uMin != null && uMax != null) {
    rateMin = uMin;
    rateMax = uMax;
    roi_range_source = "unsecured";
  } else if (lender.policy.roi_min != null && lender.policy.roi_max != null) {
    rateMin = lender.policy.roi_min;
    rateMax = lender.policy.roi_max;
    roi_range_source = "policy";
  } else {
    rateMin = band.rate_min;
    rateMax = band.rate_max;
    roi_range_source = "band";
  }
  const projected_rate = round2((rateMin + rateMax) / 2);

  return {
    projected_loan,
    projected_rate,
    roi_range_min: round2(rateMin),
    roi_range_max: round2(rateMax),
    roi_range_source,
  };
}

export function evaluate(
  profile: BreProfileInput,
  cfg: BreScoringConfig,
  lenderRules: BreLenderRule[],
): BreResult {
  // 1+2. Score buckets
  const buckets: Record<BucketKey, BucketResult> = {
    student: scoreBucket("student", cfg.student_params, profile.student, cfg.bucket_threshold),
    university: scoreBucket("university", cfg.university_params, profile.university, cfg.bucket_threshold),
    coapplicant: scoreBucket("coapplicant", cfg.coapplicant_params, profile.coapplicant, cfg.bucket_threshold),
  };

  // 3. Approval gate
  const failedBuckets = (Object.values(buckets) as BucketResult[]).filter((b) => !b.passes);
  const rejection_reasons: string[] = failedBuckets.map((b) =>
    REASON.bucket_below_threshold(b.bucket, b.total, cfg.bucket_threshold),
  );

  // 4. Overall score (simple average per spec)
  const overall_score = round2(
    (buckets.student.total + buckets.university.total + buckets.coapplicant.total) / 3,
  );

  // 5. Overall band
  const overall_band = mapOverallBand(overall_score, cfg.overall_band_mapping);
  if (!overall_band) rejection_reasons.push(REASON.no_overall_band());

  let eligibility_status = eligibilityStatusFromBand(overall_band, failedBuckets.length > 0);

  // ---- Pre-scoring universal guard: co-applicant age cap (Bug 2) ----
  const coAge = profile.coapplicant?.age;
  const ageCapBreached =
    typeof coAge === "number" && Number.isFinite(coAge) && coAge > COAPPLICANT_AGE_CAP;
  if (ageCapBreached) {
    rejection_reasons.unshift(REASON.coapplicant_age_cap(coAge as number, COAPPLICANT_AGE_CAP));
    eligibility_status = "Rejected";
  }

  // 1+6. Lender knockout + projection (only meaningful if approved)
  const allLenderResults: LenderMatchResult[] = lenderRules
    .filter((r) => r.basic_info?.active !== false)
    .map((lender) => {
      const ko = checkLenderKnockouts(lender, profile);
      // Apply universal age-cap knockout to every lender
      if (ageCapBreached) {
        ko.eligible = false;
        ko.reasons = [REASON.coapplicant_age_cap(coAge as number, COAPPLICANT_AGE_CAP), ...ko.reasons];
      }
      const proj = ko.eligible
        ? projectLoanAndRate(lender, ko.product_type, overall_band, profile)
        : {
            projected_loan: null,
            projected_rate: null,
            roi_range_min: null,
            roi_range_max: null,
            roi_range_source: null,
          };
      return {
        lender_id: lender.lender_id,
        lender_name: lender.basic_info.lender_name,
        lender_code: lender.basic_info.lender_code,
        eligible: ko.eligible && eligibility_status !== "Rejected",
        reasons: eligibility_status === "Rejected" ? [...ko.reasons, ...rejection_reasons] : ko.reasons,
        product_type: ko.product_type,
        projected_loan_amount: proj.projected_loan,
        projected_rate: proj.projected_rate,
        payout_pct: lender.commercials.payout_pct,
        rank: null,
        badge: null,
        // Descriptive pass-through only — not used by scoring/ranking/eligibility.
        coverage_expenses: lender.coverage?.expenses,
        // Display-only ROI range (pass-through). Not used in ranking/scoring/eligibility.
        roi_range_min: proj.roi_range_min,
        roi_range_max: proj.roi_range_max,
        roi_range_source: proj.roi_range_source,
        // Display-only PF pass-through (commercials → result). Not used in ranking.
        pf_pct: lender.commercials.processing_fee_pct ?? null,
        pf_pct_min: lender.commercials.processing_fee_pct_min ?? null,
        pf_pct_max: lender.commercials.processing_fee_pct_max ?? null,
        pf_flat: lender.commercials.processing_fee_flat ?? null,
        pf_gst_applicable: lender.commercials.processing_fee_gst_applicable ?? null,
      };
    });

  // 7. Rank eligible lenders (deterministic tie-break: rate asc, loan desc, payout desc, lender_code asc)
  const eligible = allLenderResults.filter((r) => r.eligible);
  eligible.sort((a, b) => {
    const ar = a.projected_rate ?? Number.POSITIVE_INFINITY;
    const br = b.projected_rate ?? Number.POSITIVE_INFINITY;
    if (ar !== br) return ar - br;
    const al = a.projected_loan_amount ?? 0;
    const bl = b.projected_loan_amount ?? 0;
    if (al !== bl) return bl - al;
    const ap = a.payout_pct ?? 0;
    const bp = b.payout_pct ?? 0;
    if (ap !== bp) return bp - ap;
    return a.lender_code.localeCompare(b.lender_code);
  });
  eligible.forEach((r, i) => {
    r.rank = i + 1;
    r.badge = i === 0 ? "best_match" : i < 3 ? "strong" : "backup";
  });

  // Merge ranks back into all results array (preserve original order for ineligibles)
  const rankById = new Map(eligible.map((r) => [r.lender_id, r] as const));
  const eligible_lenders = allLenderResults.map((r) => rankById.get(r.lender_id) ?? r);

  // Determine collateral_route summary
  let collateral_route: BreResult["collateral_route"] = null;
  const hasSecured = eligible.some((r) => r.product_type === "secured");
  const hasUnsecured = eligible.some((r) => r.product_type === "unsecured");
  if (hasSecured && hasUnsecured) collateral_route = "both";
  else if (hasSecured) collateral_route = "secured";
  else if (hasUnsecured) collateral_route = "unsecured";

  // ---- Post-scoring hard-gate override (Bug 1) ----
  // A profile that scores high but has zero fundable lenders, missing
  // destination country, or missing/invalid loan amount must be Rejected.
  const missingCountry = !profile.destination_country || String(profile.destination_country).trim() === "";
  const missingLoan = !(typeof profile.loan_amount === "number" && profile.loan_amount > 0);
  const noEligibleLender = eligible.length === 0;

  if (missingCountry) rejection_reasons.unshift(REASON.missing_destination_country());
  if (missingLoan) rejection_reasons.unshift(REASON.missing_loan_amount());

  // ---- Dynamic global loan-cap message (Bug 3) ----
  // If the loan amount exceeds every lender's cap for the chosen route,
  // surface the real global maximum (not the first lender's cap) at the top.
  if (!missingLoan) {
    const route = profile.collateral_route ?? "either";
    const globalMax = getMaxCapForRoute(lenderRules, route);
    if (globalMax != null && profile.loan_amount > globalMax) {
      rejection_reasons.unshift(
        REASON.loan_above_global_max(profile.loan_amount, globalMax, route),
      );
    }
  }

  if (missingCountry || missingLoan || noEligibleLender) {
    if (eligibility_status !== "Rejected") {
      rejection_reasons.unshift(REASON.hard_gate_failed());
      eligibility_status = "Rejected";
    }
  }

  return {
    scoring_config_version: cfg.version_number,
    buckets,
    overall_score,
    overall_band,
    eligibility_status,
    rejection_reasons,
    eligible_loan_range: overall_band ? { min: overall_band.loan_min, max: overall_band.loan_max } : null,
    indicative_rate_range: overall_band ? { min: overall_band.rate_min, max: overall_band.rate_max } : null,
    collateral_route,
    eligible_lenders,
    best_match_lender_id: eligible.length > 0 ? eligible[0].lender_id : null,
  };
}
