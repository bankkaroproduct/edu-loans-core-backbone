/**
 * Read-only verification harness.
 * Replicates exactly what AdminLenderRecommendations.tsx does for a lead:
 *   1. build profile via buildBreProfileFromLeadAsync (mapper)
 *   2. count is_latest documents
 *   3. evaluate(profile, cfg, rules) and count rate-bearing lenders
 *   4. derive gateReason
 *
 * No code changes. No mutations.
 */
import { createClient } from "@supabase/supabase-js";

// We import the real engine + mapper helpers from project sources.
// Mapper depends on `@/integrations/supabase/client`, so we shim it.
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Inject the same client the mapper imports.
// @ts-expect-error – module shim
globalThis.__SHIMMED_SUPABASE__ = sb;

// Dynamic import after shim so the mapper picks up our client via alias hack below.
// Easier: just inline the mapper logic by calling its functions through a dynamic import
// using an absolute path AND re-exporting the supabase symbol. Simplest: re-implement
// the small piece we need (university tier lookup) here, then call buildProfileCore
// indirectly by importing the sync mapper and adding the tier ourselves.

// Use the sync mapper (no DB) and then patch university_tier in.
import { buildBreProfileFromLead } from "/dev-server/src/lib/bre/leadProfile.ts";
import { evaluate } from "/dev-server/src/lib/bre/engine.ts";

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
  const [{ data: cfgRow }, { data: ruleRows }] = await Promise.all([
    sb.from("bre_scoring_configs").select("*").eq("is_active", true).maybeSingle(),
    sb.from("bre_lender_rules").select("*").eq("is_active", true),
  ]);
  if (!cfgRow) throw new Error("No active scoring config");
  const cfg = {
    id: cfgRow.id,
    version_number: cfgRow.version_number,
    is_active: cfgRow.is_active,
    bucket_threshold: Number(cfgRow.bucket_threshold),
    student_params: cfgRow.student_params ?? [],
    university_params: cfgRow.university_params ?? [],
    coapplicant_params: cfgRow.coapplicant_params ?? [],
    overall_band_mapping: cfgRow.overall_band_mapping ?? [],
  };
  const rules = (ruleRows ?? []).map((r: any) => ({
    id: r.id,
    lender_id: r.lender_id,
    version_number: r.version_number,
    is_active: r.is_active,
    basic_info: r.basic_info ?? { lender_name: "Unknown", lender_code: "", lender_type: null, active: true },
    commercials: r.commercials ?? {},
    hard_thresholds: r.hard_thresholds ?? {},
    loan_caps: r.loan_caps ?? { secured: {}, unsecured: {} },
    collateral_ltv: r.collateral_ltv ?? {},
    coverage: r.coverage ?? { supported_countries: [], excluded_states: [], accepted_courses: [], university_tier_overrides: [] },
    policy: r.policy ?? {},
  }));
  return { cfg, rules };
}

const LEAD_IDS = ["EL-PL-000061", "EL-PL-000115", "EL-PL-000116", "EL-PL-000119"];

(async () => {
  const { cfg, rules } = await loadActive();

  console.log(`\nActive scoring config v${cfg.version_number}, ${rules.length} active lender rules\n`);
  console.log("=".repeat(120));

  for (const code of LEAD_IDS) {
    const { data: lead } = await sb.from("student_leads").select("*").eq("lead_id", code).maybeSingle();
    if (!lead) { console.log(`${code}: NOT FOUND`); continue; }

    // Resolve university tier exactly like the async mapper.
    let universityTier: string | null = null;
    if (lead.university_id) {
      const { data: u } = await sb.from("universities_master").select("ranking_bucket").eq("id", lead.university_id).maybeSingle();
      universityTier = rankingBucketToTier(u?.ranking_bucket ?? null);
    }

    // Sync mapper, then patch university_tier in (matches async behavior).
    const { profile: syncProfile, missing } = buildBreProfileFromLead(lead as any);
    const profile = { ...syncProfile, university: { ...syncProfile.university, university_tier: universityTier } };

    // Doc count
    const { count: docCount } = await sb
      .from("lead_documents")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", lead.id)
      .eq("is_latest", true);

    // Evaluate (only if profile complete; engine still runs on partial — we mirror UI logic)
    let eligibleCount = 0;
    let rateLenders = 0;
    let evalError: string | null = null;
    try {
      const result = evaluate(profile as any, cfg as any, rules as any);
      eligibleCount = result.eligible_lenders.filter((l: any) => l.eligible).length;
      rateLenders = result.eligible_lenders.filter((l: any) => l.eligible && l.projected_rate != null).length;
    } catch (e: any) {
      evalError = e.message;
    }

    // gateReason mirrors AdminLenderRecommendations.tsx
    let gateReason: string = "ok";
    if (missing.length > 0) gateReason = "profile";
    else if ((docCount ?? 0) === 0) gateReason = "documents";
    else if (rateLenders === 0) gateReason = "no_rate";

    console.log(`\n${code}  (${lead.id})`);
    console.log(`  destination=${profile.destination_country} loan=${profile.loan_amount} course_cat=${profile.course_category} collateral_route=${profile.collateral_route}`);
    console.log(`  university_tier=${profile.university.university_tier} country_tier=${profile.university.country_tier}`);
    console.log(`  coapplicant: rel=${profile.coapplicant.relationship} emp=${profile.coapplicant.employment_type} income=${profile.coapplicant.monthly_income}`);
    console.log(`  missing[]:                ${JSON.stringify(missing.map((m: any) => m.field))}`);
    console.log(`  doc_count:                ${docCount ?? 0}`);
    console.log(`  gateReason:               ${gateReason}`);
    console.log(`  eligible_lenders:         ${eligibleCount} / ${rules.length}`);
    console.log(`  projected_rate lenders:   ${rateLenders}`);
    if (evalError) console.log(`  evalError: ${evalError}`);
  }
  console.log("\n" + "=".repeat(120));
})().catch((e) => { console.error(e); process.exit(1); });
