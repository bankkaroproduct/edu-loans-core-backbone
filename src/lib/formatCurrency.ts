// Shared INR formatter — Indian numbering format (lakh/crore grouping).
// Examples:
//   1250000   -> ₹12,50,000
//   200000    -> ₹2,00,000
//   10000000  -> ₹1,00,00,000
//   50000     -> ₹50,000
// Display-only. Does not change stored values.

export function formatINR(
  value: number | string | null | undefined,
  opts: { fallback?: string; withSymbol?: boolean } = {},
): string {
  const { fallback = "—", withSymbol = true } = opts;
  if (value === null || value === undefined || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  const formatted = n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  return withSymbol ? `₹${formatted}` : formatted;
}

// Trim trailing zeros from a fixed-decimal string ("15.00" -> "15", "1.250" -> "1.25").
function trimDecimals(s: string): string {
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

// Full form with Lakhs/Crore unit suffix.
// 50000     -> ₹50,000           (no suffix under 1 Lakh)
// 1500000   -> ₹15,00,000 (15 Lakhs)
// 1225000   -> ₹12,25,000 (12.25 Lakhs)
// 12500000  -> ₹1,25,00,000 (1.25 Crore)
export function formatINRWithUnit(
  value: number | string | null | undefined,
  opts: { fallback?: string; withSymbol?: boolean } = {},
): string {
  const { fallback = "—", withSymbol = true } = opts;
  if (value === null || value === undefined || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  const base = formatINR(n, { withSymbol });
  const abs = Math.abs(n);
  if (abs >= 10000000) {
    const cr = trimDecimals((n / 10000000).toFixed(2));
    return `${base} (${cr} Crore)`;
  }
  if (abs >= 100000) {
    const l = trimDecimals((n / 100000).toFixed(2));
    return `${base} (${l} ${l === "1" ? "Lakh" : "Lakhs"})`;
  }
  return base;
}

// Two-part form for stacked display (amount above, unit annotation below).
// 50000     -> { amount: "₹50,000",       unit: null }
// 1500000   -> { amount: "₹15,00,000",    unit: "15 Lakhs" }
// 1225000   -> { amount: "₹12,25,000",    unit: "12.25 Lakhs" }
// 12500000  -> { amount: "₹1,25,00,000",  unit: "1.25 Crore" }
// null      -> { amount: fallback,        unit: null }
export function formatINRParts(
  value: number | string | null | undefined,
  opts: { fallback?: string; withSymbol?: boolean } = {},
): { amount: string; unit: string | null } {
  const { fallback = "—", withSymbol = true } = opts;
  if (value === null || value === undefined || value === "") {
    return { amount: fallback, unit: null };
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return { amount: fallback, unit: null };
  const amount = formatINR(n, { withSymbol });
  const abs = Math.abs(n);
  if (abs >= 10000000) {
    const cr = trimDecimals((n / 10000000).toFixed(2));
    return { amount, unit: `${cr} Crore` };
  }
  if (abs >= 100000) {
    const l = trimDecimals((n / 100000).toFixed(2));
    return { amount, unit: `${l} ${l === "1" ? "Lakh" : "Lakhs"}` };
  }
  return { amount, unit: null };
}

// Compact form for list/table cells.
// 50000     -> ₹50,000
// 1500000   -> ₹15L
// 1225000   -> ₹12.25L
// 12500000  -> ₹1.25Cr
export function formatINRCompact(
  value: number | string | null | undefined,
  opts: { fallback?: string; withSymbol?: boolean } = {},
): string {
  const { fallback = "—", withSymbol = true } = opts;
  if (value === null || value === undefined || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  const symbol = withSymbol ? "₹" : "";
  const abs = Math.abs(n);
  if (abs >= 10000000) return `${symbol}${trimDecimals((n / 10000000).toFixed(2))}Cr`;
  if (abs >= 100000) return `${symbol}${trimDecimals((n / 100000).toFixed(2))}L`;
  return formatINR(n, { withSymbol });
}
