/**
 * Country identity normalization (presentation/logic layer only).
 *
 * The database keeps `intended_study_country` as free-form text and historical
 * leads/bulk-uploads contain a mix of values (e.g. "USA", "US", "United States",
 * "United States of America"). To avoid fragile string comparisons in
 * conditional-document logic, normalize every alias to a single canonical key.
 *
 * IMPORTANT:
 *  - Do NOT rewrite existing DB records.
 *  - Do NOT change user-facing labels — canonical display names remain
 *    "United States", "United Kingdom", "Australia".
 *  - This module is purely a compatibility/match layer.
 */

export type CanonicalCountry =
  | "united_states"
  | "united_kingdom"
  | "australia"
  | "other"
  | "unknown";

const ALIAS_MAP: Record<CanonicalCountry, readonly string[]> = {
  united_states: ["usa", "us", "united states", "united states of america", "u s a", "u s"],
  united_kingdom: ["uk", "united kingdom", "great britain", "u k"],
  australia: ["australia", "au"],
  other: [],
  unknown: [],
};

function normForMatch(s: string): string {
  return s.toLowerCase().replace(/\./g, " ").replace(/[^a-z0-9]+/g, " ").trim();
}

const LOOKUP: Record<string, CanonicalCountry> = (() => {
  const m: Record<string, CanonicalCountry> = {};
  (Object.keys(ALIAS_MAP) as CanonicalCountry[]).forEach((key) => {
    for (const alias of ALIAS_MAP[key]) m[normForMatch(alias)] = key;
  });
  return m;
})();

/**
 * Normalize a free-form country string to a canonical identity.
 *
 * - Empty / null / undefined → "unknown"
 * - Recognised alias → "united_states" | "united_kingdom" | "australia"
 * - Any other non-empty value → "other"
 */
export function normalizeCountry(value: string | null | undefined): CanonicalCountry {
  if (!value) return "unknown";
  const key = normForMatch(value);
  if (!key) return "unknown";
  return LOOKUP[key] ?? "other";
}

/**
 * For the single combined I-20/CAS/CoE master document, return the
 * country-specific short label so the row reads naturally per destination.
 * Returns null when no override should be applied.
 */
export function getAdmissionDocLabelForCountry(
  value: string | null | undefined,
): "I-20" | "CAS" | "CoE" | null {
  switch (normalizeCountry(value)) {
    case "united_states":
      return "I-20";
    case "united_kingdom":
      return "CAS";
    case "australia":
      return "CoE";
    default:
      return null;
  }
}
