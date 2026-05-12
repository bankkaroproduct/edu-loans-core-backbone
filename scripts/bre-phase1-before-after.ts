/**
 * Phase 1 University Ranking — Before/After CSV harness.
 *
 * For each sample university, runs evaluate() against scoring config v2 (active)
 * and v3 (inactive granular bands). Holds the rest of the lead profile constant
 * so the only variable across rows is the university bucket.
 *
 * Output: /mnt/documents/bre_university_phase1_before_after.csv
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import { evaluate } from "../src/lib/bre/engine";
import type { BreProfileInput, BreScoringConfig, BreLenderRule } from "../src/lib/bre/types";

(globalThis as any).localStorage = (globalThis as any).localStorage ?? {
  getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {}, key: () => null, length: 0,
};
(globalThis as any).window = (globalThis as any).window ?? { location: { origin: "http://localhost" } };

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

// --- vocabulary helpers (mirror src/lib/bre/leadProfile.ts) ---
const COLLAPSE_TO_LEGACY: Record<string, string> = {
  premium: "premium", tier_1: "tier_1", tier_2: "tier_2", tier_3: "tier_3",
  tier_4: "tier_3", tier_5: "tier_3",
  tier_6: "unranked", tier_7: "unranked", tier_8: "unranked",
  tier_9: "unranked", tier_10: "unranked", unranked: "unranked",
};
function globalRankToBand(rank: number | null): string | null {
  if (rank == null) return null;
  if (rank <= 10) return "premium";
  if (rank <= 50) return "tier_1";
  if (rank <= 100) return "tier_2";
  if (rank <= 200) return "tier_3";
  if (rank <= 300) return "tier_4";
  if (rank <= 500) return "tier_5";
  if (rank <= 750) return "tier_6";
  if (rank <= 1000) return "tier_7";
  if (rank <= 1200) return "tier_8";
  if (rank <= 1400) return "tier_9";
  return "tier_10";
}
function rankingBucketToTier(b: string | null): string | null {
  if (!b) return null;
  const x = b.trim().toLowerCase();
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

function loadCfg(row: any): BreScoringConfig {
  return {
    id: row.id,
    version_number: row.version_number,
    is_active: row.is_active,
    bucket_threshold: Number(row.bucket_threshold),
    student_params: row.student_params ?? [],
    university_params: row.university_params ?? [],
    coapplicant_params: row.coapplicant_params ?? [],
    overall_band_mapping: row.overall_band_mapping ?? [],
  };
}

async function main() {
  const [cfgRes, rulesRes] = await Promise.all([
    sb.from("bre_scoring_configs").select("*").in("version_number", [2, 3]),
    sb.from("bre_lender_rules").select("*").eq("is_active", true),
  ]);
  const cfgs = (cfgRes.data ?? []).map(loadCfg).sort((a, b) => a.version_number - b.version_number);
  const v2 = cfgs.find((c) => c.version_number === 2);
  const v3 = cfgs.find((c) => c.version_number === 3);
  if (!v2 || !v3) throw new Error("Missing config v2 or v3");
  const rules = (rulesRes.data ?? []) as unknown as BreLenderRule[];

  // Sample universities (by name patterns, including not-in-master "Unranked").
  const samples: Array<{ label: string; finder: () => Promise<any | null> }> = [
    { label: "Aalborg University", finder: () => findByName("Aalborg University") },
    { label: "Asia Pacific University of Technology and Innovation (APU) Malaysia", finder: () => findByName("Asia Pacific University of Technology and Innovation (APU) Malaysia") },
    { label: "George Washington University", finder: () => findByName("George Washington University") },
    { label: "King George's Medical University", finder: () => findByLike("King George%Medical%") },
    { label: "Rank 1 (sample)", finder: () => findByRank(1) },
    { label: "Rank 50 (closest available)", finder: () => findClosestRank(50) },
    { label: "Rank 500 (closest available)", finder: () => findClosestRank(500) },
    { label: "Rank 1500+ (sample)", finder: () => findRank1500Plus() },
    { label: "Unranked university (no rank/bucket)", finder: () => findUnranked() },
  ];

  async function findByName(name: string) {
    const { data } = await sb.from("universities_master").select("*").eq("university_name", name).maybeSingle();
    return data;
  }
  async function findByLike(pat: string) {
    const { data } = await sb.from("universities_master").select("*").ilike("university_name", pat).limit(1);
    return (data ?? [])[0] ?? null;
  }
  async function findByRank(r: number) {
    const { data } = await sb.from("universities_master").select("*").eq("global_rank", r).limit(1);
    return (data ?? [])[0] ?? null;
  }
  async function findClosestRank(target: number) {
    const { data } = await sb
      .from("universities_master")
      .select("*")
      .not("global_rank", "is", null)
      .order("global_rank", { ascending: true });
    const rows = data ?? [];
    if (rows.length === 0) return null;
    return rows.reduce((best, r) =>
      Math.abs((r.global_rank ?? 0) - target) < Math.abs((best.global_rank ?? 0) - target) ? r : best,
    );
  }
  async function findRank1500Plus() {
    // Prefer exact global_rank >= 1500. Otherwise fall back to imported tier_10.
    const { data: byRank } = await sb
      .from("universities_master")
      .select("*").gte("global_rank", 1500).limit(1);
    if ((byRank ?? []).length > 0) return byRank![0];
    const { data: byTier } = await sb
      .from("universities_master")
      .select("*").eq("rank_band", "tier_10").limit(1);
    return (byTier ?? [])[0] ?? null;
  }
  async function findUnranked() {
    const { data } = await sb
      .from("universities_master")
      .select("*")
      .is("global_rank", null)
      .is("ranking_bucket", null)
      .eq("active_flag", true)
      .limit(1);
    return (data ?? [])[0] ?? null;
  }

  // Baseline profile (everything constant except university bucket).
  const baseProfile = (uniBucket: BreProfileInput["university"]): BreProfileInput => ({
    loan_amount: 4_000_000,
    destination_country: "US",
    course_category: "stem",
    course_level: "masters",
    collateral_route: "unsecured",
    student: {
      age: 24,
      class_x_pct: 88,
      class_xii_pct: 86,
      graduation_pct: 78,
      academic_score: 78,
      english_proficiency: 7.5,
      work_experience_years: 1,
      cibil_score: 720,
    },
    university: uniBucket,
    coapplicant: {
      age: 50,
      relationship: "parent",
      employment_type: "salaried_private",
      annual_income: 1_800_000,
      cibil_score: 760,
      existing_emi: 15000,
      income_stability_years: 8,
    },
  });

  // Use the v3 vocabulary supportedTiers when running v3, v2 vocabulary when running v2.
  function tiersOf(cfg: BreScoringConfig): Set<string> {
    const p = cfg.university_params.find((p: any) => p.param_key === "university_tier") as any;
    return new Set((p?.bands ?? []).map((b: any) => b.value));
  }

  function uniBucketFor(master: any | null, cfg: BreScoringConfig): { tier: string | null; effective_band: string | null; source: string } {
    if (!master) return { tier: null, effective_band: null, source: "no_match" };
    // Prefer rank_band if present; else derive from global_rank.
    const grBand = master.rank_band ?? (master.global_rank != null ? globalRankToBand(master.global_rank) : null);
    const supported = tiersOf(cfg);
    if (grBand) {
      const t = supported.has(grBand) ? grBand : (COLLAPSE_TO_LEGACY[grBand] ?? "unranked");
      return { tier: t, effective_band: grBand, source: master.global_rank != null ? "global_rank" : "rank_band_only" };
    }
    const bt = rankingBucketToTier(master.ranking_bucket);
    if (bt && bt !== "unranked") {
      const t = supported.has(bt) ? bt : (COLLAPSE_TO_LEGACY[bt] ?? "unranked");
      return { tier: t, effective_band: bt, source: "ranking_bucket_fallback" };
    }
    return { tier: "unranked", effective_band: "unranked", source: "unranked_fallback" };
  }

  function buildUni(master: any | null, cfg: BreScoringConfig) {
    const { tier } = uniBucketFor(master, cfg);
    return {
      university_tier: tier,
      university_country_tier: "tier_1", // US baseline
      course_category: "stem",
      course_level: "masters",
      employability_outlook: master?.employability_outlook ?? "high",
    } as Record<string, any>;
  }

  const header = [
    "input_university","matched_master_university","country","master_id",
    "global_rank","rank_band","rank_score","fallback_source",
    "old_cfg_version","new_cfg_version",
    "old_university_tier","new_university_tier",
    "old_university_bucket_score","new_university_bucket_score",
    "old_overall_score","new_overall_score",
    "old_overall_band","new_overall_band",
    "lender_count_before","lender_count_after",
    "notes",
  ];
  const lines: string[] = [header.join(",")];

  for (const s of samples) {
    const master = await s.finder();
    const oldUni = buildUni(master, v2);
    const newUni = buildUni(master, v3);
    const profOld = baseProfile(oldUni);
    const profNew = baseProfile(newUni);
    const rOld = evaluate(profOld, v2, rules);
    const rNew = evaluate(profNew, v3, rules);
    const lenderCountOld = rOld.eligible_lenders.filter((l: any) => l.eligible).length;
    const lenderCountNew = rNew.eligible_lenders.filter((l: any) => l.eligible).length;
    const meta = uniBucketFor(master, v3);
    const notes: string[] = [];
    if (!master) notes.push("no master row");
    if (master && master.global_rank == null && master.ranking_bucket == null) notes.push("no rank or bucket data");
    if (master && master.global_rank == null && master.ranking_bucket) notes.push(`bucket fallback: ${master.ranking_bucket}`);
    if (s.label.startsWith("Rank 50") && master?.global_rank !== 50) notes.push(`closest to rank 50: rank ${master?.global_rank}`);
    if (s.label.startsWith("Rank 500") && master?.global_rank !== 500) notes.push(`closest to rank 500: rank ${master?.global_rank}`);
    lines.push([
      s.label,
      master?.university_name ?? "",
      master?.country ?? "",
      master?.id ?? "",
      master?.global_rank ?? "",
      master?.rank_band ?? "",
      master?.rank_score ?? "",
      meta.source,
      v2.version_number,
      v3.version_number,
      oldUni.university_tier ?? "",
      newUni.university_tier ?? "",
      rOld.buckets.university.total,
      rNew.buckets.university.total,
      rOld.overall_score,
      rNew.overall_score,
      rOld.overall_band?.band ?? "",
      rNew.overall_band?.band ?? "",
      lenderCountOld,
      lenderCountNew,
      notes.join("; "),
    ].map(csvEscape).join(","));
  }

  const path = "/mnt/documents/bre_university_phase1_before_after.csv";
  writeFileSync(path, lines.join("\n") + "\n", "utf8");
  console.log("Wrote", path);
  console.log(lines.join("\n"));
}

main().catch((e) => { console.error(e); process.exit(1); });
