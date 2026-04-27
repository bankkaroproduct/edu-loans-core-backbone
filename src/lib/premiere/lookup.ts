/**
 * Premiere & university-master lookup helpers.
 *
 * Two distinct functions, kept separate by design:
 *
 *  - getCollegeProfile(): used by BRE for scoring. Reads ONLY universities_master.
 *    Premiere data is never consulted here.
 *
 *  - getPremiereMatches(): used by the recommendation ranking layer AFTER BRE
 *    has produced the eligible-lender set. Returns is_premiere per lender.
 *    Never affects eligibility — only ordering.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  matchCollegeNames,
  normalizeCollegeName,
  resolveCountryCanonical,
} from "./normalize";

export interface CollegeProfile {
  matched: boolean;
  source: "universities_master" | "none";
  grade: "A" | "B" | "C" | "D" | null;
  points: number | null;
  matched_record: Record<string, unknown> | null;
  country_resolved: string | null;
  country_mismatch: boolean;
}

export interface PremiereMatchInfo {
  is_premiere: boolean;
  matched_record: Record<string, unknown> | null;
  effective: boolean;
}

export type PremiereMatchMap = Record<string, PremiereMatchInfo>;

/* ----------------------------------------------------------------- */
/* Function 1 — BRE scoring input. Premiere is NOT consulted.         */
/* ----------------------------------------------------------------- */
export async function getCollegeProfile(
  collegeName: string | null | undefined,
  country: string | null | undefined,
): Promise<CollegeProfile> {
  const empty: CollegeProfile = {
    matched: false,
    source: "none",
    grade: null,
    points: null,
    matched_record: null,
    country_resolved: null,
    country_mismatch: false,
  };
  if (!collegeName || !country) return empty;

  const collegeNorm = normalizeCollegeName(collegeName);
  const canonical = resolveCountryCanonical(country);
  if (!collegeNorm || !canonical) return empty;

  // Pass 1: name + country canonical match
  const { data: countryHits, error: e1 } = await supabase
    .from("universities_master")
    .select(
      "id, university_name, university_name_normalized, country, country_normalized, qs_rank, grade, points, grade_source, ranking_bucket",
    )
    .eq("country_normalized", canonical)
    .eq("active_flag", true);
  if (e1) {
    console.warn("[premiere.getCollegeProfile] pass1 error", e1.message);
    return empty;
  }

  const exactMatches = (countryHits ?? []).filter((r) =>
    matchCollegeNames(r.university_name_normalized ?? "", collegeNorm),
  );
  if (exactMatches.length === 1) {
    const r = exactMatches[0];
    return {
      matched: true,
      source: "universities_master",
      grade: (r.grade as CollegeProfile["grade"]) ?? null,
      points: r.points ?? null,
      matched_record: r as unknown as Record<string, unknown>,
      country_resolved: canonical,
      country_mismatch: false,
    };
  }

  // Pass 2: name-only (country relaxed)
  if (exactMatches.length === 0) {
    const { data: nameHits, error: e2 } = await supabase
      .from("universities_master")
      .select(
        "id, university_name, university_name_normalized, country, country_normalized, qs_rank, grade, points, grade_source, ranking_bucket",
      )
      .eq("active_flag", true);
    if (e2) {
      console.warn("[premiere.getCollegeProfile] pass2 error", e2.message);
      return { ...empty, country_resolved: canonical };
    }
    const relaxed = (nameHits ?? []).filter((r) =>
      matchCollegeNames(r.university_name_normalized ?? "", collegeNorm),
    );
    if (relaxed.length === 1) {
      const r = relaxed[0];
      return {
        matched: true,
        source: "universities_master",
        grade: (r.grade as CollegeProfile["grade"]) ?? null,
        points: r.points ?? null,
        matched_record: r as unknown as Record<string, unknown>,
        country_resolved: canonical,
        country_mismatch: true, // logged for ops review; does NOT block BRE
      };
    }
    // multiple hits → ambiguous → no pick
    return { ...empty, country_resolved: canonical };
  }

  // Multi-hit on country+name: ambiguous, no pick
  return { ...empty, country_resolved: canonical };
}

/* ----------------------------------------------------------------- */
/* Function 2 — Recommendation ranking input. Premiere ONLY.          */
/* ----------------------------------------------------------------- */
export async function getPremiereMatches(
  collegeName: string | null | undefined,
  country: string | null | undefined,
  lenderIds: string[],
): Promise<PremiereMatchMap> {
  const out: PremiereMatchMap = {};
  for (const id of lenderIds) {
    out[id] = { is_premiere: false, matched_record: null, effective: false };
  }
  if (!collegeName || !country || lenderIds.length === 0) return out;

  const collegeNorm = normalizeCollegeName(collegeName);
  const canonical = resolveCountryCanonical(country);
  if (!collegeNorm || !canonical) return out;

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("lender_premiere_colleges")
    .select(
      "id, lender_id, college_name_raw, college_name_normalized, country_raw, country_normalized, city, notes, effective_from, effective_to, list_version",
    )
    .in("lender_id", lenderIds)
    .eq("is_current", true)
    .eq("country_normalized", canonical);
  if (error) {
    console.warn("[premiere.getPremiereMatches] error", error.message);
    return out;
  }
  for (const row of data ?? []) {
    if (!matchCollegeNames(row.college_name_normalized, collegeNorm)) continue;
    const effective =
      (!row.effective_from || row.effective_from <= today) &&
      (!row.effective_to || row.effective_to >= today);
    if (!effective) continue; // expired entries do not premiere
    out[row.lender_id] = {
      is_premiere: true,
      matched_record: row as unknown as Record<string, unknown>,
      effective: true,
    };
  }
  return out;
}
