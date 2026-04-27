// Combines text-extraction + type-rule + name-match into a final ValidationResult.

import { getRuleForCode, type DocRule, type NameSubject } from "./rules.ts";
import { matchNames, type NameMatchResult } from "./matchNames.ts";

export type OverallFlag = "ok" | "warn_name" | "warn_type" | "review_needed" | "inconclusive";
export type TypeVerdict = "type_match" | "type_unconfirmed" | "type_mismatch_high";
export type Confidence = "high" | "medium" | "low" | "none";

export interface ValidationResult {
  validated_at: string;
  validator_version: string;
  extraction: {
    method: "pdf_text" | "ocr_gemini" | "skipped_image_phase1" | "none";
    success: boolean;
    text_length: number;
    error: string | null;
  };
  type_check: {
    expected_code: string | null;
    verdict: TypeVerdict | "skipped";
    confidence: Confidence;
    matched_keywords: string[];
    matched_regex: boolean;
  };
  name_check: {
    expected_name: string | null;
    expected_subject: NameSubject;
    extracted_name_candidate: string | null;
    matched_name_tokens: string[];
    unmatched_expected_tokens: string[];
    verdict: NameMatchResult["verdict"] | "skipped";
    score: number;
  };
  overall_flag: OverallFlag;
  override?: {
    actor_user_id: string | null;
    actor_role: string | null;
    overridden_at: string;
    reason: string | null;
  };
}

export interface DecideInput {
  documentCode: string | null;
  extractedText: string | null;
  extractionMethod: ValidationResult["extraction"]["method"];
  extractionError: string | null;
  studentName: string | null;
  coapplicantName: string | null;
  // The slot's `applicable_for` from document_master — overrides nameSubject when "coapplicant"
  applicableFor: string | null;
}

const VALIDATOR_VERSION = "v1";

export function decide(input: DecideInput): ValidationResult {
  const rule: DocRule | null = getRuleForCode(input.documentCode);
  const text = input.extractedText ?? "";
  const lowerText = text.toLowerCase();
  const extractionSucceeded = input.extractionMethod !== "none" && input.extractionMethod !== "skipped_image_phase1" && text.length > 0;

  // No rule for this document code → skip both checks, flag ok.
  if (!rule) {
    return {
      validated_at: new Date().toISOString(),
      validator_version: VALIDATOR_VERSION,
      extraction: {
        method: input.extractionMethod,
        success: extractionSucceeded,
        text_length: text.length,
        error: input.extractionError,
      },
      type_check: {
        expected_code: input.documentCode,
        verdict: "skipped",
        confidence: "none",
        matched_keywords: [],
        matched_regex: false,
      },
      name_check: {
        expected_name: null,
        expected_subject: "none",
        extracted_name_candidate: null,
        matched_name_tokens: [],
        unmatched_expected_tokens: [],
        verdict: "skipped",
        score: 0,
      },
      overall_flag: "ok",
    };
  }

  // Determine the subject (override with applicable_for when document is for coapplicant)
  const subject: NameSubject = input.applicableFor === "coapplicant"
    ? "coapplicant"
    : input.applicableFor === "student"
    ? "student"
    : rule.nameSubject;

  const expectedName = subject === "student" ? input.studentName
    : subject === "coapplicant" ? input.coapplicantName
    : null;

  // If extraction failed or was skipped (Phase 1 image path), produce inconclusive — no warnings.
  // EXCEPT for Tier-1 strict docs (PAN/ITR/SALARY_SLIP/BANK_STMT): a random image or a
  // scanned PDF with no extractable text is no longer acceptable as "pending"; promote to
  // review_needed so the soft-block dialog fires and admins see a clear flag.
  if (!extractionSucceeded) {
    const strict = rule.tier === "strict";
    return {
      validated_at: new Date().toISOString(),
      validator_version: VALIDATOR_VERSION,
      extraction: {
        method: input.extractionMethod,
        success: false,
        text_length: text.length,
        error: input.extractionError,
      },
      type_check: {
        expected_code: input.documentCode,
        verdict: strict ? "type_mismatch_high" : "skipped",
        confidence: strict ? "high" : "none",
        matched_keywords: [],
        matched_regex: false,
      },
      name_check: {
        expected_name: expectedName,
        expected_subject: subject,
        extracted_name_candidate: null,
        matched_name_tokens: [],
        unmatched_expected_tokens: [],
        verdict: "skipped",
        score: 0,
      },
      overall_flag: strict ? "review_needed" : "inconclusive",
    };
  }

  // ---- L2: Type check ----
  const matchedKeywords = rule.keywords.filter((kw) => lowerText.includes(kw));
  const matchedRegex = rule.regexes.some((rx) => rx.test(text));

  let typeVerdict: TypeVerdict;
  let typeConfidence: Confidence;
  if (matchedRegex && matchedKeywords.length >= rule.requiredKeywordHits) {
    typeVerdict = "type_match";
    typeConfidence = "high";
  } else if (matchedRegex || matchedKeywords.length >= rule.requiredKeywordHits) {
    typeVerdict = "type_match";
    typeConfidence = matchedRegex ? "high" : "medium";
  } else if (matchedKeywords.length >= 1) {
    typeVerdict = "type_unconfirmed";
    typeConfidence = "low";
  } else {
    // Zero signals — for strict-tier or strong-strength rules, treat as high-confidence mismatch
    if (rule.tier === "strict" || rule.typeStrength === "strong") {
      typeVerdict = "type_mismatch_high";
      typeConfidence = "high";
    } else {
      typeVerdict = "type_unconfirmed";
      typeConfidence = "none";
    }
  }

  // ---- L3: Name check (only if subject !== "none") ----
  let nameResult: NameMatchResult;
  if (subject === "none" || rule.nameStrength === "none") {
    nameResult = {
      verdict: "inconclusive",
      score: 0,
      matched_name_tokens: [],
      unmatched_expected_tokens: [],
      extracted_name_candidate: null,
    };
  } else {
    nameResult = matchNames(expectedName, text);
  }

  // ---- Overall flag decision ----
  let overall: OverallFlag = "ok";

  // Type takes precedence
  if (typeVerdict === "type_mismatch_high") {
    overall = "review_needed"; // strong-signal rules trigger soft block; review_needed records that
  } else if (typeVerdict === "type_unconfirmed" && rule.typeStrength === "strong") {
    overall = "warn_type";
  }

  // Name overlay (only if no stronger type issue)
  if (overall === "ok" && (subject === "student" || subject === "coapplicant")) {
    if (nameResult.verdict === "mismatch" && rule.nameStrength === "strong") {
      overall = "warn_name";
    } else if (nameResult.verdict === "mismatch" && rule.nameStrength === "medium") {
      overall = "warn_name";
    } else if (nameResult.verdict === "partial_match" && rule.nameStrength === "strong") {
      // Partial is acceptable; no warn
    } else if (nameResult.verdict === "inconclusive") {
      // Couldn't extract anything name-like — leave as ok unless type also failed
    }
  }

  return {
    validated_at: new Date().toISOString(),
    validator_version: VALIDATOR_VERSION,
    extraction: {
      method: input.extractionMethod,
      success: true,
      text_length: text.length,
      error: input.extractionError,
    },
    type_check: {
      expected_code: input.documentCode,
      verdict: typeVerdict,
      confidence: typeConfidence,
      matched_keywords: matchedKeywords,
      matched_regex: matchedRegex,
    },
    name_check: {
      expected_name: expectedName,
      expected_subject: subject,
      extracted_name_candidate: nameResult.extracted_name_candidate,
      matched_name_tokens: nameResult.matched_name_tokens,
      unmatched_expected_tokens: nameResult.unmatched_expected_tokens,
      verdict: subject === "none" ? "skipped" : nameResult.verdict,
      score: nameResult.score,
    },
    overall_flag: overall,
  };
}

// Whether the result should produce a soft-block "Upload anyway?" prompt.
//
// Type-strictness vs name-strength are intentionally separate here:
//   - TYPE issues on strict-tier docs always soft-block (covers random images,
//     scanned PDFs, zero-signal PDFs uniformly across PAN/AADHAAR/marksheets/etc).
//   - NAME issues only soft-block when the doc has nameStrength = "strong"
//     (PAN, AADHAAR, PASSPORT, SALARY_SLIP, ITR, BANK_STMT). Education,
//     admission and scorecard docs use nameStrength = "medium" → name
//     mismatch shows a chip but never blocks the upload.
export function shouldSoftBlock(result: ValidationResult, code: string | null): boolean {
  if (!code) return false;
  const rule = getRuleForCode(code);
  if (!rule) return false;

  // (a) Type-level soft-block: strict-tier docs with type/extraction problems.
  if (rule.tier === "strict") {
    if (
      result.overall_flag === "review_needed" ||
      result.overall_flag === "inconclusive" ||
      result.overall_flag === "warn_type"
    ) {
      // BUT: if this is purely a name-warning that got promoted to review_needed,
      // we still want to honour the nameStrength rule below.
      // review_needed here is type-driven (verdict === type_mismatch_high), so allow.
      return true;
    }
  }

  // (b) High-confidence type mismatch on any strong-typeStrength rule.
  if (
    result.type_check.verdict === "type_mismatch_high" &&
    result.type_check.confidence === "high" &&
    rule.typeStrength === "strong"
  ) {
    return true;
  }

  // (c) Name-level soft-block: only when nameStrength is "strong".
  if (result.overall_flag === "warn_name" && rule.nameStrength === "strong") {
    return true;
  }

  return false;
}
