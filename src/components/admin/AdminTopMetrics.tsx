import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Users, Inbox, ClipboardCheck, FileSearch, Send, BadgeCheck, Banknote, Building2,
  AlertCircle, RefreshCw,
} from "lucide-react";
import type { AdminMetrics } from "@/hooks/useAdminDashboard";

interface Props {
  data: AdminMetrics | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

const cards = [
  { key: "totalLeads", label: "Total Leads", icon: Users, tone: "primary" },
  { key: "pendingAdminActions", label: "Pending Admin Actions", icon: Inbox, tone: "amber" },
  { key: "requestsPendingApproval", label: "Requests Pending", icon: ClipboardCheck, tone: "amber" },
  { key: "documentsPendingReview", label: "Docs to Verify", icon: FileSearch, tone: "amber" },
  { key: "sentToLender", label: "Sent to Lender", icon: Send, tone: "primary" },
  { key: "sanctionReceived", label: "Sanction Received", icon: BadgeCheck, tone: "emerald" },
  { key: "disbursed", label: "Disbursed", icon: Banknote, tone: "emerald" },
  { key: "activePartners", label: "Active Partners", icon: Building2, tone: "primary" },
] as const;

const toneStyles: Record<string, { bg: string; fg: string }> = {
  primary: { bg: "bg-primary/10", fg: "text-primary" },
  amber: { bg: "bg-amber-100", fg: "text-amber-700" },
  emerald: { bg: "bg-emerald-100", fg: "text-emerald-700" },
};

export function AdminTopMetrics({ data, loading, error, onRetry }: Props) {
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

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8">
      {cards.map((c) => {
        const value = data ? (data as any)[c.key] : null;
        const tone = toneStyles[c.tone];
        return (
          <Card key={c.key} className="p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 min-w-0">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide leading-tight">
                  {c.label}
                </p>
                {loading || value === null ? (
                  <Skeleton className="h-7 w-12" />
                ) : (
                  <p className="text-xl font-bold tabular-nums">{value.toLocaleString("en-IN")}</p>
                )}
              </div>
              <div className={`rounded-md ${tone.bg} p-1.5 shrink-0`}>
                <c.icon className={`h-3.5 w-3.5 ${tone.fg}`} />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
