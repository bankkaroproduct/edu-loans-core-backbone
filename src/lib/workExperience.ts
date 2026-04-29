/**
 * Work Experience helpers for the Student portal.
 *
 * Input convention (single decimal digit only):
 *   "3"   => 3 years, 0 months
 *   "3.2" => 3 years, 2 months
 *   "0"   => Fresher
 *   ""    => not provided (null)
 *
 * "3.25" or "3.12" are NOT allowed and will be rejected by the input mask.
 * Months portion accepts only 0-9 (single digit). Months >= 10 are not
 * representable and intentionally blocked by the input.
 */

/** Allow only digits, optionally a single dot, and at most one digit after the dot. */
export function sanitizeWorkExpInput(raw: string): string {
  if (raw == null) return "";
  // strip everything except digits and a single dot
  let s = String(raw).replace(/[^\d.]/g, "");
  // collapse multiple dots: keep only the first one
  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
  }
  // enforce max one digit after the decimal
  if (firstDot !== -1) {
    const [intPart, decPart = ""] = s.split(".");
    s = intPart + "." + decPart.slice(0, 1);
  }
  return s;
}

/** Validate the sanitized value is a legal shorthand. Empty string is allowed (= blank). */
export function isValidWorkExp(value: string): boolean {
  if (value === "") return true;
  return /^\d+(\.\d)?$/.test(value);
}

/** Format the shorthand value for display. */
export function formatWorkExperience(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const str = String(value).trim();
  if (str === "") return null;
  if (!/^\d+(\.\d)?$/.test(str)) return null;
  const [yStr, mStr = "0"] = str.split(".");
  const years = parseInt(yStr, 10) || 0;
  const months = parseInt(mStr, 10) || 0;
  if (years === 0 && months === 0) return "Fresher";
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years === 1 ? "" : "s"}`);
  if (months > 0) parts.push(`${months} month${months === 1 ? "" : "s"}`);
  return parts.join(" and ");
}
