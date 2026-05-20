/**
 * Document sample guidance — frontend-only mapping between a document name
 * (as shown in the UI) and the matching dummy sample image + helper copy.
 *
 * No backend, upload, validation, or status logic depends on this file.
 * If a document has no match, callers must silently hide the View Sample link.
 */
import manifest from "@/data/documentSampleManifest.json";

export interface DocumentSample {
  document_name: string;
  section_name: string;
  sample_file: string;
  relative_path: string;
  helper_text: string;
  sample_instruction: string;
  important_visible_fields: string[];
  priority_level: number;
  /** Public URL for the sample image. */
  image_url: string;
}

const SAMPLES: DocumentSample[] = (manifest as { samples: Omit<DocumentSample, "image_url">[] }).samples.map(
  (s) => ({ ...s, image_url: `/document_samples/${s.relative_path}` }),
);

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[\u2010-\u2015\-_/]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

const BY_NORM = new Map<string, DocumentSample>();
for (const s of SAMPLES) BY_NORM.set(normalize(s.document_name), s);

/** Additional aliases → canonical manifest document_name. */
const ALIASES: Record<string, string> = {
  "photograph": "Candidate Photograph",
  "student photograph": "Candidate Photograph",
  "pan card": "Candidate PAN Card",
  "pan": "Candidate PAN Card",
  "aadhaar card": "Candidate Aadhaar Card",
  "aadhar card": "Candidate Aadhaar Card",
  "aadhaar": "Candidate Aadhaar Card",
  "coapplicant pan card": "Co-applicant PAN Card",
  "co applicant pan card": "Co-applicant PAN Card",
  "coapplicant aadhaar card": "Co-applicant Aadhaar Card",
  "co applicant aadhaar card": "Co-applicant Aadhaar Card",
  "coapplicant photograph": "Co-applicant Photograph",
  "co applicant photograph": "Co-applicant Photograph",
  "offer letter": "Admission/Offer Letter",
  "admission letter": "Admission/Offer Letter",
  "admission offer letter": "Admission/Offer Letter",
  "i20": "I-20 (USA)",
  "i 20": "I-20 (USA)",
  "i20 usa": "I-20 (USA)",
  "cas": "CAS (UK)",
  "cas letter": "CAS (UK)",
  "cas uk": "CAS (UK)",
  "confirmation of acceptance for studies": "CAS (UK)",
  "coe": "CoE (Australia)",
  "coe australia": "CoE (Australia)",
  "confirmation of enrolment": "CoE (Australia)",
  "confirmation of enrollment": "CoE (Australia)",
  "ielts": "IELTS/TOEFL Score",
  "toefl": "IELTS/TOEFL Score",
  "ielts toefl score": "IELTS/TOEFL Score",
  "gre": "GRE Score Card",
  "gre score": "GRE Score Card",
  "salary slip": "Salary Slips",
  "itr": "Income Tax Returns",
  "itr acknowledgement": "Income Tax Returns",
  "itr acknowledgment": "Income Tax Returns",
  "income tax return": "Income Tax Returns",
  "bank statement": "Bank Statements",
  "property document": "Property Documents",
  "property sale deed": "Property Documents",
  "sale deed": "Property Documents",
  "10th": "10th Marksheet",
  "12th": "12th Marksheet",
  "graduation marksheet": "Graduation Marksheet",
  "graduation degree": "Graduation Degree Certificate",
  "post graduation marksheet": "Post-Graduation Marksheet",
  "post graduation degree": "Post-Graduation Degree Certificate",
};

const ALIAS_NORM = new Map<string, DocumentSample>();
for (const [alias, canonical] of Object.entries(ALIASES)) {
  const target = BY_NORM.get(normalize(canonical));
  if (target) ALIAS_NORM.set(normalize(alias), target);
}

/** Static fallback helper text by canonical document name. */
const FALLBACK_HELPER: Record<string, string> = {
  "Candidate Photograph": "Candidate's passport-size photograph with clear face and plain background.",
  "Candidate PAN Card": "Clear front-side image or PDF of the candidate's PAN card.",
  "Candidate Aadhaar Card": "Clear Aadhaar card copy of the candidate. Front and back if available.",
  "Passport": "Passport first and last page showing identity and address details.",
  "10th Marksheet": "Class 10 marksheet showing student name, board, year, and marks clearly.",
  "12th Marksheet": "Class 12 marksheet showing student name, board, year, and marks clearly.",
  "Graduation Marksheet": "Latest or consolidated graduation marksheet.",
  "Graduation Degree Certificate": "Final graduation degree certificate issued by the university.",
  "Post-Graduation Marksheet": "Post-graduation marksheet, if applicable.",
  "Post-Graduation Degree Certificate": "Post-graduation degree certificate, if applicable.",
  "Admission/Offer Letter": "Official offer/admission letter from the university or institution.",
  "I-20 (USA)": "I-20 form issued by the US institution confirming admission and SEVIS details.",
  "CAS (UK)": "CAS letter issued by the UK institution confirming acceptance for studies.",
  "CoE (Australia)": "CoE issued by the Australian institution confirming enrolment.",
  "IELTS/TOEFL Score": "English language test scorecard, if available or required.",
  "GRE Score Card": "GRE official scorecard, if available or required.",
  "Co-applicant Photograph": "Co-applicant's passport-size photograph with clear face and plain background.",
  "Co-applicant PAN Card": "Clear front-side image or PDF of the co-applicant's PAN card.",
  "Co-applicant Aadhaar Card": "Clear Aadhaar card copy of the co-applicant. Front and back if available.",
  "Salary Slips": "Latest salary slips, preferably last 3 months.",
  "Income Tax Returns": "Latest ITR documents, preferably last 2 years if available.",
  "Bank Statements": "Recent bank statement, preferably last 6 months.",
  "Property Documents": "Property ownership documents if secured/collateral loan route applies.",
};

/**
 * Find a sample for a document, trying display_name first, then document_name.
 * Returns null if no match — caller should hide the View Sample link silently.
 */
export function findSampleForDocument(
  displayName?: string | null,
  documentName?: string | null,
): DocumentSample | null {
  const candidates = [displayName, documentName].filter(Boolean) as string[];
  for (const c of candidates) {
    const n = normalize(c);
    if (!n) continue;
    const direct = BY_NORM.get(n);
    if (direct) return direct;
    const alias = ALIAS_NORM.get(n);
    if (alias) return alias;
    // Loose contains match: e.g. "Candidate PAN Card (front)" → PAN
    for (const [k, v] of BY_NORM) {
      if (n.includes(k) || k.includes(n)) return v;
    }
    for (const [k, v] of ALIAS_NORM) {
      if (n.includes(k)) return v;
    }
  }
  return null;
}

/**
 * Helper text to render inline under each document name.
 * Prefers manifest helper_text, falls back to the static map, else returns null.
 */
export function getHelperText(
  displayName?: string | null,
  documentName?: string | null,
): string | null {
  const sample = findSampleForDocument(displayName, documentName);
  if (sample?.helper_text) return sample.helper_text;
  const candidates = [displayName, documentName].filter(Boolean) as string[];
  for (const c of candidates) {
    if (FALLBACK_HELPER[c]) return FALLBACK_HELPER[c];
  }
  return null;
}
