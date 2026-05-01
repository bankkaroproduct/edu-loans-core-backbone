import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdminDashboard } from "@/hooks/useAdminDashboard";
import { AdminTopMetrics, type AdminMetricKey } from "@/components/admin/AdminTopMetrics";
import { AdminLeadQueue } from "@/components/admin/AdminLeadQueue";
import { AdminRequestsSnapshot } from "@/components/admin/AdminRequestsSnapshot";
import { PageHeader } from "@/components/shared/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { ActionNeededDrillDown } from "@/components/admin/drilldowns/ActionNeededDrillDown";
import { ActivePipelineDrillDown } from "@/components/admin/drilldowns/ActivePipelineDrillDown";
import { ClosedDrillDown } from "@/components/admin/drilldowns/ClosedDrillDown";
import { PartnersDrillDown } from "@/components/admin/drilldowns/PartnersDrillDown";

export default function AdminDashboard() {
  const { appUser } = useAuth();
  const {
    metrics, pipeline, queue,
    filters, setFilters,
    lastRefreshedAt, refreshAll,
  } = useAdminDashboard();
  const [activeLendersCount, setActiveLendersCount] = useState<number | undefined>(undefined);
  const [drilldown, setDrilldown] = useState<AdminMetricKey | null>(null);

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

  const closeDrill = (open: boolean) => { if (!open) setDrilldown(null); };

  return (
    <div className="space-y-7 max-w-screen-2xl mx-auto">
      <PageHeader
        title="Admin Dashboard"
        description="Operations overview · partner pipeline at a glance"
        lastUpdated={lastRefreshedAt}
      >
        {appUser?.role && (
          <Badge variant="outline" className="text-[10px] rounded-full bg-primary/10 text-primary border-primary/30">
            {appUser.role.replace(/_/g, " ").toUpperCase()}
          </Badge>
        )}
        <Button variant="outline" size="sm" onClick={refreshAll} className="border-border/70">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
        </Button>
      </PageHeader>

      <AdminTopMetrics
        data={metrics.data}
        loading={metrics.loading}
        error={metrics.error}
        onRetry={refreshAll}
        activeLendersCount={activeLendersCount}
        onCardClick={(k) => setDrilldown(k)}
      />

      <div className="grid gap-5 lg:grid-cols-3">
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

      {/* Drill-down drawers (read-only) */}
      <ActionNeededDrillDown
        open={drilldown === "action"}
        onOpenChange={closeDrill}
        totalCount={metrics.data?.pendingAdminActions ?? 0}
        requestsCount={metrics.data?.requestsPendingApproval ?? 0}
        documentsCount={metrics.data?.documentsPendingReview ?? 0}
      />
      <ActivePipelineDrillDown
        open={drilldown === "pipeline"}
        onOpenChange={closeDrill}
        totalCount={metrics.data?.totalLeads ?? 0}
        pipelineStages={pipeline.data}
      />
      <ClosedDrillDown
        open={drilldown === "closed"}
        onOpenChange={closeDrill}
        totalCount={metrics.data?.disbursed ?? 0}
      />
      <PartnersDrillDown
        open={drilldown === "partners"}
        onOpenChange={closeDrill}
        totalCount={metrics.data?.activePartners ?? 0}
      />
    </div>
  );
}
