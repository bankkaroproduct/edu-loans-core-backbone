// Tiny human-readable diff helper for BRE versioning.
// Used to autofill the `change_summary` field when admins save a new version.
// Pure: takes two JSON-serialisable objects and counts top-level + per-bucket changes.

import type { BreScoringConfig, BreLenderRule } from "./types";

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function summarizeScoringConfigChanges(
  prev: BreScoringConfig | null,
  next: BreScoringConfig,
): string {
  if (!prev) return "Initial version";
  const parts: string[] = [];
  for (const key of ["student_params", "university_params", "coapplicant_params"] as const) {
    const a = prev[key] ?? [];
    const b = next[key] ?? [];
    let changed = 0;
    const max = Math.max(a.length, b.length);
    for (let i = 0; i < max; i++) {
      if (!deepEqual(a[i], b[i])) changed++;
    }
    if (changed > 0) parts.push(`${changed} ${key.replace("_params", "")} param${changed === 1 ? "" : "s"}`);
  }
  if (!deepEqual(prev.overall_band_mapping, next.overall_band_mapping)) parts.push("overall mapping");
  if (prev.bucket_threshold !== next.bucket_threshold) parts.push(`bucket threshold ${prev.bucket_threshold}→${next.bucket_threshold}`);
  return parts.length === 0 ? "No structural changes" : parts.join(", ") + " updated";
}

export function summarizeLenderRuleChanges(
  prev: BreLenderRule | null,
  next: Omit<BreLenderRule, "id" | "version_number" | "is_active">,
): string {
  if (!prev) return "Initial version";
  const sections = ["basic_info", "commercials", "hard_thresholds", "loan_caps", "collateral_ltv", "coverage", "policy"] as const;
  const changed = sections.filter((s) => !deepEqual(prev[s], next[s]));
  return changed.length === 0 ? "No structural changes" : `${changed.length} section${changed.length === 1 ? "" : "s"} updated: ${changed.join(", ")}`;
}
