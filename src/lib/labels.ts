// Thin alias for the acronym-aware display formatter.
// Prefer importing `formatLabel` from here in new code paths so future
// acronym-bearing stage/status codes render correctly (e.g. BRE, KYC, UPI).
// The shared acronym list lives in formatDisplayLabel.ts — do not duplicate it.

export { formatDisplayLabel as formatLabel } from "./formatDisplayLabel";
