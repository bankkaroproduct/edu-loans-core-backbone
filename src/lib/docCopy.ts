// Centralized doc-name display + soft-block copy used across upload dialogs and chips.
// Keys are document_code values from document_master.

export const DOC_DISPLAY_NAMES: Record<string, string> = {
  PAN: "PAN card",
  AADHAAR: "Aadhaar card",
  PASSPORT: "Passport",
  SALARY_SLIP: "Salary slip",
  ITR: "Income Tax Return",
  BANK_STMT: "Bank statement",
  MARK_10: "10th marksheet",
  MARK_12: "12th marksheet",
  GRAD_MARK: "Graduation marksheet",
  GRAD_DEGREE: "Graduation degree",
  PG_MARK: "Post-Graduation marksheet",
  PG_DEGREE: "Post-Graduation degree",
  ADMIT_LETTER: "Admission/offer letter",
  I20_CAS: "I-20 / CAS",
  IELTS_TOEFL: "IELTS / TOEFL scorecard",
  GRE_SCORE: "GRE scorecard",
  PROPERTY_DOC: "Property document",
};

export function displayDocName(code: string | null | undefined, fallback?: string): string {
  if (code && DOC_DISPLAY_NAMES[code]) return DOC_DISPLAY_NAMES[code];
  return fallback ?? "document";
}

// Soft-block dialog body when the file likely doesn't match the slot.
export function softBlockMessage(code: string | null | undefined, fallback?: string): string {
  const name = displayDocName(code, fallback);
  return `The file you uploaded doesn't appear to contain the markers we expect for a ${name}. If this is the right document, you can upload it anyway — it will be flagged for review.`;
}
