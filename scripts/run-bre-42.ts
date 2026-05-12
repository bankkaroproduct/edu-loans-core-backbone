(globalThis as any).localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
(globalThis as any).window = { localStorage: (globalThis as any).localStorage, location: { href: "" } };

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(url, key);

// Stub the module so lib code uses our service-role client
import { mock } from "bun:test";
await mock.module("../src/integrations/supabase/client", () => ({ supabase: sb }));

const { evaluate } = await import("../src/lib/bre/engine");
const { loadActive } = await import("../src/lib/bre/loader");
const { buildBreProfileFromLeadAsync } = await import("../src/lib/bre/leadProfile");
const { applyRankModifier, resolveRankBandFromResolution } = await import("../src/lib/bre/rankModifier");

const { data: lead, error } = await sb.from("student_leads").select("*").eq("lead_id", "EL-PL-000042").single();
if (error || !lead) { console.error(error); process.exit(1); }

const built = await buildBreProfileFromLeadAsync(lead as any);
const { cfg, rules } = await loadActive();
const result = evaluate(built.profile, cfg, rules);

console.log("=== BRE OVERVIEW ===");
console.log("Status:", result.eligibility_status, "| Overall:", result.overall_score);
console.log("Buckets:", JSON.stringify(result.bucket_scores));
console.log("Loan range:", JSON.stringify(result.eligible_loan_range));
console.log("Rate range:", JSON.stringify(result.indicative_rate_range));
console.log("Profile:", JSON.stringify({
  loan: built.profile.loan_amount, country: built.profile.destination_country,
  collateral: built.profile.collateral_route, coapp_income: built.profile.coapplicant_monthly_income,
  emp: built.profile.coapplicant_employment_type,
}));

const rb = resolveRankBandFromResolution(built.resolution.university_match as any);
console.log("\n=== UNIVERSITY ===");
console.log("Match:", JSON.stringify(built.resolution.university_match));
console.log("Resolved band:", JSON.stringify(rb));

console.log(`\n=== ACTIVE RULES LOADED: ${rules.length} ===`);
console.log(rules.map(r => r.basic_info?.lender_name).join(", "));

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
  console.log(`\n#${l.rank} ${l.lender_name} [${l.product_type}] badge=${l.badge} payout=${l.payout_pct}%`);
  console.log(`   base: loan=₹${l.projected_loan_amount}  rate=${l.projected_rate}%`);
  console.log(`   adj : loan=₹${mod.adjustedProjectedLoan}  rate=${mod.adjustedProjectedRate}%  clamp=${mod.clampApplied||"none"}`);
  console.log(`   why: ${l.reasons.join(" | ")}`);
}

console.log("\n=== INELIGIBLE ===");
for (const l of result.eligible_lenders.filter(x => !x.eligible)) {
  console.log(`✗ ${l.lender_name}: ${l.reasons.join(" | ")}`);
}
