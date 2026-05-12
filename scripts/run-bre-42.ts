import { createClient } from "@supabase/supabase-js";
import { evaluate } from "../dev-server/src/lib/bre/engine";
import { loadActive } from "../dev-server/src/lib/bre/loader";
import { buildBreProfileFromLeadAsync } from "../dev-server/src/lib/bre/leadProfile";
import { applyRankModifier, resolveRankBandFromResolution } from "../dev-server/src/lib/bre/rankModifier";

// Patch the supabase client used by the lib code
const url = process.env.VITE_SUPABASE_URL!;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(url, key);

// Monkey-patch the imported client
const clientMod = await import("../dev-server/src/integrations/supabase/client");
(clientMod as any).supabase = sb;

const { data: lead } = await sb.from("student_leads").select("*").eq("lead_id", "EL-PL-000042").single();
console.log("Lead:", lead?.student_first_name, lead?.lead_id);

const built = await buildBreProfileFromLeadAsync(lead as any);
const { cfg, rules } = await loadActive();
const result = evaluate(built.profile, cfg, rules);

console.log("\n=== BRE OVERVIEW ===");
console.log("Status:", result.eligibility_status, "| Overall:", result.overall_score);
console.log("Buckets:", result.bucket_scores);

const rb = resolveRankBandFromResolution(built.resolution.university_match as any);
console.log("\n=== UNIVERSITY ===");
console.log("Match:", built.resolution.university_match);
console.log("Resolved band:", rb);

console.log("\n=== ELIGIBLE LENDERS (engine order) ===");
const elig = result.eligible_lenders.filter(l => l.eligible).sort((a,b)=>(a.rank??99)-(b.rank??99));
for (const l of elig) {
  const rule = rules.find(r => r.lender_id === l.lender_id) || null;
  const mod = applyRankModifier({
    band: rb.band, globalRank: rb.globalRank,
    baseProjectedLoan: l.projected_loan_amount, baseProjectedRate: l.projected_rate,
    requestedLoan: built.profile.loan_amount, productType: l.product_type as any,
    rule, roiRangeMin: l.effective_rate_min, roiRangeMax: l.effective_rate_max,
  });
  console.log(`#${l.rank} ${l.lender_name} [${l.product_type}] badge=${l.badge}`);
  console.log(`   base loan=₹${l.projected_loan_amount} rate=${l.projected_rate}%`);
  console.log(`   adj  loan=₹${mod.adjustedProjectedLoan} rate=${mod.adjustedProjectedRate}% clamp=${mod.clampApplied||"none"}`);
  console.log(`   reasons: ${l.reasons.join(" | ")}`);
}

console.log("\n=== INELIGIBLE ===");
for (const l of result.eligible_lenders.filter(x => !x.eligible)) {
  console.log(`✗ ${l.lender_name}: ${l.reasons.join(" | ")}`);
}
