import { Clock, AlertTriangle, Activity, CheckCircle2, Banknote, XCircle, Wallet, Hourglass, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { KPIData } from "./KPICards";
import type { CardKey } from "@/lib/dashboardDrilldowns";
import { formatINR } from "@/lib/formatCurrency";

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

const loanIconMap: Record<LoanMetric["key"], React.ElementType> = {
  active: Activity,
  sanctioned: CheckCircle2,
  disbursed: Banknote,
};

const secondaryIconMap: Record<SecondaryLoanMetric["key"], React.ElementType> = {
  rejected: XCircle,
  payout_released: Wallet,
  payout_pending: Hourglass,
};

export function HeroPerformanceStrip({ kpiData, loanMetrics, secondaryLoanMetrics, loading, onCardClick }: Props) {
  const open = (key: CardKey) => onCardClick?.(key);

  const heroMetrics: Array<{
    key: CardKey;
    label: string;
    value: string;
    icon: React.ElementType;
    tooltip: string;
  }> = [
    {
      key: "total_earned",
      label: "Total Earned",
      value: formatINR(kpiData.paidPayout),
      icon: Wallet,
      tooltip: "Total commission accrued on disbursed leads (pending + approved + paid). Includes amounts not yet released to your bank.",
    },
    {
      key: "pending_payout_amount",
      label: "Pending Payout Amount",
      value: formatINR(kpiData.pendingPayout),
      icon: Clock,
      tooltip: "Total ₹ value of payout records that are pending, triggered, or approved but not yet paid out.",
    },
  ];

  // Tooltip definitions for the loan business metrics row.
  const loanMetricTooltips: Record<LoanMetric["key"], string> = {
    active: "Submitted leads currently in the pipeline. Excludes drafts, sanctioned, disbursed, rejected, and dropped.",
    sanctioned: "All leads ever sanctioned, including those subsequently disbursed. Cumulative count.",
    disbursed: "All leads where loan funds have been released to the student or institution.",
  };

  // Tooltip definitions for the secondary loan/payout row.
  const secondaryMetricTooltips: Record<SecondaryLoanMetric["key"], string> = {
    rejected: "Leads in terminal rejected or dropped state.",
    payout_released: "Payout records that have been paid out to your bank.",
    payout_pending: "Number of payout records pending, triggered, or approved but not yet paid. Same underlying set as the top 'Pending Payout Amount' card — shown here as a record count.",
  };

  // Card-key mapping for drill-down panel routing.
  const loanMetricCardKey: Record<LoanMetric["key"], CardKey> = {
    active: "active",
    sanctioned: "sanctioned",
    disbursed: "disbursed",
  };
  const secondaryMetricCardKey: Record<SecondaryLoanMetric["key"], CardKey> = {
    rejected: "rejected",
    payout_released: "payout_released",
    payout_pending: "payout_pending",
  };

  return (
    <div className="bg-primary text-primary-foreground rounded-2xl shadow-xl overflow-hidden">
      <div className="p-6 sm:p-8 lg:p-10">
        {/* Hero Metrics — earnings/attention */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
          {heroMetrics.map((m) => {
            const Icon = m.icon;
            return (
              <Tooltip key={m.label}>
                <TooltipTrigger asChild>
                  <div
                    className="flex items-center gap-4 p-5 rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/15 hover:ring-1 hover:ring-primary-foreground/30 cursor-pointer transition-all relative"
                    onClick={() => open(m.key)}
                  >
                    <div className="bg-primary-foreground/10 p-3 rounded-full shrink-0">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      {loading ? (
                        <Skeleton className="h-8 w-24 bg-primary-foreground/20" />
                      ) : (
                        <p className="text-2xl sm:text-3xl font-extrabold tracking-tight truncate">{m.value}</p>
                      )}
                      <p className="text-xs sm:text-sm opacity-80 mt-0.5">{m.label}</p>
                    </div>
                    <Info className="h-3 w-3 opacity-50 absolute top-2 right-2" aria-label="Definition" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">
                  {m.tooltip}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Loan Business Metrics — count + INR (PRIMARY row) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 mt-6">
          {loanMetrics.map((m) => {
            const Icon = loanIconMap[m.key];
            const amountStr = formatINR(m.amount);
            return (
              <Tooltip key={m.key}>
                <TooltipTrigger asChild>
                  <div
                    className="flex items-center gap-4 p-5 rounded-xl bg-primary-foreground/5 border border-primary-foreground/10 cursor-pointer hover:bg-primary-foreground/10 hover:ring-1 hover:ring-primary-foreground/30 transition-all relative"
                    onClick={() => open(loanMetricCardKey[m.key])}
                  >
                    <div className="bg-primary-foreground/10 p-3 rounded-full shrink-0">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      {loading ? (
                        <>
                          <Skeleton className="h-7 w-20 bg-primary-foreground/20 mb-1" />
                          <Skeleton className="h-4 w-28 bg-primary-foreground/15" />
                        </>
                      ) : (
                        <>
                          <div className="flex items-baseline gap-2">
                            <p className="text-2xl sm:text-3xl font-extrabold tracking-tight">{m.count}</p>
                            <span className="text-xs opacity-80">{m.count === 1 ? "lead" : "leads"}</span>
                          </div>
                          <p className="text-sm font-semibold opacity-95 truncate" title={amountStr}>{amountStr}</p>
                        </>
                      )}
                      <p className="text-xs opacity-80 mt-0.5">{m.label}</p>
                    </div>
                    <Info className="h-3 w-3 opacity-50 absolute top-2 right-2" aria-label="Definition" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">
                  {loanMetricTooltips[m.key]}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Secondary loan/payout metrics — visually de-emphasized supporting context */}
        {secondaryLoanMetrics && secondaryLoanMetrics.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 mt-4">
            {secondaryLoanMetrics.map((m) => {
              const Icon = secondaryIconMap[m.key];
              const amountStr = formatINR(m.amount);
              return (
                <Tooltip key={m.key}>
                  <TooltipTrigger asChild>
                    <div
                      className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary-foreground/[0.06] border border-primary-foreground/10 cursor-pointer hover:bg-primary-foreground/10 hover:ring-1 hover:ring-primary-foreground/30 transition-all relative"
                      onClick={() => open(secondaryMetricCardKey[m.key])}
                    >
                      <div className="bg-primary-foreground/10 p-2 rounded-full shrink-0">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        {loading ? (
                          <>
                            <Skeleton className="h-5 w-16 bg-primary-foreground/20 mb-1" />
                            <Skeleton className="h-3 w-24 bg-primary-foreground/15" />
                          </>
                        ) : (
                          <>
                            <div className="flex items-baseline gap-2">
                              <p className="text-lg sm:text-xl font-bold tracking-tight">{m.count}</p>
                              <span className="text-[10px] opacity-80">{m.key === "rejected" ? (m.count === 1 ? "lead" : "leads") : "records"}</span>
                            </div>
                            <p className="text-xs font-medium opacity-95 truncate" title={amountStr}>{amountStr}</p>
                          </>
                        )}
                        <p className="text-[11px] opacity-80 mt-0.5 truncate" title={m.label}>{m.label}</p>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-xs">
                    {secondaryMetricTooltips[m.key]}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
