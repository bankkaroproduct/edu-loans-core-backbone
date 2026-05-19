import {
  TrendingUp,
  CircleCheck,
  Banknote,
  Calendar,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { KPIData } from "./KPICards";
import type { CardKey } from "@/lib/dashboardDrilldowns";
import { useDashboardDateFilter } from "./DashboardDateFilterContext";
import { cn } from "@/lib/utils";

export interface LoanMetric {
  key: "active" | "sanctioned" | "disbursed";
  label: string;
  count: number;
  amount: number;
}

export interface SecondaryLoanMetric {
  key: "rejected" | "payout_released" | "payout_pending";
  label: string;
  count: number;
  amount: number;
}

interface Props {
  kpiData: KPIData;
  loanMetrics: LoanMetric[];
  secondaryLoanMetrics?: SecondaryLoanMetric[];
  loading: boolean;
  onCardClick?: (key: CardKey) => void;
}

// Local compact INR formatter for the dark hero. Keeps existing
// formatINR/formatINRInWords helpers in src/lib/formatCurrency.ts untouched.
function formatCompactINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "₹0";
  if (amount === 0) return "₹0";
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${Math.round(amount / 100000)}L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

interface PipelineCardProps {
  icon: React.ElementType;
  label: string;
  count: number;
  amount: number;
  accentColor: string;
  tooltip: string;
  loading: boolean;
  onClick?: () => void;
}

function PipelineCard({
  icon: Icon,
  label,
  count,
  amount,
  accentColor,
  tooltip,
  loading,
  onClick,
}: PipelineCardProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className="relative overflow-hidden text-left rounded-xl bg-white/[0.07] backdrop-blur-sm p-4 border border-white/[0.08] transition-colors hover:bg-white/[0.10] focus:outline-none focus:ring-2 focus:ring-white/20"
        >
          <span
            className="absolute top-0 left-0 right-0 h-[3px]"
            style={{ backgroundColor: accentColor }}
          />
          <div className="mb-1.5 flex items-center gap-2 text-sm">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full"
              style={{ backgroundColor: `${accentColor}25`, color: accentColor }}
            >
              <Icon size={13} />
            </span>
            <span className="text-white/50 text-sm">{label}</span>
          </div>
          {loading ? (
            <>
              <Skeleton className="h-7 w-12 mb-1 bg-white/10" />
              <Skeleton className="h-3 w-16 bg-white/10" />
            </>
          ) : (
            <>
              <div className="font-medium text-white text-2xl">{count}</div>
              <div className="mt-0.5 text-white/35 text-sm">{formatCompactINR(amount)}</div>
            </>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

interface MetricRowProps {
  dotColor: string;
  label: string;
  value: React.ReactNode;
  isZero: boolean;
  tooltip: string;
  loading: boolean;
  onClick?: () => void;
}

function MetricRow({ dotColor, label, value, isZero, tooltip, loading, onClick }: MetricRowProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className="w-full flex items-center justify-between py-1.5 border-b border-white/[0.06] last:border-b-0 text-left transition-colors hover:bg-white/[0.03] -mx-1 px-1 rounded focus:outline-none focus:ring-1 focus:ring-white/20"
        >
          <span className="flex items-center gap-2 text-white/50 text-xs">
            <span
              className="inline-block h-[7px] w-[7px] rounded-full flex-shrink-0"
              style={{ backgroundColor: dotColor }}
            />
            {label}
          </span>
          {loading ? (
            <Skeleton className="h-4 w-16 bg-white/10" />
          ) : (
            <span className={cn("text-sm font-medium", isZero ? "text-white/20" : "text-white/90")}>
              {value}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

const loanMetricTooltips: Record<LoanMetric["key"], string> = {
  active: "Submitted leads currently in the pipeline. Excludes drafts, sanctioned, disbursed, rejected, and dropped.",
  sanctioned: "All leads ever sanctioned, including those subsequently disbursed. Cumulative count.",
  disbursed: "All leads where loan funds have been released to the student or institution.",
};

const secondaryMetricTooltips: Record<SecondaryLoanMetric["key"], string> = {
  rejected: "Leads in terminal rejected or dropped state.",
  payout_released: "Payout records that have been paid out to your bank.",
  payout_pending: "Number of payout records pending, triggered, or approved but not yet paid.",
};

export function HeroPerformanceStrip({
  kpiData,
  loanMetrics,
  secondaryLoanMetrics,
  loading,
  onCardClick,
}: Props) {
  const open = (key: CardKey) => onCardClick?.(key);
  const { rangeLabel, fieldLabel } = useDashboardDateFilter();

  const active = loanMetrics.find((m) => m.key === "active");
  const sanctioned = loanMetrics.find((m) => m.key === "sanctioned");
  const disbursed = loanMetrics.find((m) => m.key === "disbursed");

  const rejected = secondaryLoanMetrics?.find((m) => m.key === "rejected");
  const payoutReleased = secondaryLoanMetrics?.find((m) => m.key === "payout_released");
  const payoutPending = secondaryLoanMetrics?.find((m) => m.key === "payout_pending");

  return (
    <div className="rounded-2xl bg-[#1a1d21] p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col items-start gap-1">
        <h2 className="text-white text-lg font-bold">OVERVIEW</h2>
        <div className="flex flex-col text-sm text-white/50">
          <span>{rangeLabel}</span>
          <span className="opacity-50">·</span>
          <span>{fieldLabel}</span>
        </div>
      </div>

      {/* Pipeline — primary row */}
      <div>
        <p className="mb-2 font-medium uppercase tracking-wider text-white/30 text-sm">
          Loan pipeline
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <PipelineCard
            icon={TrendingUp}
            label="Active pipeline"
            count={active?.count ?? 0}
            amount={active?.amount ?? 0}
            accentColor="#3B82F6"
            tooltip={loanMetricTooltips.active}
            loading={loading}
            onClick={() => open("active")}
          />
          <PipelineCard
            icon={CircleCheck}
            label="Sanctioned"
            count={sanctioned?.count ?? 0}
            amount={sanctioned?.amount ?? 0}
            accentColor="#14B8A6"
            tooltip={loanMetricTooltips.sanctioned}
            loading={loading}
            onClick={() => open("sanctioned")}
          />
          <PipelineCard
            icon={Banknote}
            label="Disbursed"
            count={disbursed?.count ?? 0}
            amount={disbursed?.amount ?? 0}
            accentColor="#22C55E"
            tooltip={loanMetricTooltips.disbursed}
            loading={loading}
            onClick={() => open("disbursed")}
          />
        </div>
      </div>

      {/* Secondary row — Money + Outcomes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3.5">
          <p className="mb-2 font-medium uppercase tracking-wider text-white/30 text-sm">
            Money &amp; payouts
          </p>
          <MetricRow
            dotColor="#14B8A6"
            label="Accrued"
            value={formatCompactINR(kpiData.paidPayout)}
            isZero={!kpiData.paidPayout}
            tooltip="Total commission accrued — pending + triggered + approved + paid. Includes amounts not yet released to your bank."
            loading={loading}
            onClick={() => open("total_earned")}
          />
          <MetricRow
            dotColor="#F59E0B"
            label="Pending"
            value={formatCompactINR(kpiData.pendingPayout)}
            isZero={!kpiData.pendingPayout}
            tooltip="Total ₹ value of payout records that are pending, triggered, or approved but not yet paid out."
            loading={loading}
            onClick={() => open("pending_payout_amount")}
          />
          <MetricRow
            dotColor="#6B7280"
            label="Released"
            value={formatCompactINR(payoutReleased?.amount ?? 0)}
            isZero={!payoutReleased?.amount}
            tooltip={secondaryMetricTooltips.payout_released}
            loading={loading}
            onClick={() => open("payout_released")}
          />
        </div>

        <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3.5">
          <p className="mb-2 font-medium uppercase tracking-wider text-white/30 text-sm">
            Outcomes
          </p>
          <MetricRow
            dotColor="#EF4444"
            label="Rejected / dropped"
            value={
              (rejected?.count ?? 0) > 0 ? (
                <span>
                  {rejected!.count}{" "}
                  <span className="text-xs font-normal text-white/30">
                    · {formatCompactINR(rejected!.amount)}
                  </span>
                </span>
              ) : (
                "0"
              )
            }
            isZero={!rejected?.count}
            tooltip={secondaryMetricTooltips.rejected}
            loading={loading}
            onClick={() => open("rejected")}
          />
          <MetricRow
            dotColor="#F59E0B"
            label="Pending payouts"
            value={payoutPending?.count ?? 0}
            isZero={!payoutPending?.count}
            tooltip={secondaryMetricTooltips.payout_pending}
            loading={loading}
            onClick={() => open("payout_pending")}
          />
        </div>
      </div>
    </div>
  );
}
