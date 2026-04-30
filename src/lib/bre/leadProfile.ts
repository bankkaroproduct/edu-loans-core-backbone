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

// Free-text course-name keyword fallback when course_category is null.
function deriveCourseCategoryFromName(name: string | null | undefined): string | null {
  if (!name) return null;
  const n = name.toLowerCase();
  if (/\bmba\b|master of business/.test(n)) return "mba";
  if (/\b(ms|m\.s\.?|msc|m\.sc)\b|engineer|computer|data|information|tech|stem|physics|chem|math|bio/.test(n))
    return "stem";
  if (/management|business|finance|economic|marketing|hr/.test(n)) return "management";
  if (/medic|nurs|health|pharma|dental|clinic/.test(n)) return "healthcare";
  if (/arts|humanit|literat|history|philosop|design|music/.test(n)) return "arts";
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

function normCourseCategory(rawCat: string | null | undefined, courseName: string | null | undefined): string | null {
  const fromCat = rawCat ? COURSE_CATEGORY_MAP[String(rawCat).trim().toLowerCase()] ?? null : null;
  if (fromCat) return fromCat;
  return deriveCourseCategoryFromName(courseName);
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

/**
 * Map IELTS / TOEFL iBT / Duolingo / PTE → IELTS-equivalent band score (0–9)
 * using the standard concordance. Honest, lossy normalization only — returns
 * null when the test_scores blob has no recognised key.
 */
function deriveEnglishProficiency(ts: unknown): number | null {
  if (!ts || typeof ts !== "object") return null;
  const obj = ts as Record<string, unknown>;
  const ielts = Number(obj.ielts ?? obj.ielts_overall);
  if (Number.isFinite(ielts) && ielts > 0) return ielts;
  const toefl = Number(obj.toefl ?? obj.toefl_ibt);
  if (Number.isFinite(toefl) && toefl > 0) {
    if (toefl >= 110) return 8;
    if (toefl >= 102) return 7.5;
    if (toefl >= 94) return 7;
    if (toefl >= 79) return 6.5;
    if (toefl >= 60) return 6;
    return 5;
  }
  const duolingo = Number(obj.duolingo);
  if (Number.isFinite(duolingo) && duolingo > 0) {
    if (duolingo >= 140) return 8;
    if (duolingo >= 125) return 7.5;
    if (duolingo >= 115) return 7;
    if (duolingo >= 105) return 6.5;
    if (duolingo >= 95) return 6;
    return 5;
  }
  const pte = Number(obj.pte);
  if (Number.isFinite(pte) && pte > 0) {
    if (pte >= 85) return 8;
    if (pte >= 76) return 7.5;
    if (pte >= 66) return 7;
    if (pte >= 58) return 6.5;
    if (pte >= 50) return 6;
    return 5;
  }
  return null;
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
    universityTier = rankingBucketToTier(data?.ranking_bucket ?? null);
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
        universityTier = rankingBucketToTier(c.ranking_bucket ?? null);
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

  const courseCategory = normCourseCategory(lead.course_category, lead.course_name);

  // Course level: derived from course_name when not explicitly captured on the lead.
  const derivedCourseLevel = deriveCourseLevelFromName(lead.course_name);
  const finalResolution: BuildProfileResolution = {
    ...(resolution ?? {}),
    course_level_derivation: derivedCourseLevel
      ? { source: "course_name", raw: lead.course_name ?? "", derived: derivedCourseLevel }
      : { kind: "none" },
  };

  const collateralRoute: BreProfileInput["collateral_route"] =
    lead.collateral_available === true ? "either" : lead.collateral_available === false ? "unsecured" : "either";

  // ---- student bucket ----
  const ts = lead.test_scores as unknown;
  const classX = numFromTestScores(ts, "tenth") ?? numFromTestScores(ts, "class_x");
  const classXII = numFromTestScores(ts, "twelfth") ?? numFromTestScores(ts, "class_xii");
  // Graduation marks: prefer test_scores.graduation; fall back to legacy `marks_gpa` text.
  const graduation = numFromTestScores(ts, "graduation") ?? parseGpa(lead.marks_gpa);
  const entranceRank =
    numFromTestScores(ts, "entrance_percentile") ??
    numFromTestScores(ts, "entrance_rank") ??
    numFromTestScores(ts, "gre") ??
    numFromTestScores(ts, "gmat_percentile");
  const workExp = workExpToYears((ts as Record<string, unknown> | null)?.work_experience_years);
  const englishProficiency = deriveEnglishProficiency(ts);

  // ---- co-applicant bucket ----
  const coIncomeMonthly = lead.coapplicant_income != null ? Number(lead.coapplicant_income) : null;
  const coEmi = lead.coapplicant_existing_emi != null ? Number(lead.coapplicant_existing_emi) : null;
  const coEmiBurdenPct =
    coIncomeMonthly && coIncomeMonthly > 0 && coEmi != null ? Math.round((coEmi / coIncomeMonthly) * 100) : null;

  if (coIncomeMonthly == null) missing.push({ field: "coapplicant_income", label: "Co-applicant income" });
  if (!lead.coapplicant_relation) missing.push({ field: "coapplicant_relation", label: "Co-applicant relationship" });

  const employmentType = normEmployment(lead.coapplicant_employment_type);
  const coAge = numFromTestScores(ts, "coapplicant_age");
  const coCibil = numFromTestScores(ts, "coapplicant_cibil") ?? numFromTestScores(ts, "cibil_score");

  // Income stability: legitimate derivation from work_experience_years ONLY when
  // the co-applicant is salaried/self-employed and the value is present.
  // Otherwise leave null — engine treats as missing band → 0.
  const incomeStabilityYears =
    employmentType &&
    /^(salaried_private|salaried_govt|self_employed_professional|self_employed_business)$/.test(employmentType) &&
    workExp != null
      ? workExp
      : null;

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
      entrance_rank: entranceRank,
      work_experience_years: workExp,
      english_proficiency: englishProficiency,
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
      existing_emi_burden_pct: coEmiBurdenPct,
      income_stability_years: incomeStabilityYears,
      age: coAge,
      cibil_score: coCibil,
    },
  };

  return { profile, missing, resolution: finalResolution };
}
