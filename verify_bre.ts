// E2E verification — bypasses the browser client by calling the sync mapper
// and injecting university_tier from a service-role query (matching what the
// async mapper does at runtime).
(globalThis as any).localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
import { createClient } from "@supabase/supabase-js";
import { evaluate } from "./src/lib/bre/engine";
import { buildBreProfileFromLead } from "./src/lib/bre/leadProfile";

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

// Replicate the bucket→tier mapping from leadProfile.ts (single source of truth check).
function rankingBucketToTier(bucket: string | null | undefined): string | null {
  if (!bucket) return null;
  const b = String(bucket).trim().toLowerCase();
  if (b === "top 10" || b === "top_10" || b === "premium") return "premium";
  if (b === "top 20" || b === "top_20" || b === "top 50" || b === "top_50") return "tier_1";
  if (b === "top 100" || b === "top_100") return "tier_2";
  if (b === "top 200" || b === "top_200") return "tier_3";
  return "unranked";
}

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
  const { profile, missing } = buildBreProfileFromLead(lead as any);
  // Inject university_tier exactly the way the async mapper does in production.
  if ((lead as any).university_id) {
    const u = await sb.from("universities_master").select("ranking_bucket").eq("id", (lead as any).university_id).maybeSingle();
    profile.university.university_tier = rankingBucketToTier(u.data?.ranking_bucket);
  }
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

await run("EL-PL-000115", "complete-115");
await run("EL-PL-000113", "complete-113");
await run("EL-PL-000114", "complete-114");
await run("EL-PL-000117", "complete-117");

const { data: inc } = await sb.from("student_leads")
  .select("lead_id, coapplicant_income, coapplicant_relation, loan_amount_required, intended_study_country")
  .or("coapplicant_income.is.null,coapplicant_relation.is.null,loan_amount_required.is.null,intended_study_country.is.null").limit(3);
console.log("\nIncomplete candidates:", inc?.map((r: any) => r.lead_id));
if (inc && inc[0]) await run(inc[0].lead_id, "incomplete");
