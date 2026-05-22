import type { ReactNode } from "react";
import { T } from "./tokens";

export type SortKey = "recommended" | "lowest_rate" | "top_score" | "best_fit";

interface LeadSummary {
  intended_study_country: string;
  university_name_raw: string | null;
  course_name: string;
  loan_amount_required: number | null;
  coapplicant_name: string | null;
}

interface Props {
  eligibleCount: number;
  ineligibleCount: number;
  showingCount: number;
  totalCount: number;
  summary: LeadSummary;
  collateralLabel: string | null;
  eligibleOnly: boolean;
  onEligibleOnlyChange: (v: boolean) => void;
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
  formatAmount: (n: number | null) => ReactNode;
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "recommended", label: "Recommended" },
  { key: "lowest_rate", label: "Lowest rate" },
  { key: "top_score", label: "Top score" },
  { key: "best_fit", label: "Best fit" },
];

export function MatchesPageChrome({
  eligibleCount,
  ineligibleCount,
  showingCount,
  totalCount,
  summary,
  collateralLabel,
  eligibleOnly,
  onEligibleOnlyChange,
  sort,
  onSortChange,
  formatAmount,
}: Props) {
  const contextItems = [
    { label: "Destination", value: summary.intended_study_country || "—" },
    { label: "Course", value: summary.course_name || "—" },
    { label: "University", value: summary.university_name_raw || "—" },
    { label: "Loan amount", value: formatAmount(summary.loan_amount_required) },
    { label: "Collateral", value: collateralLabel ?? "—" },
    { label: "Co-applicant", value: summary.coapplicant_name || "—" },
  ];

  return (
    <div className="mb-4">
      {/* Title */}
      <div className="mb-4">
        <h1
          className="text-[22px] font-extrabold tracking-tight"
          style={{ letterSpacing: "-0.03em", color: T.text }}
        >
          Your lender matches
        </h1>
        <p className="mt-0.5 text-[13px]" style={{ color: T.textSecondary }}>
          {totalCount} {totalCount === 1 ? "lender" : "lenders"} ·{" "}
          <span style={{ color: T.successText, fontWeight: 600 }}>{eligibleCount} eligible</span> ·{" "}
          <span style={{ color: T.textTertiary }}>{ineligibleCount} ineligible</span>
        </p>
      </div>

      {/* Profile context strip */}
      <div
        className="rounded-xl px-3 py-2.5 mb-4"
        style={{ background: T.primaryBgSoft, border: `1px solid ${T.hairline}` }}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {contextItems.map((it) => (
            <div key={it.label} className="min-w-0">
              <div
                className="text-[9px] font-bold uppercase tracking-wider"
                style={{ color: T.textTertiary }}
              >
                {it.label}
              </div>
              <div
                className="text-[12px] font-semibold truncate"
                style={{ color: T.text }}
                title={typeof it.value === "string" ? it.value : undefined}
              >
                {it.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="text-[12px]" style={{ color: T.textSecondary }}>
          Showing <span style={{ color: T.text, fontWeight: 600 }}>{showingCount}</span> of {totalCount} lenders
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => onEligibleOnlyChange(!eligibleOnly)}
            className="rounded-full px-3 py-1 text-[11px] font-semibold transition-colors"
            style={{
              background: eligibleOnly ? T.primary : "#fff",
              color: eligibleOnly ? "#fff" : T.textSecondary,
              border: `1px solid ${eligibleOnly ? T.primary : T.hairline}`,
            }}
            aria-pressed={eligibleOnly}
          >
            Eligible only
          </button>

          <div
            className="inline-flex rounded-full p-0.5"
            style={{ background: T.screenBg, border: `1px solid ${T.hairline}` }}
            role="group"
            aria-label="Sort"
          >
            {SORT_OPTIONS.map((opt) => {
              const active = sort === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => onSortChange(opt.key)}
                  className="rounded-full px-3 py-1 text-[11px] font-semibold transition-colors"
                  style={{
                    background: active ? "#fff" : "transparent",
                    color: active ? T.primary : T.textSecondary,
                    boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : undefined,
                  }}
                  aria-pressed={active}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
