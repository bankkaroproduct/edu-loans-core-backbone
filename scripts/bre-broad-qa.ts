/**
 * Read-only BRE broad audit. Runs evaluate() in-memory across all non-draft,
 * non-archived leads. NO writes, NO DB mutations, NO code/UX changes.
 *
 * Invoke: bun scripts/bre-harness-bootstrap-qa.ts
 *   (bootstrap shims browser globals before importing src/* modules)
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import { buildBreProfileFromLead } from "../src/lib/bre/leadProfile";
import { evaluate } from "../src/lib/bre/engine";

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

function bucketToTier(b: string | null | undefined): string | null {
  if (!b) return null;
  const x = String(b).trim().toLowerCase();
  if (x === "top 10" || x === "top_10" || x === "premium") return "premium";
  if (x === "top 20" || x === "top_20" || x === "top 50" || x === "top_50") return "tier_1";
  if (x === "top 100" || x === "top_100") return "tier_2";
  if (x === "top 200" || x === "top_200") return "tier_3";
  return "unranked";
}

function csvEscape(v: any): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function csvLine(arr: any[]) { return arr.map(csvEscape).join(",") + "\n"; }

async function loadActive() {
  const [{ data: cfgRow }, { data: ruleRows }] = await Promise.all([
    sb.from("bre_scoring_configs").select("*").eq("is_active", true).maybeSingle(),
    sb.from("bre_lender_rules").select("*").eq("is_active", true),
  ]);
  if (!cfgRow) throw new Error("No active scoring config");
  const cfg: any = {
    id: cfgRow.id, version_number: cfgRow.version_number, is_active: cfgRow.is_active,
    bucket_threshold: Number(cfgRow.bucket_threshold),
    student_params: cfgRow.student_params ?? [],
    university_params: cfgRow.university_params ?? [],
    coapplicant_params: cfgRow.coapplicant_params ?? [],
    overall_band_mapping: cfgRow.overall_band_mapping ?? [],
  };
  const rules = (ruleRows ?? []).map((r: any) => ({
    id: r.id, lender_id: r.lender_id, version_number: r.version_number, is_active: r.is_active,
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

async function snapshotCounts() {
  const tables = ["lead_lender_matches", "lead_stage_history", "communication_logs"];
  const out: Record<string, number> = {};
  for (const t of tables) {
    const { count } = await sb.from(t).select("id", { count: "exact", head: true });
    out[t] = count ?? 0;
  }
  return out;
}

(async () => {
  console.log("=== BRE Broad QA — Read-Only ===\n");

  const before = await snapshotCounts();
  console.log("Pre-run row counts:", before);

  const { cfg, rules } = await loadActive();
  console.log(`\nActive scoring config v${cfg.version_number}, ${rules.length} active lender rules, threshold=${cfg.bucket_threshold}\n`);

  const { data: leads, error } = await sb
    .from("student_leads")
    .select("*")
    .neq("current_stage", "draft")
    .eq("is_archived", false)
    .order("created_at", { ascending: true });
  if (error) throw error;
  console.log(`Loaded ${leads?.length ?? 0} leads\n`);

  // Bulk-resolve universities
  const uniIds = Array.from(new Set((leads ?? []).map((l: any) => l.university_id).filter(Boolean)));
  const uniMap = new Map<string, string | null>();
  if (uniIds.length) {
    const { data: us } = await sb.from("universities_master").select("id, ranking_bucket").in("id", uniIds as string[]);
    for (const u of us ?? []) uniMap.set(u.id, bucketToTier((u as any).ranking_bucket));
  }
  // Partner names
  const partnerIds = Array.from(new Set((leads ?? []).map((l: any) => l.partner_id).filter(Boolean)));
  const partnerMap = new Map<string, string>();
  if (partnerIds.length) {
    const { data: ps } = await sb.from("partner_organizations").select("id, display_name").in("id", partnerIds as string[]);
    for (const p of ps ?? []) partnerMap.set(p.id, (p as any).display_name);
  }

  // Outputs
  const summaryHeader = [
    "lead_id","student_name","partner","current_stage","destination_country","university","course_category",
    "loan_amount","collateral_route","student_score","university_score","coapplicant_score",
    "student_pass","university_pass","coapplicant_pass","overall_score","overall_band","eligibility_status",
    "eligible_lender_count","best_match_lender","missing_fields","rejection_reasons",
  ];
  const rankHeader = [
    "lead_id","rank","lender_name","lender_code","fit_category","eligible","product_type",
    "projected_rate","projected_loan","lender_specific_score","lender_risk_band","reasons",
  ];
  let summaryCsv = csvLine(summaryHeader);
  let rankCsv = csvLine(rankHeader);

  let passed = 0, failed = 0;
  const failBy = { student: 0, university: 0, coapplicant: 0, multiple: 0, other: 0 };
  const topRank1: Record<string, number> = {};
  const knockoutCounts: Record<string, number> = {};
  const rejectionCounts: Record<string, number> = {};
  let crashes = 0;

  for (const lead of leads ?? []) {
    try {
      const { profile: syncProfile, missing } = buildBreProfileFromLead(lead as any);
      const tier = lead.university_id ? uniMap.get(lead.university_id) ?? null : null;
      const profile: any = { ...syncProfile, university: { ...syncProfile.university, university_tier: tier } };

      const result = evaluate(profile, cfg as any, rules as any);

      const bs = result.buckets.student;
      const bu = result.buckets.university;
      const bc = result.buckets.coapplicant;
      const isPass = result.eligibility_status !== "Rejected";
      if (isPass) passed++; else failed++;

      const failedBuckets: string[] = [];
      if (!bs.passes) failedBuckets.push("student");
      if (!bu.passes) failedBuckets.push("university");
      if (!bc.passes) failedBuckets.push("coapplicant");
      if (failedBuckets.length > 1) failBy.multiple++;
      else if (failedBuckets.length === 1) (failBy as any)[failedBuckets[0]]++;
      else if (!isPass) failBy.other++;

      const eligible = result.eligible_lenders.filter((l: any) => l.eligible);
      const bestLender = eligible[0]?.lender_name ?? "";
      if (bestLender) topRank1[bestLender] = (topRank1[bestLender] ?? 0) + 1;

      for (const reason of result.rejection_reasons) {
        rejectionCounts[reason] = (rejectionCounts[reason] ?? 0) + 1;
      }

      const studentName = [lead.student_first_name, lead.student_last_name].filter(Boolean).join(" ") || lead.student_full_name || "";
      summaryCsv += csvLine([
        lead.lead_id, studentName, partnerMap.get(lead.partner_id) ?? "", lead.current_stage,
        profile.destination_country ?? "", lead.university_name_raw ?? "", profile.course_category ?? "",
        profile.loan_amount ?? "", profile.collateral_route ?? "",
        bs.total, bu.total, bc.total,
        bs.passes, bu.passes, bc.passes,
        result.overall_score, result.overall_band?.label ?? "", result.eligibility_status,
        eligible.length, bestLender,
        missing.map((m: any) => m.field).join("; "),
        result.rejection_reasons.join(" | "),
      ]);

      // Rankings
      const fitForRank = (rank: number | null) => {
        if (rank == null) return "";
        if (rank === 1) return "Premium Match";
        if (rank === 2) return "Best Fit";
        if (rank === 3) return "Good Fit";
        return "Backup";
      };
      for (const l of result.eligible_lenders) {
        if (l.eligible) {
          rankCsv += csvLine([
            lead.lead_id, l.rank ?? "", l.lender_name, l.lender_code, fitForRank(l.rank),
            "yes", l.product_type ?? "", l.projected_rate ?? "", l.projected_loan_amount ?? "",
            (l as any).lender_specific_score ?? "", (l as any).lender_risk_band ?? "",
            "",
          ]);
        } else {
          for (const r of l.reasons ?? []) knockoutCounts[`${l.lender_code}: ${r}`] = (knockoutCounts[`${l.lender_code}: ${r}`] ?? 0) + 1;
          rankCsv += csvLine([
            lead.lead_id, "", l.lender_name, l.lender_code, "Rejected",
            "no", l.product_type ?? "", "", "", "", "",
            (l.reasons ?? []).join(" | "),
          ]);
        }
      }
    } catch (e: any) {
      crashes++;
      console.error(`Lead ${lead.lead_id} crashed:`, e.message);
    }
  }

  writeFileSync("/mnt/documents/bre-broad-summary.csv", summaryCsv);
  writeFileSync("/mnt/documents/bre-broad-rankings.csv", rankCsv);

  const after = await snapshotCounts();
  console.log("\nPost-run row counts:", after);
  console.log("\nDeltas (must all be 0):");
  for (const k of Object.keys(before)) console.log(`  ${k}: ${after[k] - before[k]}`);

  console.log("\n=== Summary ===");
  console.log(`Total leads processed: ${(leads?.length ?? 0) - crashes}  (crashes: ${crashes})`);
  console.log(`BRE Pass: ${passed}    BRE Fail: ${failed}`);
  console.log(`Failure by bucket: student=${failBy.student} university=${failBy.university} coapplicant=${failBy.coapplicant} multiple=${failBy.multiple} other=${failBy.other}`);

  const topL = Object.entries(topRank1).sort((a,b)=>b[1]-a[1]).slice(0,10);
  console.log("\nTop lenders ranked #1:");
  for (const [n, c] of topL) console.log(`  ${n}: ${c}`);

  const topR = Object.entries(rejectionCounts).sort((a,b)=>b[1]-a[1]).slice(0,15);
  console.log("\nTop BRE rejection reasons:");
  for (const [n, c] of topR) console.log(`  [${c}] ${n}`);

  const topK = Object.entries(knockoutCounts).sort((a,b)=>b[1]-a[1]).slice(0,15);
  console.log("\nTop lender knockout reasons:");
  for (const [n, c] of topK) console.log(`  [${c}] ${n}`);

  console.log("\nOutputs:");
  console.log("  /mnt/documents/bre-broad-summary.csv");
  console.log("  /mnt/documents/bre-broad-rankings.csv");
})().catch((e) => { console.error(e); process.exit(1); });
