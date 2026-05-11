// Builds a BreProfileInput from a stored student_leads row.
//
// Pure mapping — no fabrication. Missing fields stay null/undefined so the
// engine treats them as missing (band score 0) and rejection_reasons surface
// honestly.
//
// The async variant `buildBreProfileFromLeadAsync` additionally resolves the
// university tier from `universities_master.ranking_bucket`. Sync callers
// remain supported and simply leave `university_tier` null (engine band → 0).

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { BreProfileInput } from "./types";
import {
  computeEffectiveAcademicScore,
  normalizeAcademicScore,
  coapplicantWorkExperienceToYears,
  type EffectiveAcademicResult,
  type NormalizedScore,
} from "@/lib/academicScore";

type Lead = Tables<"student_leads">;

// ---------- enum normalization tables (config-aligned) ----------

const COUNTRY_TO_ISO: Record<string, string> = {
  "united states": "US",
  usa: "US",
  us: "US",
  "united states of america": "US",
  "united kingdom": "GB",
  uk: "GB",
  england: "GB",
  "great britain": "GB",
  canada: "CA",
  australia: "AU",
  germany: "DE",
  france: "FR",
  netherlands: "NL",
  singapore: "SG",
  ireland: "IE",
  "new zealand": "NZ",
  spain: "ES",
  italy: "IT",
  switzerland: "CH",
  sweden: "SE",
  denmark: "DK",
};

// Country-tier per active scoring config:
//   tier_1 → US/UK/CA/AU/DE
//   tier_2 → NZ/IE/SG/NL/FR
//   tier_3 → other developed
//   tier_4 → emerging
const COUNTRY_TIER_BY_ISO: Record<string, "tier_1" | "tier_2" | "tier_3" | "tier_4"> = {
  US: "tier_1",
  GB: "tier_1",
  CA: "tier_1",
  AU: "tier_1",
  DE: "tier_1",
  NZ: "tier_2",
  IE: "tier_2",
  SG: "tier_2",
  NL: "tier_2",
  FR: "tier_2",
  ES: "tier_3",
  IT: "tier_3",
  CH: "tier_3",
  SE: "tier_3",
  DK: "tier_3",
};

// Co-applicant relationship → engine value (parent / sibling / spouse / relative / other).
const RELATIONSHIP_MAP: Record<string, string> = {
  father: "parent",
  mother: "parent",
  parent: "parent",
  guardian: "parent",
  brother: "sibling",
  sister: "sibling",
  sibling: "sibling",
  spouse: "spouse",
  husband: "spouse",
  wife: "spouse",
  uncle: "relative",
  aunt: "relative",
  cousin: "relative",
  "father-in-law": "relative",
  "mother-in-law": "relative",
  "brother-in-law": "relative",
  "sister-in-law": "relative",
  relative: "relative",
};

// Employment type → engine value. The BRE config only distinguishes salaried_govt
// vs salaried_private — the lead form captures the broad "Salaried" label, so
// without a Govt/PSU flag we can only honestly map to salaried_private.
const EMPLOYMENT_MAP: Record<string, string> = {
  salaried: "salaried_private",
  "salaried (private)": "salaried_private",
  "salaried private": "salaried_private",
  "salaried (govt / psu)": "salaried_govt",
  "salaried govt": "salaried_govt",
  "salaried govt/psu": "salaried_govt",
  "self-employed": "self_employed_business",
  "self employed": "self_employed_business",
  "self-employed business": "self_employed_business",
  "business owner": "self_employed_business",
  "self-employed professional": "self_employed_professional",
  professional: "self_employed_professional",
  retired: "retired_with_pension",
  "retired (pension)": "retired_with_pension",
  unemployed: "unemployed",
};

// Course category → engine value (stem / mba / management / healthcare / arts / other).
const COURSE_CATEGORY_MAP: Record<string, string> = {
  stem: "stem",
  "stem (science/tech/eng/math)": "stem",
  mba: "mba",
  "executive mba": "mba",
  business: "management",
  management: "management",
  "management / business": "management",
  healthcare: "healthcare",
  medical: "healthcare",
  arts: "arts",
  humanities: "arts",
  "arts / humanities": "arts",
};

// Free-text course-name keyword fallback when explicit course_category is null
// or unmapped. Returns the matched category AND the keyword that triggered it
// so the BRE trace can document the decision.
//
// Categories follow the active scoring config bands:
//   stem / mba / management / healthcare / arts / other
// Accounting, commerce, banking, finance, audit, taxation, fintech, supply
// chain, project/operations management, business analytics all map to
// `management` (no separate finance/commerce band exists; management is the
// closest business/commerce discipline per product decision).
export function deriveCourseCategoryFromName(
  name: string | null | undefined,
): { category: string; keyword: string } | null {
  if (!name) return null;
  const n = name.toLowerCase();

  // Ordered list: most-specific first. First match wins.
  const patterns: Array<{ keyword: string; category: string; re: RegExp }> = [
    // MBA / management graduate programs
    { keyword: "mba", category: "mba", re: /\bmba\b/ },
    { keyword: "master of business", category: "mba", re: /master of business/ },
    { keyword: "pgdm", category: "mba", re: /\bpgdm\b/ },
    { keyword: "post graduate diploma in management", category: "mba", re: /post[- ]?graduate diploma in management/ },

    // STEM
    { keyword: "engineering", category: "stem", re: /engineer/ },
    { keyword: "computer", category: "stem", re: /computer/ },
    { keyword: "data science", category: "stem", re: /data ?science|\bdata\b/ },
    { keyword: "information technology", category: "stem", re: /information|\bit\b/ },
    { keyword: "stem", category: "stem", re: /\bstem\b/ },
    { keyword: "physics", category: "stem", re: /physics/ },
    { keyword: "chemistry", category: "stem", re: /chem/ },
    { keyword: "mathematics", category: "stem", re: /math/ },
    { keyword: "biology", category: "stem", re: /bio/ },
    { keyword: "cyber security", category: "stem", re: /cyber ?sec(?:u(?:i)?r)?ity|infosec|information security/ },
    { keyword: "analytics", category: "stem", re: /(?<!business )analytics/ },
    { keyword: "ai", category: "stem", re: /\bai\b|artificial intelligence/ },
    { keyword: "machine learning", category: "stem", re: /\bml\b|machine learning|deep learning/ },
    { keyword: "software", category: "stem", re: /software/ },
    { keyword: "cloud", category: "stem", re: /cloud/ },
    { keyword: "networking", category: "stem", re: /network(?:ing)?/ },
    { keyword: "robotics", category: "stem", re: /robotics|mechatronics/ },
    { keyword: "ms / msc", category: "stem", re: /\b(ms|m\.s\.?|msc|m\.sc)\b/ },

    // Healthcare (before management so "pharma management" stays healthcare)
    { keyword: "medical", category: "healthcare", re: /medic/ },
    { keyword: "nursing", category: "healthcare", re: /nurs/ },
    { keyword: "health", category: "healthcare", re: /health/ },
    { keyword: "pharma", category: "healthcare", re: /pharma/ },
    { keyword: "dental", category: "healthcare", re: /dental/ },
    { keyword: "clinical", category: "healthcare", re: /clinic/ },

    // Management / Business / Commerce / Finance (mapped to `management`)
    { keyword: "professional accounting", category: "management", re: /professional accounting/ },
    { keyword: "accounting", category: "management", re: /accounting|accountancy/ },
    { keyword: "commerce", category: "management", re: /commerce/ },
    { keyword: "banking", category: "management", re: /banking/ },
    { keyword: "financial management", category: "management", re: /financial management/ },
    { keyword: "finance", category: "management", re: /finance|financial/ },
    { keyword: "economics", category: "management", re: /economic/ },
    { keyword: "investment", category: "management", re: /investment/ },
    { keyword: "audit", category: "management", re: /\baudit/ },
    { keyword: "taxation", category: "management", re: /taxation|\btax\b/ },
    { keyword: "fintech", category: "management", re: /fintech/ },
    { keyword: "actuarial", category: "management", re: /actuarial/ },
    { keyword: "business analytics", category: "management", re: /business analytics/ },
    { keyword: "supply chain", category: "management", re: /supply chain/ },
    { keyword: "operations management", category: "management", re: /operations management|operations/ },
    { keyword: "project management", category: "management", re: /project management/ },
    { keyword: "marketing", category: "management", re: /marketing/ },
    { keyword: "hr", category: "management", re: /\bhr\b|human resource/ },
    { keyword: "management", category: "management", re: /management/ },
    { keyword: "business", category: "management", re: /business/ },

    // Arts / Humanities
    { keyword: "arts", category: "arts", re: /\barts?\b/ },
    { keyword: "humanities", category: "arts", re: /humanit/ },
    { keyword: "literature", category: "arts", re: /literat/ },
    { keyword: "history", category: "arts", re: /history/ },
    { keyword: "philosophy", category: "arts", re: /philosop/ },
    { keyword: "design", category: "arts", re: /design/ },
    { keyword: "music", category: "arts", re: /music/ },
  ];

  for (const p of patterns) {
    if (p.re.test(n)) return { category: p.category, keyword: p.keyword };
  }
  return null;
}

// universities_master.ranking_bucket → engine university_tier.
//
// `matched` indicates a university row was confidently resolved (by id or
// fuzzy name match). When matched but the ranking_bucket is NULL/empty, we
// honestly map to "unranked" (the scoring config has a band for that). When
// not matched, we return null so the engine treats it as missing (band → 0).
function rankingBucketToTier(
  bucket: string | null | undefined,
  matched = false,
): string | null {
  if (!bucket) return matched ? "unranked" : null;
  const b = String(bucket).trim().toLowerCase();
  if (b === "top 10" || b === "top_10" || b === "premium") return "premium";
  if (b === "top 20" || b === "top_20" || b === "top 50" || b === "top_50") return "tier_1";
  if (b === "top 100" || b === "top_100") return "tier_2";
  if (b === "top 200" || b === "top_200") return "tier_3";
  return "unranked";
}

// Normalize "high" / "medium" / "low" to a stable enum value matching the
// active scoring config band keys. Returns null when input is missing/invalid.
function normalizeEmployabilityOutlook(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = String(raw).trim().toLowerCase();
  if (v === "high" || v === "medium" || v === "low") return v;
  return null;
}

// Derive course_level from a free-text course name. Mirrors the active scoring
// config enum: masters / phd / bachelors / diploma. Returns null when nothing
// matches — engine then scores the band as 0 (honest default).
function deriveCourseLevelFromName(name: string | null | undefined): string | null {
  if (!name) return null;
  const n = name.toLowerCase();
  // PhD / doctorate
  if (/\b(phd|ph\.d\.?|doctor(ate|al)?)\b/.test(n)) return "phd";
  // Diploma / certificate
  if (/\b(diploma|pg ?diploma|pgdm|certificate)\b/.test(n)) return "diploma";
  // Masters: MBA/MS/MSc/MA/MTech/ME/MCom/LLM/MPhil/Master(s)
  if (
    /\b(mba|executive mba|emba|m\.?s\.?c?|m\.?a\.?|m\.?tech|m\.?e\.?|m\.?com|llm|m\.?phil|masters?|master of)\b/.test(
      n,
    )
  ) {
    return "masters";
  }
  // Bachelors: B.Tech/BE/BBA/BSc/BA/BCom/LLB/Bachelor(s)
  if (
    /\b(b\.?tech|b\.?e\.?|bba|b\.?sc|b\.?a\.?|b\.?com|llb|bachelors?|bachelor of|undergrad(uate)?)\b/.test(
      n,
    )
  ) {
    return "bachelors";
  }
  return null;
}

// Lightweight normalizer for fuzzy-matching free-text university names against
// universities_master rows. Lowercases, strips punctuation, collapses spaces.
function normalizeUniversityName(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- helpers ----------

function toIso(name: string | null | undefined): string {
  if (!name) return "";
  const k = String(name).trim().toLowerCase();
  return COUNTRY_TO_ISO[k] ?? String(name).trim().toUpperCase();
}

function normRelationship(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const k = String(raw).trim().toLowerCase();
  return RELATIONSHIP_MAP[k] ?? "other";
}

function normEmployment(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const k = String(raw).trim().toLowerCase();
  return EMPLOYMENT_MAP[k] ?? null;
}

export interface CourseCategoryResolution {
  course_name: string | null;
  original: string | null;
  derived: string | null;
  source: "explicit" | "course_name_keyword" | "default_other" | "none";
  matched_keyword?: string;
}

function normCourseCategory(
  rawCat: string | null | undefined,
  courseName: string | null | undefined,
): { value: string | null; resolution: CourseCategoryResolution } {
  const original = rawCat ? String(rawCat).trim() : null;
  const cn = courseName ? String(courseName).trim() : null;

  // 1) Explicit mapping
  const fromCat = original
    ? COURSE_CATEGORY_MAP[original.toLowerCase()] ?? null
    : null;
  if (fromCat) {
    return {
      value: fromCat,
      resolution: { course_name: cn, original, derived: fromCat, source: "explicit" },
    };
  }

  // 2) Keyword from course_name
  const fromName = deriveCourseCategoryFromName(cn);
  if (fromName) {
    return {
      value: fromName.category,
      resolution: {
        course_name: cn,
        original,
        derived: fromName.category,
        source: "course_name_keyword",
        matched_keyword: fromName.keyword,
      },
    };
  }

  // 3) Course name exists but nothing matched → default `other`
  if (cn && cn.length > 0) {
    return {
      value: "other",
      resolution: { course_name: cn, original, derived: "other", source: "default_other" },
    };
  }

  // 4) Nothing to go on
  return {
    value: null,
    resolution: { course_name: cn, original, derived: null, source: "none" },
  };
}

function parseGpa(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = String(raw).match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  // 10-point GPA → percentage equivalent (rough, only when explicitly tagged "gpa")
  if (n <= 10 && String(raw).toLowerCase().includes("gpa")) return Math.round(n * 9.5);
  return n;
}

function numFromTestScores(ts: unknown, key: string): number | null {
  if (!ts || typeof ts !== "object") return null;
  const v = (ts as Record<string, unknown>)[key];
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Convert a "years.months" shorthand (e.g. "8.2" = 8y 2m) used by the student
 * portal into a decimal year value the BRE engine expects.
 */
function workExpToYears(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  if (!/^\d+(\.\d)?$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  const [yStr, mStr = "0"] = s.split(".");
  const years = parseInt(yStr, 10) || 0;
  const months = parseInt(mStr, 10) || 0;
  return Math.round((years + months / 12) * 100) / 100;
}

// IELTS-equivalent concordance helpers (kept pure so they can be reused by
// the raw_text fallback below without duplicating thresholds).
function toeflToIelts(toefl: number): number {
  if (toefl >= 110) return 8;
  if (toefl >= 102) return 7.5;
  if (toefl >= 94) return 7;
  if (toefl >= 79) return 6.5;
  if (toefl >= 60) return 6;
  return 5;
}
function duolingoToIelts(duolingo: number): number {
  if (duolingo >= 140) return 8;
  if (duolingo >= 125) return 7.5;
  if (duolingo >= 115) return 7;
  if (duolingo >= 105) return 6.5;
  if (duolingo >= 95) return 6;
  return 5;
}
function pteToIelts(pte: number): number {
  if (pte >= 85) return 8;
  if (pte >= 76) return 7.5;
  if (pte >= 66) return 7;
  if (pte >= 58) return 6.5;
  if (pte >= 50) return 6;
  return 5;
}

export type EnglishProficiencyResolution =
  | { source: "ielts" | "toefl" | "duolingo" | "pte"; value: number }
  | {
      source: "other_test_scores";
      raw: string;
      detected_exam: "ielts" | "toefl" | "duolingo" | "pte" | "generic";
      ielts_equivalent: number;
    }
  | { source: "other_test_scores_unparseable"; raw: string }
  | { source: "none" };

/**
 * Map IELTS / TOEFL iBT / Duolingo / PTE → IELTS-equivalent band score (0–9)
 * using the standard concordance. Falls back to `test_scores.raw_text`
 * ("Other Test Scores") only when no named test is present:
 *   • exam keyword + number  → use that exam's concordance
 *   • bare number 0–9 only   → treat as generic IELTS-equivalent
 *   • anything else          → flag as unparseable (not scored, surfaced in trace)
 *
 * Honest, lossy normalization — returns { source: "none" } when nothing usable.
 */
function deriveEnglishProficiency(ts: unknown): {
  value: number | null;
  resolution: EnglishProficiencyResolution;
} {
  if (!ts || typeof ts !== "object") return { value: null, resolution: { source: "none" } };
  const obj = ts as Record<string, unknown>;

  // ---- Named tests (existing precedence preserved) ----
  const ielts = Number(obj.ielts ?? obj.ielts_overall);
  if (Number.isFinite(ielts) && ielts > 0) {
    return { value: ielts, resolution: { source: "ielts", value: ielts } };
  }
  const toefl = Number(obj.toefl ?? obj.toefl_ibt);
  if (Number.isFinite(toefl) && toefl > 0) {
    const v = toeflToIelts(toefl);
    return { value: v, resolution: { source: "toefl", value: v } };
  }
  const duolingo = Number(obj.duolingo);
  if (Number.isFinite(duolingo) && duolingo > 0) {
    const v = duolingoToIelts(duolingo);
    return { value: v, resolution: { source: "duolingo", value: v } };
  }
  const pte = Number(obj.pte);
  if (Number.isFinite(pte) && pte > 0) {
    const v = pteToIelts(pte);
    return { value: v, resolution: { source: "pte", value: v } };
  }

  // ---- Fallback: raw_text ("Other Test Scores") ----
  const rawAny = obj.raw_text;
  if (rawAny == null || rawAny === "") return { value: null, resolution: { source: "none" } };
  const raw = String(rawAny).trim();
  if (!raw) return { value: null, resolution: { source: "none" } };

  const lower = raw.toLowerCase();
  const numMatch = lower.match(/(\d+(?:\.\d+)?)/);
  const num = numMatch ? Number(numMatch[1]) : NaN;
  const hasNum = Number.isFinite(num);

  // Exam keyword + number
  if (/\bielts\b/.test(lower) && hasNum) {
    return {
      value: num,
      resolution: { source: "other_test_scores", raw, detected_exam: "ielts", ielts_equivalent: num },
    };
  }
  if (/\btoefl\b/.test(lower) && hasNum) {
    const v = toeflToIelts(num);
    return {
      value: v,
      resolution: { source: "other_test_scores", raw, detected_exam: "toefl", ielts_equivalent: v },
    };
  }
  if (/\bduolingo\b/.test(lower) && hasNum) {
    const v = duolingoToIelts(num);
    return {
      value: v,
      resolution: { source: "other_test_scores", raw, detected_exam: "duolingo", ielts_equivalent: v },
    };
  }
  if (/\bpte\b/.test(lower) && hasNum) {
    const v = pteToIelts(num);
    return {
      value: v,
      resolution: { source: "other_test_scores", raw, detected_exam: "pte", ielts_equivalent: v },
    };
  }

  // Bare number, no exam keyword. Accept only if the entire trimmed string is
  // a single numeric token AND value lies in IELTS-equivalent range 0–9.
  const isCleanNumeric = /^\d+(?:\.\d+)?$/.test(raw);
  if (isCleanNumeric && hasNum && num >= 0 && num <= 9) {
    return {
      value: num,
      resolution: { source: "other_test_scores", raw, detected_exam: "generic", ielts_equivalent: num },
    };
  }

  // Number outside 0–9 with no keyword, or any non-numeric content with no
  // recognised exam keyword → do not guess.
  return { value: null, resolution: { source: "other_test_scores_unparseable", raw } };
}

// ---------- public types ----------

export interface BuildProfileMissing {
  field: string;
  label: string;
}

/**
 * Optional metadata describing how derived/resolved values were obtained.
 * Surfaced by the Admin "Run BRE" trace so reviewers can see exactly why a
 * field was scored a certain way (e.g. fuzzy university match, course-level
 * heuristic). Empty/undefined fields mean "no resolution applied".
 */
export interface BuildProfileResolution {
  university_match?:
    | { kind: "by_id"; master_name: string; ranking_bucket: string | null; employability_outlook: string | null }
    | { kind: "fuzzy"; raw: string; master_name: string; ranking_bucket: string | null; employability_outlook: string | null }
    | { kind: "ambiguous"; raw: string; candidates: string[] }
    | { kind: "no_match"; raw: string }
    | { kind: "none" };
  course_level_derivation?: { source: "course_name"; raw: string; derived: string } | { kind: "none" };
  /** Course-category derivation trace (explicit / keyword / default_other / none). */
  course_category_derivation?: CourseCategoryResolution;
  english_proficiency?: EnglishProficiencyResolution;
  /**
   * Derived collateral state for UI display.
   *  - "secured":               collateral_available = true AND collateral_notes provided
   *  - "secured_review_needed": collateral_available = true but collateral_notes blank
   *  - "unsecured":             collateral_available = false OR null/blank
   *
   * Engine `collateral_route` follows the same fork ("secured" / "unsecured"); the
   * `_review_needed` flavor is purely a UI hint and does not change engine routing.
   */
  collateral_state?: "secured" | "secured_review_needed" | "unsecured";
  /** Effective academic score derivation (Graduation ± Highest Qualification). */
  academic?: EffectiveAcademicResult;
  /** 10th score normalization (raw → normalized %). */
  class_x?: NormalizedScore;
  /** 12th score normalization (raw → normalized %). */
  class_xii?: NormalizedScore;
  /** Co-applicant work experience derivation. */
  coapplicant_work_experience?: {
    years: number | null;
    months: number | null;
    decimal_years: number | null;
    mapped_to: "income_stability_years" | "none";
  };
}

export interface BuildProfileResult {
  profile: BreProfileInput;
  missing: BuildProfileMissing[];
  resolution?: BuildProfileResolution;
}

// ---------- core mapping (sync) ----------

/**
 * Sync mapper — does not resolve university tier (kept null). Use the async
 * variant when lender recommendations / live BRE evaluation are needed.
 */
export function buildBreProfileFromLead(lead: Lead): BuildProfileResult {
  return buildProfileCore(lead, { universityTier: null, employabilityOutlook: null }, undefined);
}

/**
 * Async mapper — resolves university tier from `universities_master.ranking_bucket`
 * AND `employability_outlook` when `lead.university_id` is present. When
 * `university_id` is null but `university_name_raw` exists, attempts a single-
 * confident fuzzy match (country-scoped, normalized) and uses the matched row.
 * All other normalization is identical to the sync variant.
 */
export async function buildBreProfileFromLeadAsync(lead: Lead): Promise<BuildProfileResult> {
  let universityTier: string | null = null;
  let employabilityOutlook: string | null = null;
  const resolution: BuildProfileResolution = { university_match: { kind: "none" } };

  if (lead.university_id) {
    const { data } = await supabase
      .from("universities_master")
      .select("university_name, ranking_bucket, employability_outlook")
      .eq("id", lead.university_id)
      .maybeSingle();
    universityTier = rankingBucketToTier(data?.ranking_bucket ?? null, !!data);
    employabilityOutlook = normalizeEmployabilityOutlook(data?.employability_outlook ?? null);
    if (data) {
      resolution.university_match = {
        kind: "by_id",
        master_name: data.university_name,
        ranking_bucket: data.ranking_bucket ?? null,
        employability_outlook: data.employability_outlook ?? null,
      };
    }
  } else if (lead.university_name_raw && lead.intended_study_country) {
    // Country-scoped fuzzy match. We require exactly one normalized hit to
    // resolve; ambiguous or zero hits are flagged in the trace and leave the
    // engine to score university_tier as 0 (honest default).
    const normRaw = normalizeUniversityName(lead.university_name_raw);
    if (normRaw) {
      const { data: rows } = await supabase
        .from("universities_master")
        .select("id, university_name, university_name_normalized, country, ranking_bucket, employability_outlook, aliases")
        .eq("active_flag", true)
        .ilike("country", lead.intended_study_country);

      const candidates = (rows ?? []).filter((r) => {
        const candNames = [r.university_name, r.university_name_normalized, ...(r.aliases ?? [])]
          .filter(Boolean)
          .map((s) => normalizeUniversityName(s as string));
        return candNames.some((n) => n === normRaw || n.includes(normRaw) || normRaw.includes(n));
      });

      if (candidates.length === 1) {
        const c = candidates[0];
        universityTier = rankingBucketToTier(c.ranking_bucket ?? null, true);
        employabilityOutlook = normalizeEmployabilityOutlook(c.employability_outlook ?? null);
        resolution.university_match = {
          kind: "fuzzy",
          raw: lead.university_name_raw,
          master_name: c.university_name,
          ranking_bucket: c.ranking_bucket ?? null,
          employability_outlook: c.employability_outlook ?? null,
        };
      } else if (candidates.length > 1) {
        resolution.university_match = {
          kind: "ambiguous",
          raw: lead.university_name_raw,
          candidates: candidates.slice(0, 5).map((c) => c.university_name),
        };
      } else {
        resolution.university_match = { kind: "no_match", raw: lead.university_name_raw };
      }
    }
  }

  return buildProfileCore(lead, { universityTier, employabilityOutlook }, resolution);
}

function buildProfileCore(
  lead: Lead,
  resolved: { universityTier: string | null; employabilityOutlook: string | null },
  resolution: BuildProfileResolution | undefined,
): BuildProfileResult {
  const missing: BuildProfileMissing[] = [];

  // ---- loan request context ----
  const destinationIso = toIso(lead.intended_study_country);
  if (!destinationIso) missing.push({ field: "intended_study_country", label: "Study country" });
  const countryTier = COUNTRY_TIER_BY_ISO[destinationIso] ?? (destinationIso ? "tier_4" : null);

  const loanAmount = lead.loan_amount_required != null ? Number(lead.loan_amount_required) : 0;
  if (!loanAmount || loanAmount <= 0) missing.push({ field: "loan_amount_required", label: "Loan amount" });

  const courseCategoryResult = normCourseCategory(lead.course_category, lead.course_name);
  const courseCategory = courseCategoryResult.value;

  // Course level: derived from course_name when not explicitly captured on the lead.
  const derivedCourseLevel = deriveCourseLevelFromName(lead.course_name);
  const englishResult = deriveEnglishProficiency(lead.test_scores as unknown);

  // Phase 2 collateral routing.
  // Approved business mapping (does NOT depend on free-text collateral_notes for routing):
  //   collateral_available = true   → secured route
  //   collateral_available = false  → unsecured route
  //   collateral_available = null   → unsecured route (blank must NOT silently open secured)
  // Free-text `collateral_notes` only drives a UI "review needed" chip when Yes
  // is recorded without details; it does not flip the route.
  const collateralRoute: BreProfileInput["collateral_route"] =
    lead.collateral_available === true ? "secured" : "unsecured";

  const collateralNotes = (lead.collateral_notes ?? "").trim();
  const collateralState: "secured" | "secured_review_needed" | "unsecured" =
    lead.collateral_available === true
      ? collateralNotes.length > 0
        ? "secured"
        : "secured_review_needed"
      : "unsecured";

  const finalResolution: BuildProfileResolution = {
    ...(resolution ?? {}),
    course_level_derivation: derivedCourseLevel
      ? { source: "course_name", raw: lead.course_name ?? "", derived: derivedCourseLevel }
      : { kind: "none" },
    course_category_derivation: courseCategoryResult.resolution,
    english_proficiency: englishResult.resolution,
    collateral_state: collateralState,
  };

  // ---- student bucket ----
  const ts = lead.test_scores as unknown;
  const tsObj = (ts && typeof ts === "object" ? (ts as Record<string, unknown>) : {}) as Record<string, unknown>;

  // 10th and 12th — normalize using (score, total) pair when total is provided,
  // else fall back to the existing legacy parse (score-only). Backward-compat:
  // old leads without `*_total` keys keep behaving exactly as before.
  const classXNorm = normalizeAcademicScore(
    tsObj.tenth ?? tsObj.class_x ?? null,
    tsObj.tenth_total ?? null,
  );
  const classXIINorm = normalizeAcademicScore(
    tsObj.twelfth ?? tsObj.class_xii ?? null,
    tsObj.twelfth_total ?? null,
  );
  const classX = classXNorm.percentage;
  const classXII = classXIINorm.percentage;

  // Graduation marks — Effective Academic Score that considers BOTH Graduation
  // and Highest Qualification scores when both are provided.
  //   - Both present  → average(grad%, hq%) feeds graduation_marks
  //   - Only grad     → grad%
  //   - Only HQ       → HQ% (regardless of qualification level — both flows
  //                     are honest, the reason text reflects intent)
  //   - Neither       → fall back to legacy `marks_gpa`, else null
  const academicResult = computeEffectiveAcademicScore({
    graduationScore: tsObj.graduation ?? null,
    graduationTotal: tsObj.graduation_total ?? null,
    highestQualificationScore: tsObj.highest_qualification_score ?? null,
    highestQualificationTotal: tsObj.highest_qualification_total ?? null,
    highestQualificationLabel: lead.highest_qualification ?? null,
    legacyMarksGpa: lead.marks_gpa ?? null,
  });
  const graduation = academicResult.effective;

  // NOTE: entrance_rank and english_proficiency are intentionally NOT included
  // in the scoring profile. Test scores (IELTS/TOEFL/PTE/Duolingo/GRE/GMAT/SAT/
  // entrance percentile) are captured for reference only and do not contribute
  // to BRE Student-bucket scoring. Parsing helpers and resolution metadata are
  // preserved so the Admin BRE detail can still surface "captured for reference"
  // chips, but no value is fed into profile.student.
  const workExp = workExpToYears(tsObj.work_experience_years);
  // Reference englishResult so existing resolution chip continues to render.
  void englishResult;

  // ---- co-applicant bucket ----
  // NOTE: Existing EMI (coapplicant_existing_emi) and CIBIL Score
  // (test_scores.coapplicant_cibil) are intentionally NOT read here.
  // Historical values remain in the DB but are universally excluded from BRE
  // scoring (see engine.ts BRE_DEPRECATED_PARAM_KEYS). Employer/Occupation
  // (coapplicant_employer) is captured-but-unused for BRE; not mapped.
  const coIncomeMonthly = lead.coapplicant_income != null ? Number(lead.coapplicant_income) : null;

  if (coIncomeMonthly == null) missing.push({ field: "coapplicant_income", label: "Co-applicant income" });
  if (!lead.coapplicant_relation) missing.push({ field: "coapplicant_relation", label: "Co-applicant relationship" });

  const employmentType = normEmployment(lead.coapplicant_employment_type);
  const coAge = numFromTestScores(ts, "coapplicant_age");

  // Co-applicant work experience (NEW). Pure co-applicant signal — does not
  // borrow from the student's work experience anymore. Stored in test_scores
  // as `coapplicant_work_experience_years` (integer years) +
  // `coapplicant_work_experience_months` (0–11).
  const coYearsRaw = tsObj.coapplicant_work_experience_years;
  const coMonthsRaw = tsObj.coapplicant_work_experience_months;
  const coWorkExpYears = coapplicantWorkExperienceToYears(
    coYearsRaw as number | string | null | undefined,
    coMonthsRaw as number | string | null | undefined,
  );

  // Income stability: maps directly from co-applicant work experience when
  // captured. Employment-type normalization no longer gates this — if the
  // user entered years/months for the co-applicant, BRE consumes them.
  // Student work experience NEVER feeds this.
  const incomeStabilityYears = coWorkExpYears != null ? coWorkExpYears : null;

  const profile: BreProfileInput = {
    loan_amount: loanAmount,
    destination_country: destinationIso,
    course_category: courseCategory ?? undefined,
    course_level: derivedCourseLevel ?? undefined,
    collateral_route: collateralRoute,
    state: lead.state ?? undefined,
    student: {
      class_x_marks: classX,
      class_xii_marks: classXII,
      graduation_marks: graduation,
      // entrance_rank and english_proficiency intentionally omitted — test
      // scores are not used in BRE scoring (captured for reference only).
      work_experience_years: workExp,
    },
    university: {
      university_tier: resolved.universityTier,
      country_tier: countryTier,
      course_category: courseCategory ?? null,
      course_level: derivedCourseLevel,
      employability_outlook: resolved.employabilityOutlook,
    },
    coapplicant: {
      relationship: normRelationship(lead.coapplicant_relation),
      employment_type: employmentType,
      monthly_income: coIncomeMonthly,
      income_stability_years: incomeStabilityYears,
      age: coAge,
    },
  };

  // Attach academic + co-app WE resolution metadata for the BRE detail UI.
  finalResolution.academic = academicResult;
  finalResolution.class_x = classXNorm;
  finalResolution.class_xii = classXIINorm;
  finalResolution.coapplicant_work_experience = {
    years: coYearsRaw == null || coYearsRaw === "" ? null : Number(coYearsRaw),
    months: coMonthsRaw == null || coMonthsRaw === "" ? null : Number(coMonthsRaw),
    decimal_years: coWorkExpYears,
    mapped_to: incomeStabilityYears != null ? "income_stability_years" : "none",
  };

  return { profile, missing, resolution: finalResolution };
}
