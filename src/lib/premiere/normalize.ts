/**
 * TS mirrors of the SQL helpers in supabase/migrations:
 *   - normalize_college_name
 *   - resolve_country_canonical (uses local alias map; DB is source of truth)
 *   - tokens_distinctive
 *   - match_college_names
 *
 * Keep these in lockstep with the SQL implementation. Both are used:
 *   - SQL version inside seed_lead_lender_matches and any DB-side joins.
 *   - TS version client/server-side for previewing upload validation and
 *     for the JS-only premiere lookup helpers.
 */

const STOPWORDS = new Set(["the", "a", "an", "of", "and"]);
const NON_DISTINCTIVE = new Set([
  "university",
  "college",
  "institute",
  "school",
  "campus",
]);

/**
 * Country alias seed mirrors the country_aliases table seed in the migration.
 * If you add aliases at runtime via the admin UI, prefer the server-side
 * resolveCountryCanonicalServer() helper instead which queries the DB.
 */
export const COUNTRY_ALIAS_MAP: Record<string, string> = {
  "usa": "United States",
  "us": "United States",
  "u.s.": "United States",
  "u.s.a.": "United States",
  "united states": "United States",
  "united states of america": "United States",
  "america": "United States",
  "uk": "United Kingdom",
  "u.k.": "United Kingdom",
  "britain": "United Kingdom",
  "great britain": "United Kingdom",
  "england": "United Kingdom",
  "united kingdom": "United Kingdom",
  "uae": "United Arab Emirates",
  "united arab emirates": "United Arab Emirates",
  "hk": "Hong Kong",
  "hong kong sar": "Hong Kong",
  "hong kong": "Hong Kong",
  "south korea": "South Korea",
  "republic of korea": "South Korea",
  "rok": "South Korea",
  "korea, republic of": "South Korea",
  "canada": "Canada",
  "australia": "Australia",
  "germany": "Germany",
  "france": "France",
  "netherlands": "Netherlands",
  "singapore": "Singapore",
  "ireland": "Ireland",
  "new zealand": "New Zealand",
  "spain": "Spain",
  "italy": "Italy",
  "switzerland": "Switzerland",
  "sweden": "Sweden",
  "denmark": "Denmark",
};

export function normalizeCollegeName(input: string | null | undefined): string {
  if (!input) return "";
  let s = input.toLowerCase();
  s = s.replace(/\u00A0/g, " "); // NBSP
  s = s.replace(/[^a-z0-9 ]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s
    .split(" ")
    .filter((t) => t.length > 0 && !STOPWORDS.has(t))
    .join(" ");
}

export function resolveCountryCanonical(input: string | null | undefined): string | null {
  if (!input) return null;
  const lookup = input.trim().toLowerCase();
  if (!lookup) return null;
  return COUNTRY_ALIAS_MAP[lookup] ?? input.trim();
}

export function tokensDistinctive(normalized: string): string[] {
  if (!normalized) return [];
  return normalized
    .split(" ")
    .filter((t) => t.length > 2 && !NON_DISTINCTIVE.has(t));
}

export function matchCollegeNames(aNorm: string, bNorm: string): boolean {
  if (!aNorm || !bNorm) return false;
  if (aNorm === bNorm) return true;
  const a = tokensDistinctive(aNorm);
  const b = tokensDistinctive(bNorm);
  if (a.length === 0 || b.length === 0) return false;
  const aSet = new Set(a);
  const bSet = new Set(b);
  let overlap = 0;
  for (const t of aSet) if (bSet.has(t)) overlap++;
  if (overlap < 2) return false;
  const aSubsetB = a.every((t) => bSet.has(t));
  const bSubsetA = b.every((t) => aSet.has(t));
  return aSubsetB || bSubsetA;
}
