// Display-only mapping for Employment Type in Admin-facing BRE surfaces.
// 5 product values: Salaried, Self Employed, Business Owner, Retired, Other.
// Engine scoring values are unchanged — this only maps them to product labels
// for the BRE breakdown table, simulator trace, and PDF export.

export function formatEmploymentLabel(v: unknown): string {
  if (v == null || v === "") return "—";
  const k = String(v).trim().toLowerCase();
  if (!k) return "—";

  // Salaried family
  if (k === "salaried" || k === "salaried_private" || k === "salaried_govt"
      || k === "salaried (private)" || k === "salaried (govt / psu)"
      || k === "salaried private" || k === "salaried govt") {
    return "Salaried";
  }
  // Business Owner (must be checked before generic self_employed_*)
  if (k === "self_employed_business" || k === "business_owner" || k === "business owner"
      || k === "self-employed business") {
    return "Business Owner";
  }
  // Self Employed
  if (k === "self_employed_professional" || k === "self_employed" || k === "self-employed"
      || k === "self employed" || k === "professional") {
    return "Self Employed";
  }
  // Retired
  if (k === "retired" || k === "retired_with_pension" || k === "retired (pension)") {
    return "Retired";
  }
  // Other / legacy unemployed → safe fallback
  if (k === "other" || k === "others" || k === "unemployed") {
    return "Other";
  }
  return String(v);
}

/** True when this parameter trace row is the Employment Type param. */
export function isEmploymentTypeParam(paramKey: string): boolean {
  return paramKey === "employment_type";
}
