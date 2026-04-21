import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdminDashboard } from "@/hooks/useAdminDashboard";
import { AdminTopMetrics } from "@/components/admin/AdminTopMetrics";
import { AdminLeadQueue } from "@/components/admin/AdminLeadQueue";
import { AdminRequestsSnapshot } from "@/components/admin/AdminRequestsSnapshot";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export default function AdminDashboard() {
  const { appUser } = useAuth();
  const {
    metrics, pipeline, queue,
    filters, setFilters,
    lastRefreshedAt, refreshAll,
  } = useAdminDashboard();
  const [activeLendersCount, setActiveLendersCount] = useState<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from("lenders")
        .select("*", { count: "exact", head: true })
        .eq("active_flag", true);
      if (!cancelled) setActiveLendersCount(count ?? 0);
    })();
    return () => { cancelled = true; };
  }, [lastRefreshedAt]);

  return (
    <div className="space-y-6 max-w-screen-2xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold leading-none">Admin Dashboard</h1>
            <Badge variant="outline" className="text-[10px]">
              {appUser?.role?.replace(/_/g, " ").toUpperCase()}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground pl-7">
            Operations overview · partner pipeline at a glance
          </p>
        </div>
        <div className="flex items-center gap-3 sm:pt-1">
          <span className="text-xs text-muted-foreground">
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
        activeLendersCount={activeLendersCount}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AdminLeadQueue
            data={queue.data}
            loading={queue.loading}
            error={queue.error}
            onRetry={refreshAll}
            filters={filters}
            onFiltersChange={setFilters}
            pipelineStages={pipeline.data}
            metrics={metrics.data}
          />
        </div>
        <div>
          <AdminRequestsSnapshot />
        </div>
      </div>
    </div>
  );
}
