/**
 * Format a raw state name (typically uppercase from pincode master) into title case.
 *
 * Examples:
 *   "DELHI"          → "Delhi"
 *   "UTTAR PRADESH"  → "Uttar Pradesh"
 *   "tamil nadu"     → "Tamil Nadu"
 *   null/undefined   → ""
 */
export function formatStateName(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
