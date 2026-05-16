// Shared display-only formatter for raw enum / snake_case / lowercase values.
// Stored values are NEVER changed — this only affects what the user sees.
//
// Rules:
//   - null/blank → fallback (default "—")
//   - underscores/hyphens → spaces
//   - title-case each word
//   - preserved acronyms stay uppercase (US, UK, UAE, NBFC, PSU, PAN, CIBIL,
//     OTP, BRE, RLS, KYC, GST, EMI, ID, PTR, CRM, API, URL, PDF, CSV)
//   - already-uppercase tokens (>=2 chars) are preserved as-is

const ACRONYMS = new Set([
  "US", "UK", "UAE", "USA", "EU",
  "NBFC", "PSU", "PAN", "CIBIL", "OTP", "BRE", "RLS",
  "KYC", "GST", "EMI", "ID", "PTR", "CRM", "API", "URL",
  "PDF", "CSV", "TAT", "ROI", "LTV", "DTI", "FOIR",
  "UPI", "NRI", "IRDAI", "RBI", "AML", "NEFT", "IMPS",
]);

export function formatDisplayLabel(value: unknown, fallback = "—"): string {
  if (value === null || value === undefined) return fallback;
  const raw = String(value).trim();
  if (!raw) return fallback;

  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => {
      if (!word) return word;
      const upper = word.toUpperCase();
      if (ACRONYMS.has(upper)) return upper;
      // Preserve tokens already in all-caps (length >= 2) like "USA", "ICICI"
      if (word.length >= 2 && word === upper && /^[A-Z]+$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}
