// One-time backfill: rebuild lead_lender_matches for every lead from the live BRE engine.
// - Skips leads with incomplete profile (engine "missing" gate).
// - Preserves locked rows (lock_status=true).
// - Excludes inactive lenders (loader filter).
// Usage: bun scripts/backfill-bre-recommendations.ts

(globalThis as any).localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
(globalThis as any).window = { localStorage: (globalThis as any).localStorage, location: { href: "" } };

import { createClient } from "@supabase/supabase-js";
import { mock } from "bun:test";

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(url, key);
await mock.module("../src/integrations/supabase/client", () => ({ supabase: sb }));

const { refreshLeadRecommendations } = await import("../src/lib/bre/refreshRecommendations");

const { data: leads, error } = await sb
  .from("student_leads")
  .select("id, lead_id")
  .eq("is_archived", false)
  .order("created_at", { ascending: true });
if (error) { console.error(error); process.exit(1); }

let ok = 0, skipped = 0, failed = 0, totalInserted = 0, totalLocked = 0;
const skippedReasons: Record<string, number> = {};

for (const l of leads ?? []) {
  try {
    const r = await refreshLeadRecommendations(l.id);
    if (r.skippedReason) {
      skipped++;
      skippedReasons[r.skippedReason] = (skippedReasons[r.skippedReason] ?? 0) + 1;
      console.log(`- ${l.lead_id} skipped (${r.skippedReason})`);
    } else {
      ok++;
      totalInserted += r.inserted;
      totalLocked += r.preservedLocks;
      console.log(`✓ ${l.lead_id}: ${r.inserted} inserted, ${r.preservedLocks} locked preserved`);
    }
  } catch (e) {
    failed++;
    console.error(`✗ ${l.lead_id} failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

console.log("\n=== SUMMARY ===");
console.log(`Total leads:    ${leads?.length ?? 0}`);
console.log(`Refreshed:      ${ok}  (rows inserted: ${totalInserted}, locked preserved: ${totalLocked})`);
console.log(`Skipped:        ${skipped} ${JSON.stringify(skippedReasons)}`);
console.log(`Failed:         ${failed}`);
