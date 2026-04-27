import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdminDashboard } from "@/hooks/useAdminDashboard";
import { AdminTopMetrics } from "@/components/admin/AdminTopMetrics";
import { AdminLeadQueue } from "@/components/admin/AdminLeadQueue";
import { AdminRequestsSnapshot } from "@/components/admin/AdminRequestsSnapshot";
import { PageHeader } from "@/components/shared/PageHeader";
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
      <PageHeader
        title="Admin Dashboard"
        description="Operations overview · partner pipeline at a glance"
        lastUpdated={lastRefreshedAt}
      >
        {appUser?.role && (
          <Badge variant="outline" className="text-[10px]">
            {appUser.role.replace(/_/g, " ").toUpperCase()}
          </Badge>
        )}
        <Button variant="outline" size="sm" onClick={refreshAll}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
        </Button>
      </PageHeader>

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
