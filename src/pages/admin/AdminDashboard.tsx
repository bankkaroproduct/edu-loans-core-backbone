import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdminDashboard } from "@/hooks/useAdminDashboard";
import { AdminTopMetrics } from "@/components/admin/AdminTopMetrics";
import { AdminPipelineSnapshot } from "@/components/admin/AdminPipelineSnapshot";
import { AdminLeadQueue } from "@/components/admin/AdminLeadQueue";
import { AdminSystemAlerts } from "@/components/admin/AdminSystemAlerts";
import { AdminQuickActions } from "@/components/admin/AdminQuickActions";
import { formatDistanceToNow } from "date-fns";

export default function AdminDashboard() {
  const { appUser } = useAuth();
  const {
    metrics, pipeline, queue, alerts,
    filters, setFilters,
    lastRefreshedAt, refreshAll,
  } = useAdminDashboard();

  return (
    <div className="space-y-6 max-w-screen-2xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <Badge variant="outline" className="text-[10px]">
              {appUser?.role?.replace(/_/g, " ").toUpperCase()}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Cross-partner control layer • Live data from student & partner pipelines
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Updated {formatDistanceToNow(lastRefreshedAt, { addSuffix: true })}
          </span>
          <Button variant="outline" size="sm" onClick={refreshAll}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
        </div>
      </div>

      <AdminTopMetrics
        data={metrics.data}
        loading={metrics.loading}
        error={metrics.error}
        onRetry={refreshAll}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AdminPipelineSnapshot
            data={pipeline.data}
            loading={pipeline.loading}
            error={pipeline.error}
            onRetry={refreshAll}
          />
        </div>
        <AdminQuickActions />
      </div>

      <AdminLeadQueue
        data={queue.data}
        loading={queue.loading}
        error={queue.error}
        onRetry={refreshAll}
        filters={filters}
        onFiltersChange={setFilters}
        pipelineStages={pipeline.data}
      />

      <AdminSystemAlerts
        data={alerts.data}
        loading={alerts.loading}
        error={alerts.error}
        onRetry={refreshAll}
      />
    </div>
  );
}
