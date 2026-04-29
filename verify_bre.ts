// Inline E2E verification — replicates the mapper without touching the browser client.
(globalThis as any).localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
import { createClient } from "@supabase/supabase-js";
import { evaluate } from "./src/lib/bre/engine";


const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

// Patch BEFORE importing leadProfile so its `supabase` symbol resolves to ours.
const clientMod = await import("./src/integrations/supabase/client");
(clientMod as any).supabase = sb;
const { buildBreProfileFromLeadAsync } = await import("./src/lib/bre/leadProfile");

async function loadActive() {
  const c = await sb.from("bre_scoring_configs").select("*").eq("is_active", true).maybeSingle();
  const rr = await sb.from("bre_lender_rules").select("*").eq("is_active", true);
  const d: any = c.data!;
  return {
    cfg: { id: d.id, version_number: d.version_number, is_active: d.is_active,
      bucket_threshold: Number(d.bucket_threshold),
      student_params: d.student_params ?? [], university_params: d.university_params ?? [],
      coapplicant_params: d.coapplicant_params ?? [], overall_band_mapping: d.overall_band_mapping ?? [] },
    rules: (rr.data ?? []).map((r: any) => ({
      id: r.id, lender_id: r.lender_id, version_number: r.version_number, is_active: r.is_active,
      basic_info: r.basic_info ?? { lender_name: "?", lender_code: "", lender_type: null, active: true },
      commercials: r.commercials ?? {}, hard_thresholds: r.hard_thresholds ?? {},
      loan_caps: r.loan_caps ?? { secured: {}, unsecured: {} },
      collateral_ltv: r.collateral_ltv ?? {},
      coverage: r.coverage ?? { supported_countries: [], excluded_states: [], accepted_courses: [], university_tier_overrides: [] },
      policy: r.policy ?? {},
    })),
  };
}

async function run(leadIdHuman: string, label: string) {
  const { data: lead } = await sb.from("student_leads").select("*").eq("lead_id", leadIdHuman).maybeSingle();
  if (!lead) return console.log(`[${label}] ${leadIdHuman} NOT FOUND`);
  const { profile, missing } = await buildBreProfileFromLeadAsync(lead as any);
  console.log(`\n=== ${label} :: ${leadIdHuman} (${(lead as any).student_first_name}) ===`);
  console.log("Missing:", missing.map((m: any) => m.field).join(",") || "(none)");
  console.log("student:", JSON.stringify(profile.student));
  console.log("university:", JSON.stringify(profile.university));
  console.log("coapplicant:", JSON.stringify(profile.coapplicant));
  const { cfg, rules } = await loadActive();
  const r = evaluate(profile, cfg as any, rules as any);
  console.log(`Buckets: s=${r.buckets.student.total} u=${r.buckets.university.total} c=${r.buckets.coapplicant.total} → overall=${r.overall_score} band=${r.overall_band?.band ?? "—"} status=${r.eligibility_status}`);
  const elig = r.eligible_lenders.filter(l => l.eligible);
  console.log(`Eligible lenders: ${elig.length}`);
  for (const l of elig.slice(0, 5)) console.log(`  • ${l.lender_name} | rate=${l.projected_rate}% | loan=${l.projected_loan_amount} | rank=${l.rank}`);
  if (elig.length === 0) console.log(`  reasons:`, r.rejection_reasons.slice(0, 3));
}

await run("EL-PL-000115", "complete");
await run("EL-PL-000113", "complete-2");
await run("EL-PL-000114", "complete-3");
await run("EL-PL-000117", "complete-4");

const { data: inc } = await sb.from("student_leads")
  .select("lead_id, coapplicant_income, coapplicant_relation, loan_amount_required, intended_study_country")
  .or("coapplicant_income.is.null,coapplicant_relation.is.null,loan_amount_required.is.null,intended_study_country.is.null").limit(3);
console.log("\nIncomplete candidates:", inc?.map((r: any) => r.lead_id));
if (inc && inc[0]) await run(inc[0].lead_id, "incomplete");
