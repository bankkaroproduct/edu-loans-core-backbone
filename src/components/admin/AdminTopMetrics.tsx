import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Users, Activity, Building2, GraduationCap, ClipboardList, AlertCircle, RefreshCw } from "lucide-react";
import type { AdminMetrics } from "@/hooks/useAdminDashboard";

interface Props {
  data: AdminMetrics | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

const cards = [
  { key: "totalLeads", label: "Total Leads", icon: Users },
  { key: "activeApplications", label: "Active Applications", icon: Activity },
  { key: "partnerLeads", label: "Partner Leads", icon: Building2 },
  { key: "studentDirectLeads", label: "Student-Direct", icon: GraduationCap },
  { key: "pendingReview", label: "Pending Review", icon: ClipboardList },
] as const;

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
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => {
        const value = data ? (data as any)[c.key] : null;
        return (
          <Card key={c.key} className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{c.label}</p>
                {loading || value === null ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-bold tabular-nums">{value.toLocaleString("en-IN")}</p>
                )}
              </div>
              <div className="rounded-lg bg-primary/10 p-2">
                <c.icon className="h-4 w-4 text-primary" />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
