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
