import { Clock, Activity, CheckCircle2, Banknote, XCircle, Wallet, Hourglass, Info, CalendarRange } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { KPIData } from "./KPICards";
import type { CardKey } from "@/lib/dashboardDrilldowns";
import { formatINR } from "@/lib/formatCurrency";
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

type Accent = "success" | "warning" | "info" | "indigo" | "destructive" | "neutral";

const accentStyles: Record<Accent, { border: string; iconBg: string; iconText: string; valueText: string }> = {
  success: {
    border: "border-l-success",
    iconBg: "bg-success/10",
    iconText: "text-success",
    valueText: "text-success",
  },
  warning: {
    border: "border-l-warning",
    iconBg: "bg-warning/10",
    iconText: "text-warning",
    valueText: "text-warning",
  },
  info: {
    border: "border-l-info",
    iconBg: "bg-info/10",
    iconText: "text-info",
    valueText: "text-foreground",
  },
  indigo: {
    // Use info token with deeper text — keeps to design system
    border: "border-l-info",
    iconBg: "bg-info/15",
    iconText: "text-info",
    valueText: "text-foreground",
  },
  destructive: {
    border: "border-l-destructive",
    iconBg: "bg-destructive/10",
    iconText: "text-destructive",
    valueText: "text-foreground",
  },
  neutral: {
    border: "border-l-muted-foreground/40",
    iconBg: "bg-muted",
    iconText: "text-muted-foreground",
    valueText: "text-foreground",
  },
};

interface KPICardProps {
  label: string;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  tooltip: string;
  Icon: React.ElementType;
  accent: Accent;
  loading: boolean;
  onClick?: () => void;
  size?: "lg" | "md";
}

function KPICard({ label, primary, secondary, tooltip, Icon, accent, loading, onClick, size = "md" }: KPICardProps) {
  const s = accentStyles[accent];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Card
          onClick={onClick}
          className={cn(
            "relative cursor-pointer transition-all border-l-4 hover:shadow-md hover:-translate-y-0.5",
            s.border,
            size === "lg" ? "p-5" : "p-4",
          )}
        >
          <div className="flex items-start gap-3">
            <div className={cn("shrink-0 rounded-lg p-2.5", s.iconBg)}>
              <Icon className={cn("h-5 w-5", s.iconText)} />
            </div>
            <div className="min-w-0 flex-1">
              {loading ? (
                <>
                  <Skeleton className="h-6 w-24 mb-1" />
                  {secondary && <Skeleton className="h-3 w-20" />}
                </>
              ) : (
                <>
                  <p
                    className={cn(
                      "font-extrabold tracking-tight truncate",
                      size === "lg" ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl",
                      s.valueText,
                    )}
                  >
                    {primary}
                  </p>
                  {secondary && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{secondary}</p>
                  )}
                </>
              )}
              <p className="text-xs font-medium text-muted-foreground mt-1 truncate" title={label}>
                {label}
              </p>
            </div>
            <Info className="h-3 w-3 text-muted-foreground/50 absolute top-2 right-2" aria-label="Definition" />
          </div>
        </Card>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
      {children}
    </p>
  );
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

const loanAccent: Record<LoanMetric["key"], Accent> = {
  active: "info",
  sanctioned: "indigo",
  disbursed: "indigo",
};

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

const secondaryAccent: Record<SecondaryLoanMetric["key"], Accent> = {
  rejected: "destructive",
  payout_released: "success",
  payout_pending: "neutral",
};

const loanLabelOverride: Partial<Record<LoanMetric["key"], string>> = {
  active: "Active Loan Pipeline",
};

const secondaryLabelOverride: Partial<Record<SecondaryLoanMetric["key"], string>> = {
  rejected: "Rejected & Dropped",
};

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

export function HeroPerformanceStrip({ kpiData, loanMetrics, secondaryLoanMetrics, loading, onCardClick }: Props) {
  const open = (key: CardKey) => onCardClick?.(key);
  const { rangeLabel, fieldLabel } = useDashboardDateFilter();

  return (
    <div className="space-y-5">
      {/* Active filter context caption */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarRange className="h-3.5 w-3.5" />
        <span>
          Showing: <span className="font-medium text-foreground">{rangeLabel}</span>
          <span className="mx-1.5 opacity-50">·</span>
          <span className="font-medium text-foreground">{fieldLabel}</span>
        </span>
      </div>

      {/* Money / Payout row */}
      <section>
        <SectionLabel>Money & Payouts</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KPICard
            label="Total Accrued Payout"
            primary={formatINR(kpiData.paidPayout)}
            tooltip="Total commission accrued — pending + triggered + approved + paid. Includes amounts not yet released to your bank."
            Icon={Wallet}
            accent="success"
            loading={loading}
            onClick={() => open("total_earned")}
            size="lg"
          />
          <KPICard
            label="Pending Payout Amount"
            primary={formatINR(kpiData.pendingPayout)}
            tooltip="Total ₹ value of payout records that are pending, triggered, or approved but not yet paid out."
            Icon={Clock}
            accent="warning"
            loading={loading}
            onClick={() => open("pending_payout_amount")}
            size="lg"
          />
          {secondaryLoanMetrics?.find((m) => m.key === "payout_released") && (() => {
            const m = secondaryLoanMetrics.find((x) => x.key === "payout_released")!;
            return (
              <KPICard
                label="Total Payout Released"
                primary={formatINR(m.amount)}
                secondary={`${m.count} ${m.count === 1 ? "record" : "records"}`}
                tooltip={secondaryMetricTooltips.payout_released}
                Icon={Wallet}
                accent="success"
                loading={loading}
                onClick={() => open("payout_released")}
                size="lg"
              />
            );
          })()}
        </div>
      </section>

      {/* Pipeline row */}
      <section>
        <SectionLabel>Loan Pipeline</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {loanMetrics.map((m) => {
            const Icon = loanIconMap[m.key];
            const label = loanLabelOverride[m.key] ?? m.label;
            return (
              <KPICard
                key={m.key}
                label={label}
                primary={
                  <span className="flex items-baseline gap-2">
                    <span>{m.count}</span>
                    <span className="text-xs font-medium text-muted-foreground">{m.count === 1 ? "lead" : "leads"}</span>
                  </span>
                }
                secondary={formatINR(m.amount)}
                tooltip={loanMetricTooltips[m.key]}
                Icon={Icon}
                accent={loanAccent[m.key]}
                loading={loading}
                onClick={() => open(loanMetricCardKey[m.key])}
              />
            );
          })}
        </div>
      </section>

      {/* Outcome / Exception row */}
      {secondaryLoanMetrics && secondaryLoanMetrics.length > 0 && (
        <section>
          <SectionLabel>Outcomes</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {secondaryLoanMetrics
              .filter((m) => m.key !== "payout_released") // already shown in Money row
              .map((m) => {
                const Icon = secondaryIconMap[m.key];
                const label = secondaryLabelOverride[m.key] ?? m.label;
                const primary =
                  m.key === "payout_pending" ? (
                    <span className="flex items-baseline gap-2">
                      <span>{m.count}</span>
                      <span className="text-xs font-medium text-muted-foreground">records</span>
                    </span>
                  ) : (
                    <span className="flex items-baseline gap-2">
                      <span>{m.count}</span>
                      <span className="text-xs font-medium text-muted-foreground">{m.count === 1 ? "lead" : "leads"}</span>
                    </span>
                  );
                return (
                  <KPICard
                    key={m.key}
                    label={label}
                    primary={primary}
                    secondary={formatINR(m.amount)}
                    tooltip={secondaryMetricTooltips[m.key]}
                    Icon={Icon}
                    accent={secondaryAccent[m.key]}
                    loading={loading}
                    onClick={() => open(secondaryMetricCardKey[m.key])}
                  />
                );
              })}
          </div>
        </section>
      )}
    </div>
  );
}
