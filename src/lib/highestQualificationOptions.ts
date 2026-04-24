/**
 * Single source of truth for the "Highest Qualification" allowed values.
 *
 * Backed by the `highest_qualification_master` table (admin-managed).
 * This file also keeps a hard-coded fallback list so forms never break if the
 * fetch fails or the table somehow returns zero active rows.
 *
 * Used by:
 *  - Bulk upload validator (src/hooks/useBulkUploadProcessor.ts)
 *  - Bulk upload visible reference (src/pages/BulkUpload.tsx)
 *  - Manual lead creation (src/pages/AddLead.tsx)
 *  - Student portal education form (src/pages/student/StudentEducationDetails.tsx)
 *  - Partner Master Data view (src/pages/MasterData.tsx)
 *  - Admin Master Data CRUD (src/pages/admin/AdminMasterData.tsx via masterSchemas)
 */
import { supabase } from "@/integrations/supabase/client";

/**
 * Hard-coded fallback list. MUST stay aligned with the DB seed and BRE/scoring
 * expectations. Used when the master fetch fails or returns nothing — guards
 * against the "qualification dropdown silently empty" failure mode.
 */
export const HIGHEST_QUALIFICATION_OPTIONS = [
  "12th / High School",
  "Diploma",
  "Bachelor's Degree",
  "Master's Degree",
  "PhD / Doctorate",
  "Other",
] as const;

export type HighestQualification = string;

/**
 * Case-insensitive match against the supplied options. Returns the canonical
 * (correctly-cased) value when a match exists, otherwise undefined. Used by
 * the bulk upload validator so partners can type "bachelor's degree" or
 * "BACHELOR'S DEGREE" and still get a clean canonical save.
 *
 * `options` defaults to the hard-coded fallback when not provided so legacy
 * callers don't need to thread state through.
 */
export function matchHighestQualification(
  input: string,
  options: readonly string[] = HIGHEST_QUALIFICATION_OPTIONS,
): string | undefined {
  if (!input) return undefined;
  const target = input.trim().toLowerCase();
  return options.find((q) => q.toLowerCase() === target);
}

/**
 * Fetch the active qualification list from the master table.
 * Falls back to the hard-coded list on any failure (network, RLS, empty rows)
 * so consumer forms never end up with an empty dropdown.
 */
export async function fetchHighestQualificationOptions(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("highest_qualification_master" as any)
      .select("qualification_label, sort_order")
      .eq("active_flag", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.warn("[highestQualification] master fetch failed, using fallback", error);
      return [...HIGHEST_QUALIFICATION_OPTIONS];
    }
    const labels = (data ?? [])
      .map((r: any) => (typeof r.qualification_label === "string" ? r.qualification_label.trim() : ""))
      .filter((s: string) => s.length > 0);

    return labels.length > 0 ? labels : [...HIGHEST_QUALIFICATION_OPTIONS];
  } catch (err) {
    console.warn("[highestQualification] master fetch threw, using fallback", err);
    return [...HIGHEST_QUALIFICATION_OPTIONS];
  }
}
