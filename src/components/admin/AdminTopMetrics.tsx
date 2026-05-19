import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Inbox, TrendingUp, BadgeCheck, Network,
  AlertCircle, RefreshCw, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminMetrics } from "@/hooks/useAdminDashboard";

export type AdminMetricKey = "action" | "pipeline" | "closed" | "partners";

interface Props {
  data: AdminMetrics | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  activeLendersCount?: number;
  onCardClick?: (key: AdminMetricKey) => void;
}

/* ---------- Inline stat tile (replaces shared StatCard locally to avoid nested card chrome) ---------- */

type Tone = "primary" | "amber" | "emerald" | "default";

const TONE: Record<Tone, { bg: string; fg: string }> = {
  primary: { bg: "bg-primary/10", fg: "text-primary" },
  amber: { bg: "bg-amber-100 dark:bg-amber-500/15", fg: "text-amber-700 dark:text-amber-400" },
  emerald: { bg: "bg-emerald-100 dark:bg-emerald-500/15", fg: "text-emerald-700 dark:text-emerald-400" },
  default: { bg: "bg-muted", fg: "text-muted-foreground" },
};

const fmtVal = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : v.toLocaleString("en-IN");

function StatTile({
  label, value, sub, icon: Icon, tone = "default", loading,
}: {
  label: string;
  value: number | null | undefined;
  sub?: ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  loading?: boolean;
}) {
  const t = TONE[tone];
  const showSkeleton = loading || value === null || value === undefined;
  return (
    <Card className="p-6 h-full rounded-2xl border-border/60 bg-card shadow-sm transition-colors group-hover:border-primary/40">
      <div className="flex items-start justify-between gap-4 h-full">
        <div className="min-w-0 flex-1 space-y-2.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground leading-tight">
            {label}
          </p>
          {showSkeleton ? (
            <Skeleton className="h-9 w-24" />
          ) : (
            <p className="text-[34px] font-semibold tabular-nums leading-none tracking-tight text-foreground">
              {fmtVal(value)}
            </p>
          )}
          {sub !== undefined && sub !== null && sub !== "" && (
            <p
              className="text-xs text-muted-foreground leading-snug line-clamp-2"
              title={typeof sub === "string" ? sub : undefined}
            >
              {sub}
            </p>
          )}
        </div>
        <div className={cn("shrink-0 flex items-center justify-center rounded-xl h-11 w-11", t.bg)}>
          <Icon className={cn("h-5 w-5", t.fg)} />
        </div>
      </div>
    </Card>
  );
}

/* ---------- Component ---------- */

export function AdminTopMetrics({ data, loading, error, onRetry, activeLendersCount, onCardClick }: Props) {
  if (error) {
    return (
      <Card className="p-6 rounded-2xl border-destructive/30 bg-destructive/5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <div>
              <p className="font-semibold">Failed to load top metrics</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
        </div>
      </Card>
    );
  }

  const fmt = (n: number | null | undefined) =>
    n === null || n === undefined ? "—" : n.toLocaleString("en-IN");

  const wrap = (key: AdminMetricKey, ariaLabel: string, node: React.ReactNode) => (
    <button
      type="button"
      aria-label={`${ariaLabel} — open details`}
      onClick={() => onCardClick?.(key)}
      className={cn(
        "group text-left rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "transition-transform hover:-translate-y-0.5 cursor-pointer",
      )}
    >
      {node}
    </button>
  );

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {wrap("action", "Action needed today",
        <StatTile
          label="Action needed today"
          value={data?.pendingAdminActions}
          sub={data ? `Review Due: ${fmt(data.reviewDue)} • Follow-up Required: ${fmt(data.followUpRequired)}` : undefined}
          icon={Inbox}
          tone="amber"
          loading={loading}
        />
      )}
      {wrap("pipeline", "Active pipeline",
        <StatTile
          label="Active pipeline"
          value={data?.totalLeads}
          sub={data ? `Sent to lender: ${fmt(data.sentToLender)} • Sanctioned: ${fmt(data.sanctionReceived)}` : undefined}
          icon={TrendingUp}
          tone="primary"
          loading={loading}
        />
      )}
      {wrap("closed", "Closed disbursed leads",
        <StatTile
          label="Closed"
          value={data?.disbursed}
          sub="Disbursed (lifetime)"
          icon={BadgeCheck}
          tone="emerald"
          loading={loading}
        />
      )}
      {wrap("partners", "Active partners",
        <StatTile
          label="Partners"
          value={data?.activePartners}
          sub={
            activeLendersCount !== undefined
              ? `Active partners on platform · ${fmt(activeLendersCount)} lenders configured`
              : "Active partners on platform"
          }
          icon={Network}
          loading={loading}
        />
      )}
    </div>
  );
}
