// Document-type validation rules keyed by document_master.document_code.
// Defines what keywords/regex should appear, name-check subject, and strictness.
// Unknown codes default to "no validation" so adding documents never breaks uploads.
//
// IMPORTANT — type strictness vs name strength are SEPARATE:
//   - `tier` + `typeStrength` govern document-TYPE detection. "strict" tier means a
//     random image / wrong file / unreadable PDF gets soft-blocked.
//   - `nameStrength` governs NAME consistency. "strong" → name mismatch can soft-block;
//     "medium" → name mismatch shows a warning chip but never soft-blocks.
//   This separation lets us strongly detect "wrong file" on marksheets/admit/scores
//   while keeping name mismatches on those same docs as soft warnings only.

export type NameSubject = "student" | "coapplicant" | "none";
export type Strength = "strong" | "medium" | "weak" | "none";
export type Tier = "strict" | "medium" | "weak";

export interface DocRule {
  keywords: string[];
  regexes: RegExp[];
  requiredKeywordHits: number;
  nameSubject: NameSubject;
  typeStrength: Strength;
  nameStrength: Strength;
  tier: Tier;
}

export const DOCUMENT_RULES: Record<string, DocRule> = {
  // ---- Strict identity (type + name strong) ----
  PAN: {
    keywords: ["income tax", "permanent account", "govt of india", "government of india"],
    regexes: [/\b[a-z]{5}[0-9]{4}[a-z]\b/i],
    requiredKeywordHits: 1,
    nameSubject: "student",
    typeStrength: "strong",
    nameStrength: "strong",
    tier: "strict",
  },
  AADHAAR: {
    keywords: [
      "aadhaar", "aadhar", "unique identification", "government of india", "uidai",
      "father", "year of birth",
      // Additive Aadhaar-only marker variants (scanned / e-Aadhaar / mAadhaar / Hindi):
      "आधार", "भारत सरकार", "vid", "enrolment", "enrolment no", "e-aadhaar", "maadhaar", "masked aadhaar",
    ],
    regexes: [/\b\d{4}\s?\d{4}\s?\d{4}\b/],
    requiredKeywordHits: 1,
    nameSubject: "student",
    typeStrength: "strong",
    nameStrength: "strong",
    tier: "strict",
  },
  PASSPORT: {
    keywords: ["republic of india", "passport", "place of birth", "date of issue", "date of expiry", "nationality"],
    regexes: [/\b[A-Z][0-9]{7}\b/],
    requiredKeywordHits: 1,
    nameSubject: "student",
    typeStrength: "strong",
    nameStrength: "strong",
    tier: "strict",
  },

  // ---- Strict financial (type strong + name strong) ----
  SALARY_SLIP: {
    keywords: ["salary", "pay slip", "payslip", "net pay", "gross pay", "earnings", "basic", "hra", "employee id", "salary slip"],
    regexes: [],
    requiredKeywordHits: 2,
    nameSubject: "coapplicant",
    typeStrength: "strong",
    nameStrength: "strong",
    tier: "strict",
  },
  ITR: {
    keywords: ["income tax", "itr", "assessment year", "itr-v", "verification form", "acknowledgement number"],
    regexes: [],
    requiredKeywordHits: 1,
    nameSubject: "coapplicant",
    typeStrength: "strong",
    nameStrength: "strong",
    tier: "strict",
  },
  BANK_STMT: {
    keywords: ["statement of account", "account statement", "ifsc", "balance", "transaction", "branch"],
    regexes: [/\bifsc\s*[:\-]?\s*[a-z]{4}0[a-z0-9]{6}\b/i],
    requiredKeywordHits: 2,
    nameSubject: "coapplicant",
    typeStrength: "medium",
    nameStrength: "strong",
    tier: "strict",
  },

  // ---- Strict academic (type strong, name medium = chip-only) ----
  MARK_10: {
    keywords: ["secondary", "10th", "class x", "matriculation", "marksheet", "central board", "board of", "sslc", "icse"],
    regexes: [],
    requiredKeywordHits: 1,
    nameSubject: "student",
    typeStrength: "strong",
    nameStrength: "medium",
    tier: "strict",
  },
  MARK_12: {
    keywords: ["senior secondary", "12th", "class xii", "intermediate", "marksheet", "central board", "board of", "higher secondary", "hsc", "isc"],
    regexes: [],
    requiredKeywordHits: 1,
    nameSubject: "student",
    typeStrength: "strong",
    nameStrength: "medium",
    tier: "strict",
  },
  GRAD_MARK: {
    keywords: ["university", "bachelor", "marksheet", "grade card", "transcript", "semester", "cgpa", "sgpa"],
    regexes: [],
    requiredKeywordHits: 1,
    nameSubject: "student",
    typeStrength: "strong",
    nameStrength: "medium",
    tier: "strict",
  },
  GRAD_DEGREE: {
    keywords: ["university", "bachelor", "degree", "conferred", "awarded", "convocation", "provisional"],
    regexes: [],
    requiredKeywordHits: 1,
    nameSubject: "student",
    typeStrength: "strong",
    nameStrength: "medium",
    tier: "strict",
  },

  // ---- Strict admission (type strong, name medium) ----
  ADMIT_LETTER: {
    keywords: ["admission", "offer", "admit", "congratulations", "we are pleased", "accepted", "letter of acceptance"],
    regexes: [],
    requiredKeywordHits: 1,
    nameSubject: "student",
    typeStrength: "strong",
    nameStrength: "medium",
    tier: "strict",
  },
  I20_CAS: {
    keywords: ["i-20", "form i-20", "sevis", "cas", "confirmation of acceptance", "coe", "confirmation of enrolment"],
    regexes: [],
    requiredKeywordHits: 1,
    nameSubject: "student",
    typeStrength: "strong",
    nameStrength: "medium",
    tier: "strict",
  },

  // ---- Strict scorecards (type strong, name medium) ----
  IELTS_TOEFL: {
    keywords: ["ielts", "toefl", "test report form", "overall band", "test of english", "score report"],
    regexes: [],
    requiredKeywordHits: 1,
    nameSubject: "student",
    typeStrength: "strong",
    nameStrength: "medium",
    tier: "strict",
  },
  GRE_SCORE: {
    keywords: ["gre", "graduate record", "verbal reasoning", "quantitative reasoning", "analytical writing", "score report"],
    regexes: [],
    requiredKeywordHits: 1,
    nameSubject: "student",
    typeStrength: "strong",
    nameStrength: "medium",
    tier: "strict",
  },

  // ---- Weak (no name check, lenient type) ----
  PROPERTY_DOC: {
    keywords: ["sale deed", "conveyance", "registrar", "property", "khata", "patta", "title deed"],
    regexes: [],
    requiredKeywordHits: 1,
    nameSubject: "none",
    typeStrength: "weak",
    nameStrength: "none",
    tier: "weak",
  },
};

export function getRuleForCode(code: string | null | undefined): DocRule | null {
  if (!code) return null;
  return DOCUMENT_RULES[code] ?? null;
}
