// Single source of truth for standardized test-score input limits.
// Used by admin AddLead, student education form, and validateTestScoresMap.
// Keys match `test_scores` JSONB keys.

export interface TestScoreLimit {
  /** Display label for error messages. */
  label: string;
  min: number;
  max: number;
  /** HTML input step attribute. 0.5 allows half-band IELTS scores. */
  step: number;
}

export const TEST_SCORE_LIMITS: Record<string, TestScoreLimit> = {
  ielts: { label: "IELTS", min: 0, max: 9, step: 0.5 },
  toefl: { label: "TOEFL", min: 0, max: 120, step: 1 },
  pte: { label: "PTE", min: 0, max: 90, step: 1 },
  duolingo: { label: "Duolingo", min: 0, max: 160, step: 1 },
  gre: { label: "GRE", min: 0, max: 340, step: 1 },
  gmat: { label: "GMAT", min: 0, max: 800, step: 1 },
};

/**
 * Validate a single test-score value. Blank/undefined is treated as valid
 * (these inputs are optional). Returns an error message when out-of-range.
 */
export function validateTestScore(
  key: string,
  value: string | number | null | undefined,
): string | null {
  const limit = TEST_SCORE_LIMITS[key];
  if (!limit) return null;
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const s = String(value).replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,3})?$/.test(s)) {
    return `${limit.label} must be a number.`;
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n < limit.min || n > limit.max) {
    return `${limit.label} must be between ${limit.min} and ${limit.max}.`;
  }
  return null;
}
