/**
 * Refresh persisted lender recommendations for a lead from the live BRE engine.
 *
 * This is the *only* writer that overwrites `lead_lender_matches` rows for a
 * given lead from BRE output. It is safe to call repeatedly — it deletes the
 * existing rows for the lead and re-inserts fresh ones from the current engine
 * + active scoring config + active lender rules.
 *
 * Strict scope:
 *  - Writes only to `lead_lender_matches`.
 *  - Does NOT touch student_leads, lifecycle, documents, payouts, comms, or
 *    lender rules / commercials / master data.
 *  - Skips rows whose lender is inactive (the loader already excludes inactive
 *    lender rules, so they will not appear in `evaluate()` output).
 *  - Locked rows (`lock_status = true`) are preserved verbatim — we never
 *    overwrite a manual lock.
 */

import { supabase } from "@/integrations/supabase/client";
import { evaluate } from "./engine";
import { loadActive } from "./loader";
import { buildBreProfileFromLeadAsync } from "./leadProfile";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"student_leads">;

type FitCategory = "best_fit" | "good_fit" | "backup" | "premium_match" | "not_eligible";

function badgeToFit(badge: string | null | undefined): FitCategory {
  switch (badge) {
    case "best_match":
      return "best_fit";
    case "strong":
      return "good_fit";
    case "backup":
      return "backup";
    default:
      return "good_fit";
  }
}

export interface RefreshResult {
  leadId: string;
  inserted: number;
  preservedLocks: number;
  skippedReason?: string;
}

export async function refreshLeadRecommendations(leadId: string): Promise<RefreshResult> {
  // 1. Load lead.
  const { data: leadRow, error: leadErr } = await supabase
    .from("student_leads")
    .select("*")
    .eq("id", leadId)
    .maybeSingle();
  if (leadErr) throw leadErr;
  if (!leadRow) return { leadId, inserted: 0, preservedLocks: 0, skippedReason: "lead_not_found" };
  const lead = leadRow as Lead;

  // 2. Build profile + evaluate live BRE.
  const { profile, missing } = await buildBreProfileFromLeadAsync(lead);
  if (missing.length > 0) {
    return { leadId, inserted: 0, preservedLocks: 0, skippedReason: "profile_incomplete" };
  }

  const { cfg, rules } = await loadActive();
  const result = evaluate(profile, cfg, rules);

  // 3. Preserve any locked rows (manual assignments).
  const { data: existing, error: exErr } = await supabase
    .from("lead_lender_matches")
    .select("id, lender_id, lock_status")
    .eq("lead_id", leadId);
  if (exErr) throw exErr;
  const lockedLenderIds = new Set(
    (existing ?? []).filter((r) => r.lock_status === true).map((r) => r.lender_id),
  );

  // 4. Delete only the unlocked rows.
  const idsToDelete = (existing ?? [])
    .filter((r) => r.lock_status !== true)
    .map((r) => r.id);
  if (idsToDelete.length > 0) {
    const { error: delErr } = await supabase
      .from("lead_lender_matches")
      .delete()
      .in("id", idsToDelete);
    if (delErr) throw delErr;
  }

  // 5. Insert fresh rows from live engine for non-locked lenders only.
  const eligible = result.eligible_lenders
    .filter((l) => l.eligible)
    .filter((l) => !lockedLenderIds.has(l.lender_id))
    .sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999));

  const rows = eligible.map((l, i) => ({
    lead_id: leadId,
    lender_id: l.lender_id,
    recommendation_rank: l.rank ?? i + 1,
    fit_category: badgeToFit(l.badge),
    score: l.score ?? null,
    recommendation_reason_summary: (l.reasons ?? []).join(" | ") || null,
    bre_output_json: {
      product_type: l.product_type ?? null,
      projected_loan_amount: l.projected_loan_amount ?? null,
      projected_rate: l.projected_rate ?? null,
      payout_pct: l.payout_pct ?? null,
      effective_rate_min: l.effective_rate_min ?? null,
      effective_rate_max: l.effective_rate_max ?? null,
      scoring_config_version: cfg.version_number,
      generated_by: "live_bre_refresh",
    } as unknown as never,
    lock_status: false,
  }));

  if (rows.length > 0) {
    const { error: insErr } = await supabase.from("lead_lender_matches").insert(rows);
    if (insErr) throw insErr;
  }

  return {
    leadId,
    inserted: rows.length,
    preservedLocks: lockedLenderIds.size,
  };
}
