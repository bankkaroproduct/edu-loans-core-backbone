// Read-only normalizer for the bre_lender_rules.scorecard JSONB.
// Returns a ScorecardSeed-compatible shape. Falls back to the seed catalog
// when DB scorecard is missing or malformed.

import type { ProvenanceTag, ScorecardFactorKey } from "./types";
import { type ScorecardSeed, type ScorecardWeight, getSeedForLender, DEFAULT_SEED } from "./seeds";

const VALID_PROV: ProvenanceTag[] = ["source_backed", "inferred", "proposed", "needs_business_validation"];
const VALID_FACTORS: ScorecardFactorKey[] = [
  "academics",
  "backlogs",
  "university_course",
  "cibil",
  "income",
  "emi_foir",
  "income_stability",
  "collateral_route",
  "loan_amount_fit",
  "coverage",
  "processing_ops",
];

function asProv(v: unknown): ProvenanceTag {
  return typeof v === "string" && (VALID_PROV as string[]).includes(v) ? (v as ProvenanceTag) : "proposed";
}

export interface NormalizedScorecard extends ScorecardSeed {
  source: "db" | "seed_fallback";
  needs_business_validation?: boolean;
}

export function normalizeScorecard(raw: unknown, lenderCode: string): NormalizedScorecard {
  if (!raw || typeof raw !== "object") {
    const seed = getSeedForLender(lenderCode);
    return { ...seed, source: seed === DEFAULT_SEED || !raw ? "seed_fallback" : "seed_fallback" };
  }
  const o = raw as Record<string, unknown>;
  const weightsRaw = Array.isArray(o.weights) ? (o.weights as unknown[]) : [];
  const weights: ScorecardWeight[] = weightsRaw
    .map((w) => {
      const ww = (w ?? {}) as Record<string, unknown>;
      const factor = String(ww.factor ?? "");
      if (!(VALID_FACTORS as string[]).includes(factor)) return null;
      const weight = Number(ww.weight ?? 0);
      return {
        factor: factor as ScorecardFactorKey,
        weight: Number.isFinite(weight) ? weight : 0,
        provenance: asProv(ww.provenance),
      } satisfies ScorecardWeight;
    })
    .filter((x): x is ScorecardWeight => x != null);

  if (weights.length === 0) {
    const seed = getSeedForLender(lenderCode);
    return { ...seed, source: "seed_fallback" };
  }

  return {
    source: "db",
    lender_code: lenderCode,
    display_label: typeof o.display_label === "string" ? o.display_label : `${lenderCode} scorecard`,
    weights,
    income_floor_monthly: Number(o.income_floor_monthly ?? 0) || 0,
    income_floor_provenance: asProv(o.income_floor_provenance),
    notes: typeof o.notes === "string" ? o.notes : undefined,
    needs_business_validation: o.needs_business_validation === true,
  };
}

// Aggregate worst-case provenance across the scorecard's weights.
export function aggregateProvenance(weights: ScorecardWeight[], floorProv: ProvenanceTag, needsValidation?: boolean): ProvenanceTag {
  if (needsValidation) return "needs_business_validation";
  const order: ProvenanceTag[] = ["source_backed", "inferred", "proposed", "needs_business_validation"];
  let worst: ProvenanceTag = "source_backed";
  const all: ProvenanceTag[] = [...weights.map((w) => w.provenance), floorProv];
  for (const p of all) {
    if (order.indexOf(p) > order.indexOf(worst)) worst = p;
  }
  return worst;
}
