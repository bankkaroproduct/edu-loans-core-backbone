/**
 * Central numeric validation helper used across:
 *   - Admin Lead Detail inline edit (InlineEditField)
 *   - Add Lead / Quick Lead / Student forms (submit-time checks)
 *   - Bulk upload row validation
 *   - Edge function payload sanitation (ported copy lives in
 *     supabase/functions/_shared/validation/numeric.ts to avoid src/ imports)
 *
 * Design rules (per PM):
 *   - Blank input is ALLOWED for optional fields → callers decide required-ness;
 *     validateNumeric treats "" / null / undefined as `{ ok: true, clean: null }`.
 *   - Alphabets / random text are NEVER acceptable.
 *   - Never silently convert invalid text to 0 — always return ok:false.
 *   - Decimals allowed only for `decimal` kind.
 */

export type NumericKind =
  | "integer"
  | "decimal"
  | "amount"
  | "phone"
  | "pincode"
  | "year";

export type NumericResult =
  | { ok: true; clean: string | number | null }
  | { ok: false; message: string };

const MSG = {
  integer: "Only numeric values are allowed.",
  decimal: "Only numeric values are allowed. Decimals are allowed for this field.",
  amount: "Only numeric values are allowed.",
  phone: "Please enter a valid mobile number.",
  pincode: "Please enter a valid pincode.",
  year: "Please enter a valid year.",
} as const;

/**
 * Strip non-allowed characters before validation. Used by live `onChange`
 * sanitization in inputs so users cannot type alphabets at all.
 * Decimals keep a single `.`.
 */
export function sanitizeNumericInput(kind: NumericKind, raw: string): string {
  if (raw == null) return "";
  switch (kind) {
    case "decimal": {
      // Allow digits + a single dot
      let s = raw.replace(/[^\d.]/g, "");
      const firstDot = s.indexOf(".");
      if (firstDot !== -1) {
        s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
      }
      return s;
    }
    case "amount":
      // Allow digits + commas in raw (display); commas stripped at save
      return raw.replace(/[^\d,]/g, "");
    case "phone":
    case "pincode":
    case "year":
    case "integer":
    default:
      return raw.replace(/\D/g, "");
  }
}

function isBlank(raw: unknown): boolean {
  return raw === null || raw === undefined || String(raw).trim() === "";
}

export function validateNumeric(kind: NumericKind, raw: unknown): NumericResult {
  if (isBlank(raw)) {
    // Optional fields stay optional. Callers enforce required separately.
    return { ok: true, clean: null };
  }
  const s = String(raw).trim();

  switch (kind) {
    case "integer": {
      if (!/^\d+$/.test(s)) return { ok: false, message: MSG.integer };
      return { ok: true, clean: Number(s) };
    }
    case "decimal": {
      // Allow plain integer or decimal with 1-3 fractional digits (CGPA, IELTS)
      if (!/^\d+(\.\d{1,3})?$/.test(s)) return { ok: false, message: MSG.decimal };
      return { ok: true, clean: Number(s) };
    }
    case "amount": {
      const stripped = s.replace(/,/g, "");
      if (!/^\d+$/.test(stripped)) return { ok: false, message: MSG.amount };
      return { ok: true, clean: Number(stripped) };
    }
    case "phone": {
      let digits = s.replace(/\D/g, "");
      if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
      if (digits.length !== 10) return { ok: false, message: MSG.phone };
      return { ok: true, clean: digits };
    }
    case "pincode": {
      const digits = s.replace(/\D/g, "");
      if (!/^\d{6}$/.test(digits)) return { ok: false, message: MSG.pincode };
      return { ok: true, clean: digits };
    }
    case "year": {
      if (!/^\d{4}$/.test(s)) return { ok: false, message: MSG.year };
      const n = Number(s);
      const max = new Date().getFullYear() + 10;
      if (n < 2000 || n > max) return { ok: false, message: MSG.year };
      return { ok: true, clean: n };
    }
    default:
      return { ok: false, message: MSG.integer };
  }
}

/** Human label for a `kind` — used in bulk-upload error reasons. */
export function numericKindLabel(kind: NumericKind): string {
  return MSG[kind];
}
