// Document-type validation rules keyed by document_master.document_code.
// Defines what keywords/regex should appear, name-check subject, and strictness.
// Unknown codes default to "no validation" so adding documents never breaks uploads.

export type NameSubject = "student" | "coapplicant" | "none";
export type Strength = "strong" | "medium" | "weak" | "none";

export interface DocRule {
  // Keywords that, if found (case-insensitive), are evidence the file is the right type
  keywords: string[];
  // Regex patterns that, if matched, are strong evidence
  regexes: RegExp[];
  // How many keyword hits constitute confirmed type
  requiredKeywordHits: number;
  // Whose name the document should belong to
  nameSubject: NameSubject;
  // Strength of expectation for type-matching
  typeStrength: Strength;
  // Strength of expectation for name-matching
  nameStrength: Strength;
}

// Each rule's keywords are lowercase. Matching is case-insensitive (we lowercase the text).
export const DOCUMENT_RULES: Record<string, DocRule> = {
  PAN: {
    keywords: ["income tax", "permanent account", "govt of india", "government of india"],
    regexes: [/\b[a-z]{5}[0-9]{4}[a-z]\b/i],
    requiredKeywordHits: 1,
    nameSubject: "student", // overridden to coapplicant when slot is for coapplicant
    typeStrength: "strong",
    nameStrength: "strong",
  },
  AADHAAR: {
    keywords: ["aadhaar", "aadhar", "unique identification", "government of india", "uidai"],
    regexes: [/\b\d{4}\s?\d{4}\s?\d{4}\b/],
    requiredKeywordHits: 1,
    nameSubject: "student",
    typeStrength: "strong",
    nameStrength: "strong",
  },
  PASSPORT: {
    keywords: ["republic of india", "passport", "type/", "place of birth", "date of issue"],
    regexes: [/\b[A-Z][0-9]{7}\b/],
    requiredKeywordHits: 1,
    nameSubject: "student",
    typeStrength: "strong",
    nameStrength: "strong",
  },
  MARK_10: {
    keywords: ["secondary", "10th", "class x", "matriculation", "marksheet", "central board", "board of"],
    regexes: [],
    requiredKeywordHits: 2,
    nameSubject: "student",
    typeStrength: "medium",
    nameStrength: "medium",
  },
  MARK_12: {
    keywords: ["senior secondary", "12th", "class xii", "intermediate", "marksheet", "central board", "board of", "higher secondary"],
    regexes: [],
    requiredKeywordHits: 2,
    nameSubject: "student",
    typeStrength: "medium",
    nameStrength: "medium",
  },
  GRAD_MARK: {
    keywords: ["university", "bachelor", "marksheet", "grade card", "transcript", "semester", "cgpa", "sgpa"],
    regexes: [],
    requiredKeywordHits: 2,
    nameSubject: "student",
    typeStrength: "medium",
    nameStrength: "medium",
  },
  GRAD_DEGREE: {
    keywords: ["university", "bachelor", "degree", "conferred", "awarded", "convocation"],
    regexes: [],
    requiredKeywordHits: 2,
    nameSubject: "student",
    typeStrength: "medium",
    nameStrength: "medium",
  },
  ADMIT_LETTER: {
    keywords: ["admission", "offer", "admit", "congratulations", "we are pleased", "accepted"],
    regexes: [],
    requiredKeywordHits: 1,
    nameSubject: "student",
    typeStrength: "medium",
    nameStrength: "medium",
  },
  I20_CAS: {
    keywords: ["i-20", "form i-20", "sevis", "cas", "confirmation of acceptance", "coe", "confirmation of enrolment"],
    regexes: [],
    requiredKeywordHits: 1,
    nameSubject: "student",
    typeStrength: "medium",
    nameStrength: "medium",
  },
  IELTS_TOEFL: {
    keywords: ["ielts", "toefl", "test report form", "overall band", "test of english"],
    regexes: [],
    requiredKeywordHits: 1,
    nameSubject: "student",
    typeStrength: "medium",
    nameStrength: "medium",
  },
  GRE_SCORE: {
    keywords: ["gre", "graduate record", "verbal reasoning", "quantitative reasoning", "analytical writing"],
    regexes: [],
    requiredKeywordHits: 1,
    nameSubject: "student",
    typeStrength: "medium",
    nameStrength: "medium",
  },
  SALARY_SLIP: {
    keywords: ["salary", "pay slip", "payslip", "net pay", "gross pay", "earnings", "basic", "hra", "employee id", "salary slip"],
    regexes: [],
    requiredKeywordHits: 2,
    nameSubject: "coapplicant",
    typeStrength: "strong",
    nameStrength: "strong",
  },
  ITR: {
    keywords: ["income tax", "itr", "assessment year", "itr-v", "verification form", "acknowledgement number"],
    regexes: [],
    requiredKeywordHits: 1,
    nameSubject: "coapplicant",
    typeStrength: "strong",
    nameStrength: "strong",
  },
  BANK_STMT: {
    keywords: ["statement of account", "account statement", "ifsc", "balance", "transaction", "branch"],
    regexes: [/\bifsc\s*[:\-]?\s*[a-z]{4}0[a-z0-9]{6}\b/i],
    requiredKeywordHits: 2,
    nameSubject: "coapplicant",
    typeStrength: "medium",
    nameStrength: "medium",
  },
  PROPERTY_DOC: {
    keywords: ["sale deed", "conveyance", "registrar", "property", "khata", "patta", "title deed"],
    regexes: [],
    requiredKeywordHits: 1,
    nameSubject: "none",
    typeStrength: "weak",
    nameStrength: "none",
  },
};

export function getRuleForCode(code: string | null | undefined): DocRule | null {
  if (!code) return null;
  return DOCUMENT_RULES[code] ?? null;
}
