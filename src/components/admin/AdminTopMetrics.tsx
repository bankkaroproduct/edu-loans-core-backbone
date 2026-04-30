import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Inbox, TrendingUp, BadgeCheck, Network,
  AlertCircle, RefreshCw,
} from "lucide-react";
import { StatCard } from "@/components/shared/StatCard";
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

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        size="lg"
        label="Action needed today"
        value={data?.pendingAdminActions}
        sub={data ? `Requests: ${fmt(data.requestsPendingApproval)} • Docs: ${fmt(data.documentsPendingReview)}` : undefined}
        icon={Inbox}
        tone="amber"
        loading={loading}
      />
      <StatCard
        size="lg"
        label="Active pipeline"
        value={data?.totalLeads}
        sub={data ? `Sent to lender: ${fmt(data.sentToLender)} • Sanctioned: ${fmt(data.sanctionReceived)}` : undefined}
        icon={TrendingUp}
        tone="primary"
        loading={loading}
      />
      <StatCard
        size="lg"
        label="Closed"
        value={data?.disbursed}
        sub="Disbursed (lifetime)"
        icon={BadgeCheck}
        tone="emerald"
        loading={loading}
      />
      <StatCard
        size="lg"
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
    </div>
  );
}
