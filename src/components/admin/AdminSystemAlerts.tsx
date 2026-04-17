import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { StageBadge } from "@/components/dashboard/StageBadge";
import { ShieldCheck, AlertTriangle, FileWarning, Clock, AlertCircle, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { AdminAlert } from "@/hooks/useAdminDashboard";

interface Props {
  data: AdminAlert[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

const categoryMeta = {
  missing_info: { label: "Missing Info", icon: FileWarning, tone: "text-orange-600 bg-orange-50" },
  docs_not_started: { label: "Docs Not Started", icon: AlertTriangle, tone: "text-amber-600 bg-amber-50" },
  stale: { label: "Stale (>48h)", icon: Clock, tone: "text-rose-600 bg-rose-50" },
} as const;

export function AdminSystemAlerts({ data, loading, error, onRetry }: Props) {
  const navigate = useNavigate();

  const grouped = {
    missing_info: data.filter((a) => a.category === "missing_info"),
    docs_not_started: data.filter((a) => a.category === "docs_not_started"),
    stale: data.filter((a) => a.category === "stale"),
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold">System Oversight</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Stage-aware alerts requiring admin attention</p>
        </div>
        {!loading && !error && (
          <span className="text-xs text-muted-foreground">{data.length} active</span>
        )}
      </div>

      {loading && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <div>
              <p className="font-medium text-sm">Alerts failed to load</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
        </div>
      )}

      {!loading && !error && data.length === 0 && (
        <EmptyState icon={ShieldCheck} title="All clear" description="No alerts at this time." />
      )}

      {!loading && !error && data.length > 0 && (
        <div className="space-y-4">
          {(Object.keys(grouped) as Array<keyof typeof grouped>).map((cat) => {
            const items = grouped[cat];
            if (items.length === 0) return null;
            const meta = categoryMeta[cat];
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`rounded-md p-1 ${meta.tone}`}>
                    <meta.icon className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {meta.label} ({items.length})
                  </p>
                </div>
                <div className="space-y-1.5">
                  {items.slice(0, 5).map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => navigate(`/leads/${a.lead_uuid}`)}
                      className="w-full text-left rounded-md border bg-card hover:bg-muted/50 transition-colors px-3 py-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-xs text-muted-foreground">{a.lead_id ?? "—"}</span>
                            <span className="text-sm font-medium truncate">{a.student_name}</span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{a.reason}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <StageBadge stage={a.stage} className="text-[10px] px-2 py-0" />
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(a.updated_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                  {items.length > 5 && (
                    <p className="text-xs text-muted-foreground pl-2">+{items.length - 5} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
