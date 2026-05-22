// Realistic ranges on academic + test-score fields. Test-score limits are
// re-exported from `testScoreLimits.ts` so the UI inputs (admin AddLead,
// student education form) and submit-time validation share one source.

import { TEST_SCORE_LIMITS } from "@/lib/testScoreLimits";

export { TEST_SCORE_LIMITS, validateTestScore } from "@/lib/testScoreLimits";

export interface ScoreRange {
  min: number;
  max: number;
  /** Human label for error messages (e.g. "IELTS"). */
  label: string;
  /** Whether decimals are allowed (display hint only — validation uses min/max). */
  decimals?: boolean;
}

/** Test-score ranges (keys match `test_scores` JSONB keys). Derived from TEST_SCORE_LIMITS. */
export const TEST_SCORE_RANGES: Record<string, ScoreRange> = Object.fromEntries(
  Object.entries(TEST_SCORE_LIMITS).map(([k, l]) => [
    k,
    { min: l.min, max: l.max, label: l.label, decimals: l.step < 1 },
  ]),
);

/**
 * Academic raw-score / total fields. Score has no absolute max because
 * it depends on the companion total; cross-field check enforces score ≤ total
 * and, when total is blank, score ≤ 100 (percentage interpretation).
 */
export const ACADEMIC_TOTAL_RANGE: ScoreRange = { min: 0.01, max: 1000, label: "Total marks/scale", decimals: true };
export const ACADEMIC_PERCENTAGE_MAX = 100;
export const WORK_EXPERIENCE_YEARS_RANGE: ScoreRange = { min: 0, max: 60, label: "Work experience (years)" };

/** Bulk-upload column → range. Mirrors what the inline edit enforces. */
export const BULK_NUMERIC_MAX = {
  score_obtained: 1000, // Hard cap independent of total; cross-check still applies
  total_marks: 1000,
  qual_score: 1000,
  qual_total: 1000,
  coapplicant_emi: 10_000_000,
} as const;

export function rangeError(label: string, min: number, max: number): string {
  return `${label} must be between ${min} and ${max}.`;
}

/**
 * Validate a map of test-score values (any keys; non-test keys are ignored).
 * Returns the first error encountered, or null when all values are valid/blank.
 */
export function validateTestScoresMap(
  scores: Record<string, unknown> | null | undefined,
): string | null {
  if (!scores) return null;
  for (const [key, range] of Object.entries(TEST_SCORE_RANGES)) {
    const raw = scores[key];
    if (raw === null || raw === undefined || String(raw).trim() === "") continue;
    const s = String(raw).replace(/,/g, "").trim();
    if (!/^\d+(\.\d{1,3})?$/.test(s)) {
      return `${range.label} must be a realistic numeric value.`;
    }
    const n = Number(s);
    if (!Number.isFinite(n) || n < range.min || n > range.max) {
      return `${range.label} must be between ${range.min} and ${range.max}.`;
    }
  }
  return null;
}
