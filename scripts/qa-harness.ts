/**
 * Read-only QA harness — runs the production mapper + engine against a fixed
 * lead list. Performs ONLY SELECT queries. No inserts, updates, deletes.
 */
(globalThis as any).localStorage = {
  getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {}, key: () => null, length: 0,
};
(globalThis as any).window = { location: { origin: "http://localhost" } };

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Patch the project's @/integrations/supabase/client to use our admin client.
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Use Bun's module resolver: import directly. Project alias `@` maps via tsconfig.
// For a /tmp script we use relative paths.
const projectRoot = "/dev-server";
process.env.PROJECT_ROOT = projectRoot;

// Inject sb as the module the leadProfile mapper expects.
// We do this by dynamically importing AFTER monkey-patching the module cache:
// Bun supports import-map style via explicit file imports — simplest is to
// re-export sb from a shim file that the mapper resolves to. Instead, easier:
// import the mapper's source and re-implement the async parts inline.
import { buildBreProfileFromLead } from "/dev-server/src/lib/bre/leadProfile.ts";
import { evaluate } from "/dev-server/src/lib/bre/engine.ts";

function rankingBucketToTier(bucket: string | null | undefined, matched = false): string | null {
  if (!bucket) return matched ? "unranked" : null;
  const b = String(bucket).trim().toLowerCase();
  if (b === "top 10" || b === "top_10" || b === "premium") return "premium";
  if (b === "top 20" || b === "top_20" || b === "top 50" || b === "top_50") return "tier_1";
  if (b === "top 100" || b === "top_100") return "tier_2";
  if (b === "top 200" || b === "top_200") return "tier_3";
  return "unranked";
}
function normEmployability(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = String(raw).trim().toLowerCase();
  if (v === "high" || v === "medium" || v === "low") return v;
  return null;
}
function normalizeName(s: string | null | undefined): string {
  if (!s) return "";
  return String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

async function loadActive() {
  const [{ data: cfgRow }, { data: ruleRows }] = await Promise.all([
    sb.from("bre_scoring_configs").select("*").eq("is_active", true).maybeSingle(),
    sb.from("bre_lender_rules").select("*").eq("is_active", true),
  ]);
  if (!cfgRow) throw new Error("No active scoring config");
  return {
    cfg: {
      id: cfgRow.id, version_number: cfgRow.version_number, is_active: cfgRow.is_active,
      bucket_threshold: Number(cfgRow.bucket_threshold),
      student_params: cfgRow.student_params ?? [],
      university_params: cfgRow.university_params ?? [],
      coapplicant_params: cfgRow.coapplicant_params ?? [],
      overall_band_mapping: cfgRow.overall_band_mapping ?? [],
    },
    rules: (ruleRows ?? []).map((r: any) => ({
      id: r.id, lender_id: r.lender_id, version_number: r.version_number, is_active: r.is_active,
      basic_info: r.basic_info ?? { lender_name: "Unknown", lender_code: "", lender_type: null, active: true },
      commercials: r.commercials ?? {},
      hard_thresholds: r.hard_thresholds ?? {},
      loan_caps: r.loan_caps ?? { secured: {}, unsecured: {} },
      collateral_ltv: r.collateral_ltv ?? {},
      coverage: r.coverage ?? { supported_countries: [], excluded_states: [], accepted_courses: [], university_tier_overrides: [] },
      policy: r.policy ?? {},
    })),
  };
}

async function resolveUniversity(lead: any): Promise<{ tier: string | null; outlook: string | null; resolution: string }> {
  if (lead.university_id) {
    const { data } = await sb.from("universities_master")
      .select("university_name, ranking_bucket, employability_outlook")
      .eq("id", lead.university_id).maybeSingle();
    if (data) {
      const tier = rankingBucketToTier(data.ranking_bucket, true);
      return { tier, outlook: normEmployability(data.employability_outlook),
        resolution: `by_id → ${data.university_name} · bucket=${data.ranking_bucket ?? "NULL"} → tier=${tier} · outlook=${data.employability_outlook ?? "NULL"}` };
    }
    return { tier: null, outlook: null, resolution: `by_id but row missing` };
  }
  if (lead.university_name_raw && lead.intended_study_country) {
    const normRaw = normalizeName(lead.university_name_raw);
    if (!normRaw) return { tier: null, outlook: null, resolution: "no raw name" };
    const { data: rows } = await sb.from("universities_master")
      .select("id, university_name, university_name_normalized, country, ranking_bucket, employability_outlook, aliases")
      .eq("active_flag", true).ilike("country", lead.intended_study_country);
    const candidates = (rows ?? []).filter((r: any) => {
      const names = [r.university_name, r.university_name_normalized, ...(r.aliases ?? [])].filter(Boolean).map((s: string) => normalizeName(s));
      return names.some((n) => n === normRaw || n.includes(normRaw) || normRaw.includes(n));
    });
    if (candidates.length === 1) {
      const c = candidates[0];
      const tier = rankingBucketToTier(c.ranking_bucket, true);
      return { tier, outlook: normEmployability(c.employability_outlook),
        resolution: `fuzzy(1) → ${c.university_name} · bucket=${c.ranking_bucket ?? "NULL"} → tier=${tier} · outlook=${c.employability_outlook ?? "NULL"}` };
    }
    if (candidates.length > 1) return { tier: null, outlook: null, resolution: `fuzzy ambiguous (${candidates.length}): ${candidates.slice(0,5).map((c:any)=>c.university_name).join(", ")}` };
    return { tier: null, outlook: null, resolution: `no_match for "${lead.university_name_raw}"` };
  }
  return { tier: null, outlook: null, resolution: "no university info" };
}

const LEAD_IDS = ["EL-PL-000118", "EL-PL-000116", "EL-PL-000119", "EL-PL-000106", "EL-PL-000105", "EL-PL-000077", "EL-PL-000117"];

(async () => {
  const { cfg, rules } = await loadActive();
  console.log(`Active scoring config v${cfg.version_number}, bucket_threshold=${cfg.bucket_threshold}, ${rules.length} active lender rules\n`);

  for (const code of LEAD_IDS) {
    console.log("=".repeat(110));
    const { data: lead } = await sb.from("student_leads").select("*").eq("lead_id", code).maybeSingle();
    if (!lead) { console.log(`${code}: NOT FOUND`); continue; }

    const uniRes = await resolveUniversity(lead);
    const { profile: syncProfile, missing, resolution } = buildBreProfileFromLead(lead);
    const profile = { ...syncProfile, university: { ...syncProfile.university, university_tier: uniRes.tier, employability_outlook: uniRes.outlook } };

    const { count: docCount } = await sb.from("lead_documents")
      .select("id", { count: "exact", head: true }).eq("lead_id", lead.id).eq("is_latest", true);

    let result: any = null;
    try { result = evaluate(profile, cfg as any, rules as any); } catch (e: any) {
      console.log(`${code}: EVAL CRASH: ${e.message}`); continue;
    }

    const eligible = result.eligible_lenders.filter((l: any) => l.eligible);
    const rateLenders = eligible.filter((l: any) => l.projected_rate != null);

    console.log(`\n${code}  course="${lead.course_name}"  cat=${profile.course_category}  level=${profile.course_level}  country=${profile.destination_country}  loan=${profile.loan_amount}`);
    console.log(`  current_stage=${lead.current_stage}  current_status=${lead.current_status}  (read-only — unchanged)`);
    console.log(`  University resolution:   ${uniRes.resolution}`);
    console.log(`  university_tier passed:  ${profile.university.university_tier}`);
    console.log(`  country_tier:            ${profile.university.country_tier}`);
    console.log(`  employability_outlook:   ${profile.university.employability_outlook}`);
    console.log(`  English proficiency:     value=${profile.student.english_proficiency}  source=${JSON.stringify(resolution?.english_proficiency)}`);
    console.log(`  Course level derivation: ${JSON.stringify(resolution?.course_level_derivation)}`);
    console.log(`  Coapplicant: rel=${profile.coapplicant.relationship} emp=${profile.coapplicant.employment_type} mo_income=${profile.coapplicant.monthly_income} age=${profile.coapplicant.age} cibil=${profile.coapplicant.cibil_score} stab_yrs=${profile.coapplicant.income_stability_years}`);
    console.log(`  Missing fields:          ${JSON.stringify(missing.map((m:any)=>m.field))}`);
    console.log(`  doc_count(is_latest):    ${docCount ?? 0}`);
    console.log(`  -- BUCKETS --`);
    console.log(`    student     : ${result.buckets.student.total}  passes=${result.buckets.student.passes}`);
    console.log(`    university  : ${result.buckets.university.total}  passes=${result.buckets.university.passes}`);
    console.log(`    coapplicant : ${result.buckets.coapplicant.total}  passes=${result.buckets.coapplicant.passes}`);
    console.log(`  overall_score: ${result.overall_score}  band: ${result.overall_band?.band ?? "—"}`);
    console.log(`  eligibility_status: ${result.eligibility_status}`);
    if (result.rejection_reasons.length) console.log(`  rejection_reasons: ${result.rejection_reasons.join(" | ")}`);
    console.log(`  eligible_lenders: ${eligible.length}/${rules.length}  with_projected_rate: ${rateLenders.length}`);
  }
  console.log("\n" + "=".repeat(110));
})().catch((e) => { console.error(e); process.exit(1); });
