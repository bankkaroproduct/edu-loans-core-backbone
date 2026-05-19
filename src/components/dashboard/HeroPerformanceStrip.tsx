import { Clock, Activity, CheckCircle2, Banknote, XCircle, Wallet, Hourglass, Info, CalendarRange } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { KPIData } from "./KPICards";
import type { CardKey } from "@/lib/dashboardDrilldowns";
import { formatINR, formatINRInWords } from "@/lib/formatCurrency";
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

const accentStyles: Record<Accent, { bar: string; iconBg: string; iconText: string; valueText: string; cardBg: string }> = {
  success: {
    bar: "bg-success",
    iconBg: "bg-success/15",
    iconText: "text-success",
    valueText: "text-success",
    cardBg: "bg-success/[0.06] border-success/20 hover:border-success/40",
  },
  warning: {
    bar: "bg-warning",
    iconBg: "bg-warning/15",
    iconText: "text-warning",
    valueText: "text-warning",
    cardBg: "bg-warning/[0.06] border-warning/20 hover:border-warning/40",
  },
  info: {
    bar: "bg-info",
    iconBg: "bg-info/15",
    iconText: "text-info",
    valueText: "text-foreground",
    cardBg: "bg-info/[0.06] border-info/20 hover:border-info/40",
  },
  indigo: {
    bar: "bg-info",
    iconBg: "bg-info/15",
    iconText: "text-info",
    valueText: "text-foreground",
    cardBg: "bg-info/[0.06] border-info/20 hover:border-info/40",
  },
  destructive: {
    bar: "bg-destructive",
    iconBg: "bg-destructive/15",
    iconText: "text-destructive",
    valueText: "text-foreground",
    cardBg: "bg-destructive/[0.06] border-destructive/20 hover:border-destructive/40",
  },
  neutral: {
    bar: "bg-muted-foreground/40",
    iconBg: "bg-muted",
    iconText: "text-muted-foreground",
    valueText: "text-foreground",
    cardBg: "bg-muted/40 border-border/60 hover:border-border",
  },
};

interface KPICardProps {
  label: string;
  primary: React.ReactNode;
  amountWords?: string | null;
  secondary?: React.ReactNode;
  tooltip: string;
  Icon: React.ElementType;
  accent: Accent;
  loading: boolean;
  onClick?: () => void;
}

function KPICard({ label, primary, amountWords, secondary, tooltip, Icon, accent, loading, onClick }: KPICardProps) {
  const s = accentStyles[accent];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          onClick={onClick}
          className={cn(
            "group relative cursor-pointer rounded-lg bg-card border border-border/60 pl-3.5 pr-3 py-2.5",
            "shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all",
            "hover:shadow-md hover:-translate-y-0.5 hover:border-border",
            "overflow-hidden",
          )}
        >
          {/* Left accent bar */}
          <span className={cn("absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full", s.bar)} />

          <div className="flex items-start gap-2.5">
            <div className={cn("shrink-0 rounded-md p-1.5 mt-0.5", s.iconBg)}>
              <Icon className={cn("h-4 w-4", s.iconText)} />
            </div>
            <div className="min-w-0 flex-1">
              {loading ? (
                <>
                  <Skeleton className="h-5 w-20 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </>
              ) : (
                <>
                  <div className={cn("font-bold tracking-tight text-lg sm:text-xl leading-tight truncate", s.valueText)}>
                    {primary}
                  </div>
                  {amountWords && (
                    <p
                      className="text-[10px] text-muted-foreground/80 leading-tight truncate mt-0.5 first-letter:uppercase"
                      title={amountWords}
                    >
                      {amountWords}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-[11px] font-medium text-foreground/70 truncate" title={label}>
                      {label}
                    </p>
                    {secondary && (
                      <>
                        <span className="text-muted-foreground/40 text-[10px]">·</span>
                        <p className="text-[11px] text-muted-foreground truncate">{secondary}</p>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
            <Info className="h-3 w-3 text-muted-foreground/40 shrink-0 self-start mt-0.5" aria-label="Definition" />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function SectionDivider({ children, rightSlot }: { children: React.ReactNode; rightSlot?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground shrink-0">
        {children}
      </p>
      <div className="flex-1 h-px bg-border/60" />
      {rightSlot}
    </div>
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

  const filterCaption = (
    <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground shrink-0">
      <CalendarRange className="h-3 w-3" />
      <span>
        <span className="font-medium text-foreground">{rangeLabel}</span>
        <span className="mx-1 opacity-50">·</span>
        <span className="font-medium text-foreground">{fieldLabel}</span>
      </span>
    </span>
  );

  const payoutReleased = secondaryLoanMetrics?.find((m) => m.key === "payout_released");

  return (
    <div className="space-y-3">
      {/* Money / Payouts row */}
      <section>
        <SectionDivider rightSlot={filterCaption}>Money &amp; Payouts</SectionDivider>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KPICard
            label="Total Accrued Payout"
            primary={formatINR(kpiData.paidPayout)}
            amountWords={formatINRInWords(kpiData.paidPayout)}
            tooltip="Total commission accrued — pending + triggered + approved + paid. Includes amounts not yet released to your bank."
            Icon={Wallet}
            accent="success"
            loading={loading}
            onClick={() => open("total_earned")}
          />
          <KPICard
            label="Pending Payout Amount"
            primary={formatINR(kpiData.pendingPayout)}
            amountWords={formatINRInWords(kpiData.pendingPayout)}
            tooltip="Total ₹ value of payout records that are pending, triggered, or approved but not yet paid out."
            Icon={Clock}
            accent="warning"
            loading={loading}
            onClick={() => open("pending_payout_amount")}
          />
          {payoutReleased && (
            <KPICard
              label="Total Payout Released"
              primary={formatINR(payoutReleased.amount)}
              amountWords={formatINRInWords(payoutReleased.amount)}
              secondary={`${payoutReleased.count} ${payoutReleased.count === 1 ? "record" : "records"}`}
              tooltip={secondaryMetricTooltips.payout_released}
              Icon={Wallet}
              accent="success"
              loading={loading}
              onClick={() => open("payout_released")}
            />
          )}
        </div>
      </section>

      {/* Pipeline row */}
      <section>
        <SectionDivider>Loan Pipeline</SectionDivider>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {loanMetrics.map((m) => {
            const Icon = loanIconMap[m.key];
            const label = loanLabelOverride[m.key] ?? m.label;
            const hasAmount = m.amount > 0;
            return (
              <KPICard
                key={m.key}
                label={label}
                primary={
                  <span className="flex flex-col leading-tight">
                    <span className="flex items-baseline gap-1.5">
                      <span>{m.count}</span>
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {m.count === 1 ? "lead" : "leads"}
                      </span>
                    </span>
                    {hasAmount && (
                      <span className="text-sm font-semibold text-foreground/80 mt-0.5">
                        {formatINR(m.amount)}
                      </span>
                    )}
                  </span>
                }
                amountWords={hasAmount ? formatINRInWords(m.amount) : null}
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
          <SectionDivider>Outcomes</SectionDivider>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {secondaryLoanMetrics
              .filter((m) => m.key !== "payout_released")
              .map((m) => {
                const Icon = secondaryIconMap[m.key];
                const label = secondaryLabelOverride[m.key] ?? m.label;
                const unit = m.key === "payout_pending" ? "records" : m.count === 1 ? "lead" : "leads";
                const hasAmount = m.amount > 0;
                const primary = (
                  <span className="flex flex-col leading-tight">
                    <span className="flex items-baseline gap-1.5">
                      <span>{m.count}</span>
                      <span className="text-[11px] font-medium text-muted-foreground">{unit}</span>
                    </span>
                    {hasAmount && (
                      <span className="text-sm font-semibold text-foreground/80 mt-0.5">
                        {formatINR(m.amount)}
                      </span>
                    )}
                  </span>
                );
                return (
                  <KPICard
                    key={m.key}
                    label={label}
                    primary={primary}
                    amountWords={hasAmount ? formatINRInWords(m.amount) : null}
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
