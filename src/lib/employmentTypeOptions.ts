// Canonical Employment Type options for Co-applicant.
// Source of truth: `public.employment_type_master` (admin-editable Master Data).
// Static fallback below mirrors the seed values so the UI never breaks if the fetch fails.

import { supabase } from "@/integrations/supabase/client";

export const EMPLOYMENT_TYPE_OPTIONS = [
  "Salaried",
  "Self-employed",
  "Business owner",
  "Retired",
  "Other",
] as const;

export async function fetchEmploymentTypeOptions(): Promise<string[]> {
  const { data, error } = await supabase
    .from("employment_type_master" as any)
    .select("employment_type_label, sort_order")
    .eq("active_flag", true)
    .order("sort_order", { ascending: true });
  if (error || !data || data.length === 0) return [...EMPLOYMENT_TYPE_OPTIONS];
  return (data as Array<{ employment_type_label: string }>).map((r) => r.employment_type_label);
}

/** Case-insensitive match against allowed options; returns canonical casing or null. */
export function matchEmploymentType(input: string, allowed: readonly string[]): string | null {
  const v = input.trim().toLowerCase();
  if (!v) return null;
  for (const opt of allowed) {
    if (opt.toLowerCase() === v) return opt;
  }
  return null;
}
