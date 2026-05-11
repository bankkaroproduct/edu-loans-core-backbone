// Display-only friendly labels for BRE parameter trace rendering.
// Pure presentation — does NOT mutate scoring, normalization, or stored values.
// Used by ParameterTraceTable (UI) and pdf.ts (PDF export) so the Admin-facing
// BRE breakdown never shows raw enum tokens like `self_employed_business`.

import type { Band, EnumBand, ParameterTrace } from "./types";

/**
 * Param-key-scoped overrides applied to the "Lead Input" column. When a
 * param_key is not listed here, callers fall back to the matched band's own
 * `label` (already friendly in `defaults.ts`) and finally to the raw value.
 *
 * Keep this aligned with the product-approved wording. The keys are the
 * normalized enum values produced by `leadProfile.ts` (`EMPLOYMENT_MAP`, etc.)
 * — NOT raw user input.
 */
const PARAM_VALUE_LABELS: Record<string, Record<string, string>> = {
  employment_type: {
    salaried_govt: "Salaried - Government",
    salaried_private: "Salaried - Private",
    self_employed_professional: "Self-employed professional",
    self_employed_business: "Business owner",
    retired_with_pension: "Retired",
    unemployed: "Unemployed",
  },
};

function isEnumBand(b: Band | null | undefined): b is EnumBand {
  return !!b && "value" in b;
}

/**
 * Resolve the friendly label for a parameter trace's "Lead Input" cell.
 * - Enum params: param-specific override → band label → raw value.
 * - Numeric / missing-match: return the raw input (or em-dash for null/empty).
 */
export function formatTraceInput(t: ParameterTrace): string {
  if (t.input == null || t.input === "") return "—";

  if (isEnumBand(t.matched_band)) {
    const key = String(t.input);
    const override = PARAM_VALUE_LABELS[t.param_key]?.[key];
    if (override) return override;
    return t.matched_band.label ?? t.matched_band.value ?? key;
  }

  // For enum inputs that did not match any band, still try the override map
  // so unmatched-but-known values display friendly text instead of raw tokens.
  const key = String(t.input);
  const override = PARAM_VALUE_LABELS[t.param_key]?.[key];
  if (override) return override;

  return key;
}
