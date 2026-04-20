// Shared name normalization used by both partner and student upload validation.
// Pure function — no external dependencies.

const HONORIFICS = new Set([
  "mr", "mrs", "ms", "miss", "mx", "dr", "shri", "smt", "master",
  "sir", "madam", "prof", "professor",
  // Relational prefixes commonly OCR'd from Aadhaar / legal docs
  "so", "wo", "do", "co",
  "s", "w", "d", "c", // single-letter remnants when "s/o" splits to "s" + "o"
]);

export function normalizeName(input: string | null | undefined): string[] {
  if (!input) return [];
  // Lowercase, strip punctuation (keep spaces), collapse whitespace
  const cleaned = String(input)
    .toLowerCase()
    .replace(/[.,/\\\-_'"`()\[\]{}!?:;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return [];
  const tokens = cleaned.split(" ").filter((t) => t.length > 0 && !HONORIFICS.has(t));
  return tokens;
}
