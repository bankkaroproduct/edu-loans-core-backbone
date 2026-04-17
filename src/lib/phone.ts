/**
 * Phone normalization helper. Mirrors the DB-side `public.normalize_phone()` function
 * so client-side validation, lookup, and display behave identically to what the DB stores.
 *
 * Returns:
 *  - `+91XXXXXXXXXX` for any 10-digit Indian number (with or without +91 / spaces / dashes)
 *  - `null` if the input cannot be coerced into a valid 10-digit Indian phone
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, "");
  let local = digits;
  if (local.length === 12 && local.startsWith("91")) local = local.slice(2);
  if (local.length !== 10) return null;
  return `+91${local}`;
}

/** True if the value is a valid Indian 10-digit phone (with or without prefix). */
export function isValidIndianPhone(input: string | null | undefined): boolean {
  return normalizePhone(input) !== null;
}
