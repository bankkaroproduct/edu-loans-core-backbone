// Centralized pincode → location enrichment helper.
// Single source of truth used by admin inline edit and any other client-side
// save path that needs to derive city/district/state/tier from a pincode.
//
// IMPORTANT: pincode_master schema is (pincode, district, state, tier,
// has_conflict). There is NO city/locality column. Per product decision,
// `city` is filled from `district` as a fallback when no dedicated city/
// locality field exists in master. If a city column is added later, update
// resolvePincodeEnrichment() to prefer it.

import { supabase } from "@/integrations/supabase/client";

export type PincodeFormatStatus = "blank" | "invalid" | "ok";

export function classifyPincode(raw: string | null | undefined): {
  status: PincodeFormatStatus;
  normalized: string | null;
} {
  const trimmed = (raw ?? "").trim();
  if (trimmed === "") return { status: "blank", normalized: null };
  if (!/^\d{6}$/.test(trimmed)) return { status: "invalid", normalized: null };
  return { status: "ok", normalized: trimmed };
}

export interface PincodeEnrichment {
  status: "blank" | "invalid" | "not_found" | "found";
  pincode: string | null;
  /** Patch of fields safe to merge into a student_leads update payload. */
  patch: Partial<{
    pincode: string | null;
    city: string | null;
    district: string | null;
    state: string | null;
    tier: string | null;
    country_of_residence: string | null;
  }>;
  hasConflict: boolean;
  /** Human-friendly warning when not_found (UI may surface as toast). */
  warning: string | null;
}

/**
 * Look up a pincode and return the patch to apply to a lead.
 * - blank → no patch (pincode itself is set to null by caller as needed)
 * - invalid format → no patch, status=invalid (caller blocks save)
 * - valid + not found → patch contains only pincode (does NOT overwrite location)
 * - valid + found → patch contains pincode + city/district/state/tier
 */
export async function resolvePincodeEnrichment(
  raw: string | null | undefined
): Promise<PincodeEnrichment> {
  const { status, normalized } = classifyPincode(raw);
  if (status === "blank") {
    return { status: "blank", pincode: null, patch: {}, hasConflict: false, warning: null };
  }
  if (status === "invalid" || !normalized) {
    return { status: "invalid", pincode: null, patch: {}, hasConflict: false, warning: null };
  }

  const { data, error } = await supabase
    .from("pincode_master")
    .select("district, state, tier, has_conflict")
    .eq("pincode", normalized)
    .maybeSingle();

  if (error || !data) {
    return {
      status: "not_found",
      pincode: normalized,
      patch: { pincode: normalized },
      hasConflict: false,
      warning: "Pincode not found in master. City/state were not auto-filled.",
    };
  }

  // Fallback note: pincode_master has no `city` column, so we derive city from
  // district. If/when master gains a real city/locality field, prefer it here.
  return {
    status: "found",
    pincode: normalized,
    patch: {
      pincode: normalized,
      city: data.district ?? null,
      district: data.district ?? null,
      state: data.state ?? null,
      tier: data.tier ?? null,
      // pincode_master is India-only by design (no `country` column).
      // Hardcode "India" on successful resolve so every caller of this
      // helper inherits the country-of-residence fill. Single source of truth.
      country_of_residence: "India",
    },
    hasConflict: !!data.has_conflict,
    warning: data.has_conflict
      ? "This pincode maps to multiple areas — please verify city/state."
      : null,
  };
}
