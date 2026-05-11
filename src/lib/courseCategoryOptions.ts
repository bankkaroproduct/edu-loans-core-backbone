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

export type CourseCategoryOption = (typeof COURSE_CATEGORY_OPTIONS)[number];

export function toBreSafeCourseCategory(value: unknown): CourseCategoryOption | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes("stem") || raw.includes("engineering") || raw.includes("tech")) return "STEM";
  if (raw === "mba" || raw.includes("executive mba")) return "MBA";
  if (raw.includes("management") || raw.includes("business") || raw.includes("commerce") || raw.includes("finance")) return "Management";
  if (raw.includes("health") || raw.includes("medical") || raw.includes("medicine") || raw.includes("nursing") || raw.includes("pharma")) return "Healthcare";
  if (raw.includes("arts") || raw.includes("humanities") || raw.includes("law")) return "Arts";
  if (raw.includes("other")) return "Other";
  return null;
}
