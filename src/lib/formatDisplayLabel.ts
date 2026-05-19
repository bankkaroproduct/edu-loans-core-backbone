// Shared display-only formatter for raw enum / snake_case / lowercase values.
// Stored values are NEVER changed — this only affects what the user sees.
//
// Rules:
//   - null/blank → fallback (default "—")
//   - underscores/hyphens → spaces
//   - title-case each word
//   - preserved acronyms stay uppercase (US, UK, UAE, NBFC, PSU, PAN, CIBIL,
//     OTP, BRE, RLS, KYC, GST, EMI, ID, PTR, CRM, API, URL, PDF, CSV,
//     ITR, IELTS, TOEFL, GRE, PTE, GMAT, SAT, CAS, NRE, NRO, ...)
//   - mixed-case proper nouns (Aadhaar, CoE, I-20) handled via PROPER_NOUNS
//   - already-uppercase tokens (>=2 chars) are preserved as-is

const ACRONYMS = new Set([
  "US", "UK", "UAE", "USA", "EU",
  "NBFC", "PSU", "PAN", "CIBIL", "OTP", "BRE", "RLS",
  "KYC", "GST", "EMI", "ID", "PTR", "CRM", "API", "URL",
  "PDF", "CSV", "TAT", "ROI", "LTV", "DTI", "FOIR",
  "UPI", "NRI", "IRDAI", "RBI", "AML", "NEFT", "IMPS",
  // Education / finance acronyms
  "ITR", "IELTS", "TOEFL", "GRE", "PTE", "GMAT", "SAT", "CAS",
  "NRE", "NRO",
]);

// Mixed-case proper nouns / hyphenated tokens. Keys are lowercased tokens
// (after underscore/hyphen → space normalization); values are the exact
// display string.
const PROPER_NOUNS: Record<string, string> = {
  aadhaar: "Aadhaar",
  aadhar: "Aadhaar",
  coe: "CoE",
  i20: "I-20",
};

export function formatDisplayLabel(value: unknown, fallback = "—"): string {
  if (value === null || value === undefined) return fallback;
  const raw = String(value).trim();
  if (!raw) return fallback;

  const tokens = raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .split(" ");

  // Combine adjacent "i" + "20" (from "i-20" / "i_20") into a single "i20"
  // token so PROPER_NOUNS can map it to "I-20".
  const merged: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].toLowerCase() === "i" && tokens[i + 1] === "20") {
      merged.push("i20");
      i++;
    } else {
      merged.push(tokens[i]);
    }
  }

  return merged
    .map((word) => {
      if (!word) return word;
      const lower = word.toLowerCase();
      if (PROPER_NOUNS[lower]) return PROPER_NOUNS[lower];
      const upper = word.toUpperCase();
      if (ACRONYMS.has(upper)) return upper;
      // Preserve tokens already in all-caps (length >= 2) like "USA", "ICICI"
      if (word.length >= 2 && word === upper && /^[A-Z]+$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}
