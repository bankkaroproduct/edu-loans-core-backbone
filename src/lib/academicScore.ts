// Shared helpers for normalizing academic scores using a (score, total) pair.
//
// Used by:
//   - Add Lead forms (Student / Partner / Admin) for live preview + validation
//   - Lead detail display
//   - BRE profile builder (`src/lib/bre/leadProfile.ts`) for the
//     `student.graduation_marks` input, with effective-score logic that
//     averages Graduation and Highest Qualification when both are provided.

/** Parse a numeric string into a finite number, returning null otherwise. */
export function parseNum(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  if (!s) return null;
  // Pull the first numeric token (allows "85%", "9.5 CGPA", etc.).
  const m = s.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

export type ScoreNormalizationSource =
  | "score_total"   // both score and total provided → score / total * 100
  | "legacy_parse"  // score-only fallback (≤10 ×9.5 heuristic, etc.)
  | "none";

export interface NormalizedScore {
  /** 0–100 percentage, or null when not derivable */
  percentage: number | null;
  source: ScoreNormalizationSource;
  /** Echoes the score as a finite number when parsed (display use) */
  scoreNum: number | null;
  /** Echoes the total as a finite number when parsed (display use) */
  totalNum: number | null;
}

/**
 * Normalize an academic score using score/total when both are present.
 * Falls back to legacy heuristics when total is missing:
 *   - score ≤ 10 → treat as a 10-point GPA → ×9.5
 *   - score > 10 → treat as already a percentage
 * Returns { percentage: null, source: "none" } when score is missing.
 */
export function normalizeAcademicScore(
  rawScore: unknown,
  rawTotal: unknown,
): NormalizedScore {
  const scoreNum = parseNum(rawScore);
  const totalNum = parseNum(rawTotal);

  if (scoreNum != null && totalNum != null && totalNum > 0 && scoreNum >= 0 && scoreNum <= totalNum) {
    const pct = Math.round((scoreNum / totalNum) * 100 * 100) / 100;
    return { percentage: pct, source: "score_total", scoreNum, totalNum };
  }

  if (scoreNum != null) {
    const pct = scoreNum <= 10
      ? Math.round(scoreNum * 9.5 * 100) / 100
      : Math.round(scoreNum * 100) / 100;
    return { percentage: pct, source: "legacy_parse", scoreNum, totalNum: null };
  }

  return { percentage: null, source: "none", scoreNum: null, totalNum: null };
}

/**
 * Validate a (score, total) pair from a form input. Both inputs are optional;
 * when total is provided alone or score is provided alone, the pair is
 * accepted (legacy single-value path). Returns null on success, or a short
 * inline error message describing the first violation.
 */
export function validateScoreTotalPair(rawScore: string, rawTotal: string): string | null {
  const sTrim = (rawScore ?? "").toString().trim();
  const tTrim = (rawTotal ?? "").toString().trim();
  if (!sTrim && !tTrim) return null;
  const scoreNum = parseNum(sTrim);
  const totalNum = parseNum(tTrim);
  if (sTrim && scoreNum == null) return "Score must be a number";
  if (tTrim && totalNum == null) return "Total marks must be a number";
  if (totalNum != null && totalNum <= 0) return "Total marks must be greater than 0";
  if (scoreNum != null && scoreNum < 0) return "Score cannot be negative";
  if (scoreNum != null && totalNum != null && scoreNum > totalNum) {
    return "Score cannot exceed total marks";
  }
  return null;
}

/**
 * Detect whether a "Highest Qualification" string represents a graduation /
 * bachelor's level (Graduation, Bachelors, B.Tech, B.E, B.Com, B.Sc, B.A, BBA,
 * LLB, undergraduate, etc.). Used by the BRE builder to decide whether the
 * Highest Qualification score can substitute for Graduation marks when
 * Graduation marks were not captured.
 */
export function isHighestQualificationGraduationLevel(hq: string | null | undefined): boolean {
  if (!hq) return false;
  const v = String(hq).toLowerCase();
  return /\b(graduat|bachelor|b\.?tech|b\.?e\b|b\.?com|b\.?sc|b\.?a\b|bba|llb|undergrad)/.test(v);
}

export type EffectiveAcademicSource =
  | "both_averaged"
  | "graduation_only"
  | "hq_as_graduation"
  | "legacy_marks_gpa"
  | "none";

export interface EffectiveAcademicResult {
  /** Percentage fed into BRE `student.graduation_marks` (0–100), or null. */
  effective: number | null;
  graduation: NormalizedScore;
  highestQualification: NormalizedScore;
  source: EffectiveAcademicSource;
  /** Human-readable reason surfaced in the BRE detailed breakdown. */
  reason: string;
  /** Legacy `marks_gpa` value used as a last-resort fallback (display only). */
  legacyMarksGpaUsed?: string | null;
}

/**
 * Compute the effective academic score for BRE, considering Graduation +
 * Highest Qualification together.
 *
 * Logic:
 *   1. Both present → average of both normalized percentages.
 *   2. Only Graduation present → use Graduation.
 *   3. Only Highest Qualification present → use HQ as the academic input
 *      (whether or not the qualification is graduation-level — both flows are
 *      treated the same; the reason text adapts to clarify intent).
 *   4. Both missing → fall back to legacy `marks_gpa` if present, otherwise
 *      none (engine treats as missing).
 */
export function computeEffectiveAcademicScore(args: {
  graduationScore: unknown;
  graduationTotal: unknown;
  highestQualificationScore: unknown;
  highestQualificationTotal: unknown;
  highestQualificationLabel?: string | null;
  legacyMarksGpa?: string | null;
}): EffectiveAcademicResult {
  const grad = normalizeAcademicScore(args.graduationScore, args.graduationTotal);
  const hq = normalizeAcademicScore(args.highestQualificationScore, args.highestQualificationTotal);

  if (grad.percentage != null && hq.percentage != null) {
    const eff = Math.round(((grad.percentage + hq.percentage) / 2) * 100) / 100;
    return {
      effective: eff,
      graduation: grad,
      highestQualification: hq,
      source: "both_averaged",
      reason:
        "Graduation and Highest Qualification scores were both provided, so both were considered.",
    };
  }

  if (grad.percentage != null && hq.percentage == null) {
    return {
      effective: grad.percentage,
      graduation: grad,
      highestQualification: hq,
      source: "graduation_only",
      reason: "Graduation score used.",
    };
  }

  if (grad.percentage == null && hq.percentage != null) {
    const isGradLevel = isHighestQualificationGraduationLevel(args.highestQualificationLabel ?? null);
    return {
      effective: hq.percentage,
      graduation: grad,
      highestQualification: hq,
      source: "hq_as_graduation",
      reason: isGradLevel
        ? "Graduation score derived from Highest Qualification (qualification level is Graduation/Bachelor)."
        : "Graduation score not provided; Highest Qualification score used as the academic input.",
    };
  }

  // Both missing — try legacy marks_gpa.
  const legacy = (args.legacyMarksGpa ?? "").toString().trim();
  if (legacy) {
    const legacyNum = parseNum(legacy);
    if (legacyNum != null) {
      // Mirror existing parseGpa heuristic: if explicitly tagged "gpa" or value
      // ≤ 10, treat as 10-point GPA → ×9.5.
      const tagged = legacy.toLowerCase().includes("gpa") || legacyNum <= 10;
      const pct = tagged
        ? Math.round(legacyNum * 9.5 * 100) / 100
        : Math.round(legacyNum * 100) / 100;
      return {
        effective: pct,
        graduation: grad,
        highestQualification: hq,
        source: "legacy_marks_gpa",
        reason: "Legacy Marks / GPA field used.",
        legacyMarksGpaUsed: legacy,
      };
    }
  }

  return {
    effective: null,
    graduation: grad,
    highestQualification: hq,
    source: "none",
    reason: "Academic score not provided.",
  };
}

/** Format a co-applicant work-exp pair (years, months) for display. */
export function formatCoapplicantWorkExperience(
  years: number | string | null | undefined,
  months: number | string | null | undefined,
): string | null {
  const y = parseNum(years);
  const m = parseNum(months);
  if ((y == null || y === 0) && (m == null || m === 0)) {
    if (y == null && m == null) return null;
    return "0 years";
  }
  const yi = y == null ? 0 : Math.max(0, Math.floor(y));
  const mi = m == null ? 0 : Math.max(0, Math.floor(m));
  const parts: string[] = [];
  if (yi > 0) parts.push(`${yi} year${yi === 1 ? "" : "s"}`);
  if (mi > 0) parts.push(`${mi} month${mi === 1 ? "" : "s"}`);
  return parts.length ? parts.join(" ") : "0 years";
}

/** Convert a co-applicant work-exp pair (years, months) into decimal years. */
export function coapplicantWorkExperienceToYears(
  years: number | string | null | undefined,
  months: number | string | null | undefined,
): number | null {
  const y = parseNum(years);
  const m = parseNum(months);
  if (y == null && m == null) return null;
  const yi = y == null ? 0 : Math.max(0, y);
  const mi = m == null ? 0 : Math.max(0, m);
  return Math.round((yi + mi / 12) * 10000) / 10000;
}

/** Validate co-applicant work-exp inputs. Returns null on success. */
export function validateCoapplicantWorkExperience(
  rawYears: string,
  rawMonths: string,
): string | null {
  const y = (rawYears ?? "").toString().trim();
  const m = (rawMonths ?? "").toString().trim();
  if (!y && !m) return null;
  if (y) {
    if (!/^\d+$/.test(y)) return "Years must be a non-negative integer";
  }
  if (m) {
    if (!/^\d+$/.test(m)) return "Months must be a non-negative integer";
    const mi = parseInt(m, 10);
    if (mi < 0 || mi > 11) return "Months must be between 0 and 11";
  }
  return null;
}

/**
 * Single-field shorthand for Co-applicant Work Experience.
 *
 * Format: "<years>.<months>" where the decimal portion is interpreted as
 * LITERAL months (NOT a fraction). Decimal length 1 = single-digit months.
 * Examples:
 *   "3"     -> 3y 0m
 *   "5"     -> 5y 0m
 *   "0"     -> 0y 0m
 *   "3.6"   -> 3y 6m
 *   "0.6"   -> 0y 6m
 *   "3.06"  -> 3y 6m
 *   "3.11"  -> 3y 11m
 *   "3.12"  -> INVALID (months > 11)
 */
export interface CoappWorkExpParsed {
  years: number;
  months: number;
}

/** Parse the shorthand. Returns null when blank, or throws no error — pair with validate first. */
export function parseCoappWorkExpShorthand(raw: string): CoappWorkExpParsed | null {
  const s = (raw ?? "").toString().trim();
  if (!s) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [yPart, mPartRaw = ""] = s.split(".");
  const years = parseInt(yPart, 10);
  let months = 0;
  if (mPartRaw.length > 0) {
    months = parseInt(mPartRaw, 10);
  }
  if (!Number.isFinite(years) || !Number.isFinite(months)) return null;
  if (years < 0 || months < 0 || months > 11) return null;
  return { years, months };
}

/** Validate shorthand input. Returns null on success or when blank. */
export function validateCoappWorkExpShorthand(raw: string): string | null {
  const s = (raw ?? "").toString().trim();
  if (!s) return null;
  if (!/^-?\d+(\.\d+)?$/.test(s)) return "Enter a number like 3.6 (3 years 6 months)";
  if (s.startsWith("-")) return "Value cannot be negative";
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return "Use at most 2 decimal digits (e.g. 3.6 or 3.11)";
  const parsed = parseCoappWorkExpShorthand(s);
  if (!parsed) return "Months must be between 0 and 11";
  if (parsed.months > 11) return "Months must be between 0 and 11";
  return null;
}

/** Build the human preview ("3 years 6 months") from shorthand input. */
export function previewCoappWorkExpShorthand(raw: string): string | null {
  const parsed = parseCoappWorkExpShorthand(raw);
  if (!parsed) return null;
  const { years, months } = parsed;
  if (years === 0 && months === 0) return "0 years";
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years === 1 ? "" : "s"}`);
  if (months > 0) parts.push(`${months} month${months === 1 ? "" : "s"}`);
  return parts.join(" ");
}

/**
 * Reverse: build the shorthand string from stored years/months keys.
 * Used when hydrating a saved lead into the single-field UI.
 *   (3, 6)  -> "3.6"
 *   (3, 11) -> "3.11"
 *   (0, 6)  -> "0.6"
 *   (5, 0)  -> "5"
 *   (0, 0)  -> "0"
 *   missing -> ""
 */
export function buildCoappWorkExpShorthand(
  years: number | string | null | undefined,
  months: number | string | null | undefined,
): string {
  const yNum = parseNum(years);
  const mNum = parseNum(months);
  if (yNum == null && mNum == null) return "";
  const yi = yNum == null ? 0 : Math.max(0, Math.floor(yNum));
  const mi = mNum == null ? 0 : Math.max(0, Math.min(11, Math.floor(mNum)));
  if (mi === 0) return String(yi);
  // Two-digit months render as e.g. "3.11"; single-digit as "3.6".
  return mi < 10 ? `${yi}.${mi}` : `${yi}.${mi}`;
}
