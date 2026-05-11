// BRE-safe Course Category vocabulary used for lead capture/edit.
// These six values are the only ones recognised by
// `COURSE_CATEGORY_MAP` in `src/lib/bre/leadProfile.ts`. Master Data admin's
// separate list (`masterSchemas.COURSE_CATEGORIES`) is intentionally NOT
// touched here — see follow-up to converge vocabularies.
export const COURSE_CATEGORY_OPTIONS: ReadonlyArray<string> = [
  "STEM",
  "MBA",
  "Management",
  "Healthcare",
  "Arts",
  "Other",
] as const;
