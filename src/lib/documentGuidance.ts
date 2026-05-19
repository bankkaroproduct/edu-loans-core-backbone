/**
 * Match a document (by display_name / document_name) to the right guidance entry.
 * Returns null when no match — callers must silently hide the
 * "How to get this document?" link.
 *
 * Presentation-only. No upload/status/verification/backend logic depends on this.
 */
import { GUIDANCE_ENTRIES, type DocumentGuidance } from "@/data/documentGuidance";

export type { DocumentGuidance } from "@/data/documentGuidance";

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[\u2010-\u2015\-_/]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

const BY_NORM = new Map<string, DocumentGuidance>();
for (const g of GUIDANCE_ENTRIES) BY_NORM.set(normalize(g.canonical_name), g);

/** Aliases mapping common variants → canonical_name in GUIDANCE_ENTRIES. */
const ALIASES: Record<string, string> = {
  // identity
  "aadhaar": "Candidate Aadhaar Card",
  "aadhar card": "Candidate Aadhaar Card",
  "aadhaar card": "Candidate Aadhaar Card",
  "candidate aadhar card": "Candidate Aadhaar Card",
  "coapplicant aadhaar card": "Co-applicant Aadhaar Card",
  "co applicant aadhaar card": "Co-applicant Aadhaar Card",
  "coapplicant aadhar card": "Co-applicant Aadhaar Card",
  "pan": "Candidate PAN Card",
  "pan card": "Candidate PAN Card",
  "coapplicant pan card": "Co-applicant PAN Card",
  "co applicant pan card": "Co-applicant PAN Card",
  "passport copy": "Passport",
  // photographs
  "photograph": "Candidate Photograph",
  "student photograph": "Candidate Photograph",
  "coapplicant photograph": "Co-applicant Photograph",
  "co applicant photograph": "Co-applicant Photograph",
  // financial
  "itr": "ITR / Income Tax Return",
  "income tax return": "ITR / Income Tax Return",
  "income tax returns": "ITR / Income Tax Return",
  "itr income tax return": "ITR / Income Tax Return",
  "form 16": "Form 16",
  "salary slip": "Salary Slips",
  "salary slips": "Salary Slips",
  "payslip": "Salary Slips",
  "payslips": "Salary Slips",
  "bank statement": "Bank Statement",
  "bank statements": "Bank Statement",
  // admission
  "offer letter": "Offer Letter / Admission Letter",
  "admission letter": "Offer Letter / Admission Letter",
  "admission offer letter": "Offer Letter / Admission Letter",
  "offer letter admission letter": "Offer Letter / Admission Letter",
  "i20": "I-20 (USA)",
  "i 20": "I-20 (USA)",
  "i20 usa": "I-20 (USA)",
  "cas": "CAS — Confirmation of Acceptance for Studies (UK)",
  "cas uk": "CAS — Confirmation of Acceptance for Studies (UK)",
  "confirmation of acceptance for studies": "CAS — Confirmation of Acceptance for Studies (UK)",
  "coe": "CoE — Confirmation of Enrolment (Australia)",
  "coe australia": "CoE — Confirmation of Enrolment (Australia)",
  "confirmation of enrolment": "CoE — Confirmation of Enrolment (Australia)",
  "i20 cas coe": "I-20 (USA)",
  "equivalent admission document": "Equivalent Admission Document (Other Countries)",
  // property
  "sale deed": "Property Sale Deed",
  "property sale deed": "Property Sale Deed",
  "encumbrance certificate": "Encumbrance Certificate (EC)",
  "ec": "Encumbrance Certificate (EC)",
  "property valuation report": "Property Valuation Report",
  "valuation report": "Property Valuation Report",
  "property documents": "Property Sale Deed",
  "property document": "Property Sale Deed",
  // academics
  "10th": "10th Marksheet",
  "10th marksheet": "10th Marksheet",
  "sslc": "10th Marksheet",
  "12th": "12th Marksheet",
  "12th marksheet": "12th Marksheet",
  "hsc": "12th Marksheet",
  "graduation marksheet": "Graduation Marksheet",
  "ug marksheet": "Graduation Marksheet",
  "bachelor marksheet": "Graduation Marksheet",
  "graduation degree": "Graduation Degree Certificate",
  "graduation degree certificate": "Graduation Degree Certificate",
  "ug degree": "Graduation Degree Certificate",
  "post graduation marksheet": "Post-Graduation Marksheet",
  "pg marksheet": "Post-Graduation Marksheet",
  "post graduation degree": "Post-Graduation Degree Certificate",
  "post graduation degree certificate": "Post-Graduation Degree Certificate",
  "pg degree": "Post-Graduation Degree Certificate",
  // test scores
  "ielts": "English Language Test Scorecard (IELTS / TOEFL / PTE / Duolingo)",
  "toefl": "English Language Test Scorecard (IELTS / TOEFL / PTE / Duolingo)",
  "pte": "English Language Test Scorecard (IELTS / TOEFL / PTE / Duolingo)",
  "duolingo": "English Language Test Scorecard (IELTS / TOEFL / PTE / Duolingo)",
  "ielts toefl score": "English Language Test Scorecard (IELTS / TOEFL / PTE / Duolingo)",
  "english language test scorecard": "English Language Test Scorecard (IELTS / TOEFL / PTE / Duolingo)",
  "gre": "Aptitude Test Scorecard (GRE / GMAT / SAT)",
  "gre score": "Aptitude Test Scorecard (GRE / GMAT / SAT)",
  "gre score card": "Aptitude Test Scorecard (GRE / GMAT / SAT)",
  "gmat": "Aptitude Test Scorecard (GRE / GMAT / SAT)",
  "sat": "Aptitude Test Scorecard (GRE / GMAT / SAT)",
  "aptitude test scorecard": "Aptitude Test Scorecard (GRE / GMAT / SAT)",
};

const ALIAS_NORM = new Map<string, DocumentGuidance>();
for (const [alias, canonical] of Object.entries(ALIASES)) {
  const target = BY_NORM.get(normalize(canonical));
  if (target) ALIAS_NORM.set(normalize(alias), target);
}

export function findGuidanceForDocument(
  displayName?: string | null,
  documentName?: string | null,
): DocumentGuidance | null {
  const candidates = [displayName, documentName].filter(Boolean) as string[];
  for (const c of candidates) {
    const n = normalize(c);
    if (!n) continue;
    const direct = BY_NORM.get(n);
    if (direct) return direct;
    const alias = ALIAS_NORM.get(n);
    if (alias) return alias;
    // Loose contains match
    for (const [k, v] of BY_NORM) {
      if (n.includes(k) || k.includes(n)) return v;
    }
    for (const [k, v] of ALIAS_NORM) {
      if (n.includes(k)) return v;
    }
  }
  return null;
}

const URL_SAFE_RE = /^https:\/\/[a-z0-9.-]+(\/[^\s]*)?$/i;
export function isPublishableUrl(url: string | undefined): url is string {
  return !!url && URL_SAFE_RE.test(url.trim());
}
