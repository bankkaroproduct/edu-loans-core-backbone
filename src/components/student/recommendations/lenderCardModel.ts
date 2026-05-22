/**
 * Pure mapper: BreResult → LenderCard[] for the redesigned cards.
 *
 * Read-only transform. Does NOT mutate or recompute any BRE value.
 * Every field comes straight from the engine output, the lender row,
 * or the lender's active BRE rule (`commercials`, `coverage`, `loan_caps`).
 *
 * Missing fields stay null/empty — we never fabricate.
 */
import type { BreResult, LenderMatchResult } from "@/lib/bre/types";

export interface KeyValueRow {
  key: string;
  label: string;
  value: string | null;
  subText?: string | null;
  emphasis?: "danger" | "default";
  progress?: number | null; // 0..100, for the lender-score row
}

export interface CoverageChip {
  label: string;
  covered: boolean;
}

export interface LenderFactorPill {
  label: string;
  sourceBacked: boolean;
}

export interface LenderCard {
  // Identity
  lenderId: string;
  rank: number | null;
  name: string;
  code: string | null;

  // States
  eligible: boolean;
  bestFit: boolean;

  // Score block
  score: number | null;
  scoreLabel: string | null;
  riskBand: string | null;

  // ROI hero
  roiLow: number | null;
  roiHigh: number | null;
  roiKind: string; // e.g. "UNSECURED LOAN ROI", "SECURED LOAN ROI", "ROI RANGE"
  indicativeRoi: number | null;

  // Spec table rows (rendered in order)
  rows: KeyValueRow[];

  // Coverage
  coverage: CoverageChip[];

  // Lender-specific factor pills
  lenderFactors: LenderFactorPill[];

  // Why this lender
  rationale: string[];

  // Ineligibility (when !eligible)
  ineligibilityReasons: string[];
}

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtPct(v: number | null | undefined): string | null {
  return v == null ? null : `${v}%`;
}

function fmtMoney(n: number | null | undefined): string | null {
  if (n == null) return null;
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function fmtPfRange(l: LenderMatchResult): string | null {
  const min = l.pf_pct_min;
  const max = l.pf_pct_max;
  const flat = l.pf_flat;
  const pct = l.pf_pct;
  const gst = l.pf_gst_applicable ? " + GST" : "";
  if (min != null && max != null) {
    return min === max ? `${min}%${gst}` : `${min}%–${max}%${gst}`;
  }
  if (pct != null) return `${pct}%${gst}`;
  if (flat != null) return `${fmtMoney(flat)}${gst}`;
  return null;
}

function fmtCollateral(productType: LenderMatchResult["product_type"]): string {
  if (productType === "secured") return "Secured";
  if (productType === "unsecured") return "Unsecured";
  return "—";
}

function fmtRoiKind(productType: LenderMatchResult["product_type"], source: LenderMatchResult["roi_range_source"]): string {
  if (productType === "unsecured") return "UNSECURED LOAN ROI";
  if (productType === "secured") return "SECURED LOAN ROI";
  if (source === "policy" || source === "band") return "ROI RANGE";
  return "ROI RANGE";
}

function fmtScoreLabel(p: LenderMatchResult["scorecard_provenance"]): string | null {
  if (!p) return null;
  if (p === "source_backed") return "Source-backed";
  if (p === "proposed") return "Proposed";
  if (p === "inferred") return "Inferred";
  if (p === "needs_business_validation") return "Needs validation";
  return null;
}

// ─── public ─────────────────────────────────────────────────────────────────

export function mapLenderCards(result: BreResult): LenderCard[] {
  return [...result.eligible_lenders]
    .sort((a, b) => {
      // eligible first by rank, then ineligible
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      const ra = a.rank ?? 9999;
      const rb = b.rank ?? 9999;
      return ra - rb;
    })
    .map((l, idx): LenderCard => {
      const rank = l.rank ?? idx + 1;
      const bestFit = l.badge === "best_match";

      // ── Spec table rows ──
      const rows: KeyValueRow[] = [];

      rows.push({
        key: "loan_amount",
        label: "Projected loan",
        value: fmtMoney(l.projected_loan_amount),
      });

      const pf = fmtPfRange(l);
      if (pf) rows.push({ key: "pf", label: "Processing fee", value: pf });

      rows.push({
        key: "collateral",
        label: "Collateral type",
        value: fmtCollateral(l.product_type),
      });

      // Effective ROI range (display-only field already on the result)
      if (l.effective_rate_min != null && l.effective_rate_max != null) {
        rows.push({
          key: "effective_roi",
          label: "Effective ROI",
          value: `${l.effective_rate_min}% – ${l.effective_rate_max}%`,
        });
      }

      // Projected (indicative) rate — flag as danger if it sits at the upper bound
      // of the ROI range (engine clamp produces this signal naturally).
      if (l.projected_rate != null) {
        const clamped =
          l.roi_range_max != null && l.projected_rate >= l.roi_range_max;
        rows.push({
          key: "projected_rate",
          label: "Indicative rate",
          value: `${l.projected_rate}%`,
          subText: clamped ? "At upper bound of lender ROI range" : null,
          emphasis: clamped ? "danger" : "default",
        });
      }

      if (l.payout_pct != null) {
        rows.push({
          key: "payout",
          label: "Payout",
          value: `${l.payout_pct}%`,
        });
      }

      if (l.lender_specific_score != null) {
        rows.push({
          key: "score",
          label: "Lender score",
          value: `${Math.round(l.lender_specific_score)}/100`,
          subText: l.lender_risk_band ?? null,
          progress: Math.max(0, Math.min(100, l.lender_specific_score)),
        });
      }

      // ── Coverage chips (≥70% lenders populated per audit; safe to render). ──
      const ce = l.coverage_expenses ?? {};
      const coverage: CoverageChip[] = [
        { label: "Tuition", covered: ce.tuition === true },
        { label: "Living", covered: ce.living === true },
        { label: "Travel", covered: ce.travel === true },
        { label: "Insurance", covered: ce.insurance === true },
        { label: "Other education", covered: ce.other_education_expenses === true },
      ];

      // ── Lender-specific factor pills ──
      const chips = l.lender_rationale_chips ?? l.lender_specific_rationale ?? [];
      const lenderFactors: LenderFactorPill[] = chips
        .filter((c) => c.tone !== "negative")
        .slice(0, 6)
        .map((c) => ({
          label: c.label,
          sourceBacked: c.provenance === "source_backed",
        }));

      // ── Rationale lines (collapsible) ──
      const rationale: string[] = (l.score_breakdown ?? [])
        .filter((b) => b.note && b.note.trim().length > 0)
        .map((b) => `${b.factor}: ${b.note}`)
        .slice(0, 8);
      if (rationale.length === 0 && (l.lender_specific_rationale ?? []).length > 0) {
        for (const c of l.lender_specific_rationale ?? []) {
          rationale.push(c.label);
          if (rationale.length >= 8) break;
        }
      }

      return {
        lenderId: l.lender_id,
        rank,
        name: l.lender_name,
        code: l.lender_code || null,
        eligible: l.eligible,
        bestFit,
        score: l.lender_specific_score ?? null,
        scoreLabel: fmtScoreLabel(l.scorecard_provenance),
        riskBand: l.lender_risk_band ?? null,
        roiLow: l.roi_range_min ?? l.effective_rate_min ?? null,
        roiHigh: l.roi_range_max ?? l.effective_rate_max ?? null,
        roiKind: fmtRoiKind(l.product_type, l.roi_range_source),
        indicativeRoi: l.lender_indicative_roi ?? l.risk_based_indicative_roi ?? l.projected_rate ?? null,
        rows,
        coverage,
        lenderFactors,
        rationale,
        ineligibilityReasons: l.eligible ? [] : l.reasons,
      };
    });
}
