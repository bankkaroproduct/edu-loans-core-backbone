import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Inbox, TrendingUp, BadgeCheck, Network,
  AlertCircle, RefreshCw,
} from "lucide-react";
import type { AdminMetrics } from "@/hooks/useAdminDashboard";

interface Props {
  data: AdminMetrics | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  activeLendersCount?: number;
}

export function AdminTopMetrics({ data, loading, error, onRetry, activeLendersCount }: Props) {
  if (error) {
    return (
      <Card className="p-6 border-destructive/30 bg-destructive/5">
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

  const cards = [
    {
      label: "Action needed today",
      value: data?.pendingAdminActions,
      sub: data
        ? `Requests: ${fmt(data.requestsPendingApproval)} • Docs: ${fmt(data.documentsPendingReview)}`
        : "—",
      icon: Inbox,
      tone: { bg: "bg-amber-100", fg: "text-amber-700" },
    },
    {
      label: "Active pipeline",
      value: data?.totalLeads,
      sub: data
        ? `Sent to lender: ${fmt(data.sentToLender)} • Sanctioned: ${fmt(data.sanctionReceived)}`
        : "—",
      icon: TrendingUp,
      tone: { bg: "bg-primary/10", fg: "text-primary" },
    },
    {
      label: "Closed",
      value: data?.disbursed,
      sub: "Disbursed (lifetime)",
      icon: BadgeCheck,
      tone: { bg: "bg-emerald-100", fg: "text-emerald-700" },
    },
    {
      label: "Network",
      value: data?.activePartners,
      sub:
        activeLendersCount !== undefined
          ? `Active partners • ${fmt(activeLendersCount)} active lenders`
          : "Active partners",
      icon: Network,
      tone: { bg: "bg-primary/10", fg: "text-primary" },
    },
  ];

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5 min-w-0 flex-1">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide leading-tight">
                {c.label}
              </p>
              {loading || c.value === null || c.value === undefined ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold tabular-nums leading-none">{fmt(c.value)}</p>
              )}
              <p className="text-[11px] text-muted-foreground leading-tight truncate" title={c.sub}>
                {c.sub}
              </p>
            </div>
            <div className={`rounded-md ${c.tone.bg} p-2 shrink-0`}>
              <c.icon className={`h-4 w-4 ${c.tone.fg}`} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
