/**
 * BROADER READ-ONLY BRE QA
 *
 * Uses the EXACT Admin "Run BRE" path:
 *   - buildBreProfileFromLeadAsync (fuzzy raw-name match, employability, course_level, Other-Test-Scores fallback)
 *   - evaluate() with active scoring config + active lender rules
 *
 * No writes. No code changes. SELECTs only.
 */
import { createClient } from "@supabase/supabase-js";
import { buildBreProfileFromLeadAsync } from "@/lib/bre/leadProfile";
import { evaluate } from "@/lib/bre/engine";

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

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
    } as any,
    rules: (ruleRows ?? []).map((r: any) => ({
      id: r.id, lender_id: r.lender_id, version_number: r.version_number, is_active: r.is_active,
      basic_info: r.basic_info ?? { lender_name: "Unknown", lender_code: "", lender_type: null, active: true },
      commercials: r.commercials ?? {}, hard_thresholds: r.hard_thresholds ?? {},
      loan_caps: r.loan_caps ?? { secured: {}, unsecured: {} },
      collateral_ltv: r.collateral_ltv ?? {},
      coverage: r.coverage ?? { supported_countries: [], excluded_states: [], accepted_courses: [], university_tier_overrides: [] },
      policy: r.policy ?? {},
    })) as any[],
  };
}

(async () => {
  const { cfg, rules } = await loadActive();

  const { data: leads } = await sb
    .from("student_leads").select("*")
    .neq("current_stage", "draft").eq("is_archived", false)
    .order("lead_id");
  if (!leads) { console.log("No leads"); return; }

  // BEFORE snapshots — proof of zero writes
  const beforeLeads = leads.map((l: any) => ({
    id: l.id, lead_id: l.lead_id, current_stage: l.current_stage,
    current_status: l.current_status, updated_at: l.updated_at, assigned_admin_id: l.assigned_admin_id,
  }));
  const [{ count: matchesBefore }, { count: stageHistBefore }, { count: commsBefore }] = await Promise.all([
    sb.from("lead_lender_matches").select("id", { count: "exact", head: true }),
    sb.from("lead_stage_history").select("id", { count: "exact", head: true }),
    sb.from("communication_logs").select("id", { count: "exact", head: true }),
  ]);

  const reasonTally: Record<string, number> = {};
  const crashRows: { lead_id: string; error: string }[] = [];
  const matchedNullTier: string[] = [];
  const fuzzyMatches: { lead_id: string; raw: string; matched: string; tier: string | null }[] = [];
  const fuzzyNoMatch: { lead_id: string; raw: string }[] = [];
  const fuzzyAmbiguous: { lead_id: string; raw: string; candidates: number }[] = [];
  const courseDerivedFromName: { lead_id: string; raw: string; level: string }[] = [];
  const courseLevelMissing: string[] = [];
  const englishOtherFallback: { lead_id: string; raw: string; ielts_eq: number | null; detected: string }[] = [];
  const englishOtherUnparseable: { lead_id: string; raw: string }[] = [];
  const suspicious: string[] = [];

  let crashes = 0, profileComplete = 0, anyEligible = 0, allBucketsPass = 0;
  let englishNamed = 0, englishMissing = 0;

  let bucketSum = { S: 0, U: 0, C: 0 };
  let bucketCount = 0;

  for (const lead of leads as any[]) {
    let result: any = null, missing: any[] = [], resolution: any = null, profile: any = null;
    try {
      const built = await buildBreProfileFromLeadAsync(lead);
      profile = built.profile; missing = built.missing; resolution = (built as any).resolution;

      // Track university match resolution
      const um = resolution?.university_match;
      if (um?.kind === "fuzzy") fuzzyMatches.push({ lead_id: lead.lead_id, raw: um.raw, matched: um.master_name, tier: profile.university?.university_tier });
      if (um?.kind === "fuzzy_ambiguous") fuzzyAmbiguous.push({ lead_id: lead.lead_id, raw: um.raw, candidates: um.candidates ?? 0 });
      if (um?.kind === "no_match") fuzzyNoMatch.push({ lead_id: lead.lead_id, raw: um.raw });

      // matched but tier null (post-fix should be "unranked" at minimum)
      if ((um?.kind === "by_id" || um?.kind === "fuzzy") && profile.university?.university_tier == null) {
        matchedNullTier.push(lead.lead_id);
      }

      // Course level
      const cld = resolution?.course_level_derivation;
      if (cld && cld.source === "course_name") courseDerivedFromName.push({ lead_id: lead.lead_id, raw: cld.raw, level: cld.derived });
      if (!profile.course_level && !profile.course_category) courseLevelMissing.push(lead.lead_id);

      // English proficiency source
      const er = resolution?.english_proficiency;
      if (er?.source === "named") englishNamed++;
      else if (er?.source === "other_test_scores") englishOtherFallback.push({ lead_id: lead.lead_id, raw: er.raw, ielts_eq: er.ielts_equivalent ?? null, detected: er.detected_exam ?? "?" });
      else if (er?.source === "other_test_scores_unparseable") englishOtherUnparseable.push({ lead_id: lead.lead_id, raw: er.raw });
      else if (profile.student?.english_proficiency_score == null) englishMissing++;

      result = evaluate(profile, cfg, rules);
    } catch (e: any) {
      crashes++;
      crashRows.push({ lead_id: lead.lead_id, error: e?.message ?? String(e) });
      continue;
    }

    if (missing.length === 0) profileComplete++;
    for (const r of result.rejection_reasons ?? []) reasonTally[r] = (reasonTally[r] ?? 0) + 1;
    const eligible = result.eligible_lenders.filter((l: any) => l.eligible).length;
    if (eligible > 0) anyEligible++;

    bucketSum.S += result.buckets.student.total;
    bucketSum.U += result.buckets.university.total;
    bucketSum.C += result.buckets.coapplicant.total;
    bucketCount++;

    const buckets = [result.buckets.student.total, result.buckets.university.total, result.buckets.coapplicant.total];
    const allPass = buckets.every((b: number) => b >= cfg.bucket_threshold);
    if (allPass) allBucketsPass++;
    if (eligible > 0 && !allPass) {
      suspicious.push(`${lead.lead_id}: ${eligible} eligible lender(s) but bucket(s) below threshold (S=${result.buckets.student.total} U=${result.buckets.university.total} C=${result.buckets.coapplicant.total} thr=${cfg.bucket_threshold})`);
    }
  }

  // AFTER snapshots
  const { data: leadsAfter } = await sb
    .from("student_leads").select("id, lead_id, current_stage, current_status, updated_at, assigned_admin_id")
    .neq("current_stage", "draft").eq("is_archived", false).order("lead_id");
  const [{ count: matchesAfter }, { count: stageHistAfter }, { count: commsAfter }] = await Promise.all([
    sb.from("lead_lender_matches").select("id", { count: "exact", head: true }),
    sb.from("lead_stage_history").select("id", { count: "exact", head: true }),
    sb.from("communication_logs").select("id", { count: "exact", head: true }),
  ]);

  const beforeMap = new Map(beforeLeads.map(l => [l.id, l]));
  let mutated = 0;
  for (const a of leadsAfter ?? []) {
    const b = beforeMap.get(a.id); if (!b) continue;
    if (b.current_stage !== a.current_stage || b.current_status !== a.current_status ||
        b.updated_at !== a.updated_at || b.assigned_admin_id !== a.assigned_admin_id) mutated++;
  }

  const out: string[] = [];
  out.push("\n========== BROAD READ-ONLY BRE QA REPORT ==========\n");
  out.push(`Active scoring config v${cfg.version_number}  bucket_threshold=${cfg.bucket_threshold}`);
  out.push(`Active lender rules:   ${rules.length}`);
  out.push(`Total leads checked:   ${leads.length}\n`);

  out.push("--- Crashes / errors ---");
  out.push(`  BRE crashes: ${crashes}`);
  for (const c of crashRows.slice(0, 25)) out.push(`    ${c.lead_id}: ${c.error}`);

  out.push("\n--- Bucket summary (averages over evaluated leads) ---");
  if (bucketCount > 0) {
    out.push(`  Student   avg: ${(bucketSum.S / bucketCount).toFixed(2)}`);
    out.push(`  University avg: ${(bucketSum.U / bucketCount).toFixed(2)}`);
    out.push(`  Co-app    avg: ${(bucketSum.C / bucketCount).toFixed(2)}`);
  }
  out.push(`  Profile complete (no missing fields):  ${profileComplete} / ${leads.length}`);
  out.push(`  All 3 buckets ≥ threshold:             ${allBucketsPass} / ${leads.length}`);
  out.push(`  ≥1 eligible lender returned:           ${anyEligible} / ${leads.length}`);

  out.push("\n--- University tier mapping (fix verification) ---");
  out.push(`  Matched leads with university_tier still NULL (BUG if >0): ${matchedNullTier.length}`);
  for (const id of matchedNullTier.slice(0, 10)) out.push(`    ${id}`);

  out.push("\n--- Raw-name fuzzy matching ---");
  out.push(`  Fuzzy matched (single confident hit): ${fuzzyMatches.length}`);
  for (const f of fuzzyMatches.slice(0, 15)) out.push(`    ${f.lead_id}  "${f.raw}" → "${f.matched}" (tier=${f.tier})`);
  out.push(`  Fuzzy ambiguous (multiple hits, skipped): ${fuzzyAmbiguous.length}`);
  for (const f of fuzzyAmbiguous.slice(0, 10)) out.push(`    ${f.lead_id}  "${f.raw}"  (candidates=${f.candidates})`);
  out.push(`  No master match: ${fuzzyNoMatch.length}`);
  for (const f of fuzzyNoMatch.slice(0, 10)) out.push(`    ${f.lead_id}  "${f.raw}"`);

  out.push("\n--- Course level derivation ---");
  out.push(`  Derived from course_name: ${courseDerivedFromName.length}`);
  for (const c of courseDerivedFromName.slice(0, 10)) out.push(`    ${c.lead_id}  "${c.raw}" → ${c.level}`);
  out.push(`  Course level + category both missing: ${courseLevelMissing.length}`);
  for (const id of courseLevelMissing.slice(0, 10)) out.push(`    ${id}`);

  out.push("\n--- English proficiency ---");
  out.push(`  Named test (IELTS/TOEFL/PTE/Duolingo): ${englishNamed}`);
  out.push(`  Other Test Scores fallback used:       ${englishOtherFallback.length}`);
  for (const e of englishOtherFallback.slice(0, 10)) out.push(`    ${e.lead_id}  raw="${e.raw}"  detected=${e.detected}  ielts_eq=${e.ielts_eq}`);
  out.push(`  Other Test Scores unparseable:         ${englishOtherUnparseable.length}`);
  for (const e of englishOtherUnparseable.slice(0, 10)) out.push(`    ${e.lead_id}  raw="${e.raw}"`);
  out.push(`  Missing entirely:                      ${englishMissing}`);

  out.push("\n--- Suspicious mapping cases ---");
  out.push(`  Lender eligible while bucket(s) below threshold: ${suspicious.length}`);
  for (const s of suspicious.slice(0, 15)) out.push(`    ${s}`);

  out.push("\n--- Top recurring rejection reasons ---");
  const sorted = Object.entries(reasonTally).sort((a, b) => b[1] - a[1]).slice(0, 15);
  for (const [r, n] of sorted) out.push(`  ${String(n).padStart(4)}  ${r}`);

  out.push("\n--- WRITE-VERIFICATION (all must be 0 / unchanged) ---");
  out.push(`  Leads mutated (stage/status/updated_at/assigned_admin):  ${mutated}`);
  out.push(`  lead_lender_matches  before=${matchesBefore} after=${matchesAfter}  Δ=${(matchesAfter ?? 0) - (matchesBefore ?? 0)}`);
  out.push(`  lead_stage_history   before=${stageHistBefore} after=${stageHistAfter}  Δ=${(stageHistAfter ?? 0) - (stageHistBefore ?? 0)}`);
  out.push(`  communication_logs   before=${commsBefore} after=${commsAfter}  Δ=${(commsAfter ?? 0) - (commsBefore ?? 0)}`);
  out.push("\n========== END ==========\n");

  console.log(out.join("\n"));
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
