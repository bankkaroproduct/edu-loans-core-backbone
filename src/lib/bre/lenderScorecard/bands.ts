// Concrete scoring bands per factor (Step 2 addendum).
// Pure functions returning 0..100 raw_score plus a provenance tag.

import type { ProvenanceTag } from "./types";

export interface BandResult {
  raw_score: number;
  provenance: ProvenanceTag;
  note?: string;
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

export function scoreCibil(cibil: number | null | undefined): BandResult {
  if (cibil == null || !Number.isFinite(Number(cibil))) {
    return { raw_score: 50, provenance: "inferred", note: "CIBIL unavailable — neutral" };
  }
  const c = Number(cibil);
  if (c >= 780) return { raw_score: 100, provenance: "source_backed" };
  if (c >= 750) return { raw_score: 90, provenance: "source_backed" };
  if (c >= 720) return { raw_score: 75, provenance: "source_backed" };
  if (c >= 700) return { raw_score: 60, provenance: "proposed" };
  if (c >= 680) return { raw_score: 40, provenance: "proposed" };
  if (c >= 650) return { raw_score: 25, provenance: "proposed" };
  return { raw_score: 5, provenance: "proposed" };
}

export function scoreIncome(monthly: number | null | undefined, floor: number, floorProvenance: ProvenanceTag): BandResult {
  if (monthly == null || !Number.isFinite(Number(monthly))) {
    return { raw_score: 40, provenance: "inferred", note: "Income unavailable" };
  }
  const m = Number(monthly);
  if (m < floor) return { raw_score: 0, provenance: floorProvenance, note: `Below floor ₹${floor}` };
  const ratio = m / floor;
  if (ratio >= 3) return { raw_score: 100, provenance: floorProvenance };
  if (ratio >= 2) return { raw_score: 85, provenance: floorProvenance };
  if (ratio >= 1.5) return { raw_score: 70, provenance: floorProvenance };
  if (ratio >= 1.2) return { raw_score: 55, provenance: floorProvenance };
  return { raw_score: 40, provenance: floorProvenance };
}

export function scoreFoir(monthlyIncome: number | null | undefined, monthlyEmi: number | null | undefined): BandResult {
  if (monthlyIncome == null || monthlyEmi == null) {
    return { raw_score: 60, provenance: "inferred", note: "EMI/income missing" };
  }
  const inc = Number(monthlyIncome);
  const emi = Number(monthlyEmi);
  if (!Number.isFinite(inc) || inc <= 0) return { raw_score: 50, provenance: "inferred" };
  const foir = (emi / inc) * 100;
  if (foir <= 25) return { raw_score: 100, provenance: "proposed", note: `FOIR ${foir.toFixed(0)}%` };
  if (foir <= 35) return { raw_score: 85, provenance: "proposed", note: `FOIR ${foir.toFixed(0)}%` };
  if (foir <= 45) return { raw_score: 65, provenance: "proposed", note: `FOIR ${foir.toFixed(0)}%` };
  if (foir <= 55) return { raw_score: 35, provenance: "proposed", note: `FOIR ${foir.toFixed(0)}%` };
  return { raw_score: 10, provenance: "proposed", note: `FOIR ${foir.toFixed(0)}%` };
}

export function scoreAcademics(classX: number | null | undefined, classXII: number | null | undefined, grad: number | null | undefined): BandResult {
  const vals = [classX, classXII, grad].map((v) => (v == null ? null : Number(v))).filter((v): v is number => v != null && Number.isFinite(v));
  if (vals.length === 0) return { raw_score: 50, provenance: "inferred", note: "Marks unavailable" };
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  if (avg >= 80) return { raw_score: 100, provenance: "proposed" };
  if (avg >= 70) return { raw_score: 80, provenance: "proposed" };
  if (avg >= 60) return { raw_score: 60, provenance: "proposed" };
  if (avg >= 50) return { raw_score: 35, provenance: "proposed" };
  return { raw_score: 10, provenance: "proposed" };
}

export function scoreBacklogs(backlogs: number | null | undefined): BandResult {
  if (backlogs == null) return { raw_score: 70, provenance: "inferred" };
  const b = Number(backlogs);
  if (b <= 0) return { raw_score: 100, provenance: "proposed" };
  if (b <= 2) return { raw_score: 75, provenance: "proposed" };
  if (b <= 5) return { raw_score: 50, provenance: "proposed" };
  if (b <= 10) return { raw_score: 25, provenance: "proposed" };
  return { raw_score: 5, provenance: "proposed" };
}

export function scoreUniversityCourse(tier: string | null | undefined, isPremiere: boolean | null | undefined): BandResult {
  if (isPremiere === true) return { raw_score: 100, provenance: "source_backed", note: "Premiere list match" };
  const t = (tier || "").toString().toLowerCase();
  if (t.includes("1") || t === "tier1" || t === "a") return { raw_score: 90, provenance: "inferred" };
  if (t.includes("2") || t === "tier2" || t === "b") return { raw_score: 70, provenance: "inferred" };
  if (t.includes("3") || t === "tier3" || t === "c") return { raw_score: 45, provenance: "inferred" };
  return { raw_score: 60, provenance: "inferred", note: "Tier unknown" };
}

export function scoreLoanAmountFit(loan: number, capMin: number | null, capMax: number | null): BandResult {
  if (capMin == null && capMax == null) return { raw_score: 70, provenance: "inferred" };
  if (capMin != null && loan < capMin) return { raw_score: 20, provenance: "source_backed", note: "Below lender min" };
  if (capMax != null && loan > capMax) return { raw_score: 0, provenance: "source_backed", note: "Above lender max" };
  // Inside cap — closer to mid-range = better fit
  if (capMin != null && capMax != null) {
    const span = capMax - capMin;
    if (span <= 0) return { raw_score: 90, provenance: "source_backed" };
    const pos = (loan - capMin) / span; // 0..1
    // sweet spot 0.2..0.8
    if (pos >= 0.2 && pos <= 0.8) return { raw_score: 100, provenance: "source_backed" };
    return { raw_score: 80, provenance: "source_backed" };
  }
  return { raw_score: 85, provenance: "source_backed" };
}

export function scoreCollateralRoute(
  productType: "secured" | "unsecured" | null,
  hasCollateral: boolean | null | undefined,
  collateralNotes: string | null | undefined,
): BandResult {
  if (productType == null) return { raw_score: 0, provenance: "source_backed", note: "No supported route" };
  if (productType === "secured") {
    if (hasCollateral === true) {
      if (!collateralNotes || String(collateralNotes).trim() === "") {
        return { raw_score: 60, provenance: "proposed", note: "Collateral details missing" };
      }
      return { raw_score: 100, provenance: "source_backed" };
    }
    return { raw_score: 30, provenance: "proposed", note: "Secured route but no collateral confirmed" };
  }
  // unsecured
  return { raw_score: 90, provenance: "source_backed" };
}

export function scoreCoverage(countrySupported: boolean, courseAccepted: boolean): BandResult {
  if (countrySupported && courseAccepted) return { raw_score: 100, provenance: "source_backed" };
  if (countrySupported || courseAccepted) return { raw_score: 60, provenance: "source_backed" };
  return { raw_score: 20, provenance: "source_backed" };
}

export function scoreIncomeStability(employmentType: string | null | undefined, itrYears: number | null | undefined): BandResult {
  const t = (employmentType || "").toString().toLowerCase();
  if (t.includes("salaried") || t.includes("government") || t.includes("psu")) {
    return { raw_score: 95, provenance: "inferred" };
  }
  if (t.includes("self") || t.includes("business")) {
    const y = itrYears == null ? 0 : Number(itrYears);
    if (y >= 3) return { raw_score: 80, provenance: "proposed" };
    if (y >= 2) return { raw_score: 60, provenance: "proposed" };
    if (y >= 1) return { raw_score: 40, provenance: "proposed" };
    return { raw_score: 25, provenance: "proposed" };
  }
  return { raw_score: 50, provenance: "inferred" };
}

export function scoreProcessingOps(): BandResult {
  return { raw_score: 75, provenance: "inferred", note: "Default ops score" };
}

export const _clamp = clamp;
