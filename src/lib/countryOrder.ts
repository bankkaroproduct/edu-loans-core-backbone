// Sort country lists with study-destination priority on top, then alphabetical.
//
// IMPORTANT: The labels below MUST be the exact `country_name` values stored in
// `public.countries_master`. The list was verified against the live master:
//   "United States", "United Kingdom", "Canada", "Australia",
//   "Germany", "Ireland", "New Zealand"
// Do NOT use aliases like "US" / "USA" / "UK" — they will silently fall through
// to the alphabetical bucket because no master row matches them.
export const PRIORITY_COUNTRY_NAMES: readonly string[] = [
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "Ireland",
  "New Zealand",
];

const PRIORITY_INDEX: Record<string, number> = PRIORITY_COUNTRY_NAMES.reduce(
  (acc, name, i) => {
    acc[name.toLowerCase()] = i;
    return acc;
  },
  {} as Record<string, number>,
);

/** Stable priority-first sort. Items not in the priority list are sorted alphabetically. */
export function sortByPriority<T>(items: T[], getName: (item: T) => string): T[] {
  return [...items].sort((a, b) => {
    const an = (getName(a) || "").trim();
    const bn = (getName(b) || "").trim();
    const ai = PRIORITY_INDEX[an.toLowerCase()];
    const bi = PRIORITY_INDEX[bn.toLowerCase()];
    const aPri = ai !== undefined;
    const bPri = bi !== undefined;
    if (aPri && bPri) return ai - bi;
    if (aPri) return -1;
    if (bPri) return 1;
    return an.localeCompare(bn);
  });
}
