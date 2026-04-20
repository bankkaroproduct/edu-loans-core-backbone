// Token-based fuzzy name matching with Levenshtein tolerance.
// Returns a score (0..1), matched tokens, and unmatched expected tokens.

import { normalizeName } from "./normalizeName.ts";

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const v0 = new Array(b.length + 1);
  const v1 = new Array(b.length + 1);
  for (let i = 0; i <= b.length; i++) v0[i] = i;
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
  }
  return v1[b.length];
}

function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  // Initial match: a single letter matches a token starting with that letter
  if (a.length === 1 && b.startsWith(a)) return true;
  if (b.length === 1 && a.startsWith(b)) return true;
  // Fuzzy match for longer tokens (handles OCR errors)
  if (a.length >= 8 && b.length >= 8) return levenshtein(a, b) <= 2;
  if (a.length >= 5 && b.length >= 5) return levenshtein(a, b) <= 1;
  return false;
}

export type NameMatchVerdict = "match" | "partial_match" | "mismatch" | "inconclusive";

export interface NameMatchResult {
  verdict: NameMatchVerdict;
  score: number;
  matched_name_tokens: string[];
  unmatched_expected_tokens: string[];
  extracted_name_candidate: string | null;
}

// Find whether the expected name (or a fuzzy variant) appears anywhere in the document text.
export function matchNames(
  expectedName: string | null | undefined,
  extractedText: string | null | undefined,
): NameMatchResult {
  const expected = normalizeName(expectedName);
  if (expected.length === 0) {
    return {
      verdict: "inconclusive",
      score: 0,
      matched_name_tokens: [],
      unmatched_expected_tokens: [],
      extracted_name_candidate: null,
    };
  }

  if (!extractedText || extractedText.trim().length === 0) {
    return {
      verdict: "inconclusive",
      score: 0,
      matched_name_tokens: [],
      unmatched_expected_tokens: expected,
      extracted_name_candidate: null,
    };
  }

  const extractedTokens = normalizeName(extractedText);
  if (extractedTokens.length === 0) {
    return {
      verdict: "inconclusive",
      score: 0,
      matched_name_tokens: [],
      unmatched_expected_tokens: expected,
      extracted_name_candidate: null,
    };
  }

  // For each expected token, find ANY matching token anywhere in extracted text.
  const matched: string[] = [];
  const unmatched: string[] = [];
  const matchedExtractedIndexes = new Set<number>();
  for (const exp of expected) {
    let found = false;
    for (let i = 0; i < extractedTokens.length; i++) {
      if (tokensMatch(exp, extractedTokens[i])) {
        matched.push(exp);
        matchedExtractedIndexes.add(i);
        found = true;
        break;
      }
    }
    if (!found) unmatched.push(exp);
  }

  // Build a candidate name from matched extracted tokens (for UX display)
  const candidateTokens = Array.from(matchedExtractedIndexes)
    .sort((a, b) => a - b)
    .map((i) => extractedTokens[i]);
  const candidate = candidateTokens.length > 0
    ? candidateTokens.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(" ")
    : null;

  // Effective score: ignore lone unmatched single-letter expected tokens (middle initials)
  // when the rest of the name matched well — common when application has "R K Choudhary"
  // but document only shows "Raghav Choudhary".
  const unmatchedNonInitial = unmatched.filter((t) => t.length > 1).length;
  const effectiveExpected = Math.max(1, expected.length - unmatched.filter((t) => t.length === 1).length);
  const effectiveMatched = expected.length - unmatchedNonInitial - unmatched.filter((t) => t.length === 1).length;
  const rawScore = matched.length / expected.length;
  const adjustedScore = Math.max(rawScore, effectiveMatched / effectiveExpected);
  const score = Math.max(0, Math.min(1, adjustedScore));

  // Refined thresholds (build batch — separates type strictness from name strength):
  //   ≥ 0.7  → match
  //   ≥ 0.5  → partial_match (acceptable, no warning)
  //   < 0.5  → mismatch (chip-only for medium nameStrength docs; soft-block for strong)
  let verdict: NameMatchVerdict;
  if (score >= 0.7) verdict = "match";
  else if (score >= 0.5) verdict = "partial_match";
  else verdict = "mismatch";

  return {
    verdict,
    score: Math.round(score * 100) / 100,
    matched_name_tokens: matched,
    unmatched_expected_tokens: unmatched,
    extracted_name_candidate: candidate,
  };
}
