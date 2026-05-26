import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAdminDashboard } from "@/hooks/useAdminDashboard";
import { AdminTopMetrics, type AdminMetricKey } from "@/components/admin/AdminTopMetrics";
import { AdminLeadQueue } from "@/components/admin/AdminLeadQueue";
import { AdminRequestsSnapshot } from "@/components/admin/AdminRequestsSnapshot";
import { supabase } from "@/integrations/supabase/client";
import { ActionNeededDrillDown } from "@/components/admin/drilldowns/ActionNeededDrillDown";
import { ActivePipelineDrillDown } from "@/components/admin/drilldowns/ActivePipelineDrillDown";
import { ClosedDrillDown } from "@/components/admin/drilldowns/ClosedDrillDown";
import { PartnersDrillDown } from "@/components/admin/drilldowns/PartnersDrillDown";

export default function AdminDashboard() {
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
    <div className="mx-auto max-w-screen-2xl bg-[#FAFBFC] px-9 pt-7 pb-8">
      {/* Topbar */}
      <header className="mb-7 flex flex-col items-start justify-between gap-3 sm:flex-row">
        <div className="min-w-0">
          <h1 className="text-[26px] font-extrabold tracking-[-0.025em] leading-none text-[#1C1B1F]">
            Admin Dashboard
          </h1>
          <p className="mt-1.5 text-[13.5px] font-medium text-[#45505C]">
            Operations overview · partner pipeline at a glance
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Live indicator + updated meta — bound to lastRefreshedAt only */}
          <div className="flex flex-col items-end gap-0.5">
            {lastRefreshedAt && (
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[#6B7684]">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#26A651] opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#26A651]" />
                </span>
                Live
              </span>
            )}
            {lastRefreshedAt && (
              <span className="text-[11.5px] text-[#9AA3AE] whitespace-nowrap">
                Updated {formatDistanceToNow(lastRefreshedAt, { addSuffix: true })}
              </span>
            )}
          </div>

          <span className="inline-flex items-center rounded-full bg-[#1C1B1F] px-[10px] py-1 text-[10px] font-bold uppercase tracking-[0.10em] text-white">
            ADMIN
          </span>

          <button
            type="button"
            onClick={refreshAll}
            className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#E5E7EB] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#1C1B1F] transition-colors hover:bg-[#FAFBFC]"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </header>

      {/* KPI strip */}
      <AdminTopMetrics
        data={metrics.data}
        loading={metrics.loading}
        error={metrics.error}
        onRetry={refreshAll}
        activeLendersCount={activeLendersCount}
        onCardClick={(k) => setDrilldown(k)}
      />

      {/* Body grid: table left, requests panel right */}
      <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_320px]">
        <AdminLeadQueue
          data={queue.data}
          loading={queue.loading}
          error={queue.error}
          onRetry={refreshAll}
          filters={filters}
          onFiltersChange={setFilters}
          pipelineStages={pipeline.data}
        />
        <AdminRequestsSnapshot />
      </div>

      {/* Drill-down drawers (read-only) */}
      <ActionNeededDrillDown
        open={drilldown === "action"}
        onOpenChange={closeDrill}
        totalCount={metrics.data?.pendingAdminActions ?? 0}
        reviewDueCount={metrics.data?.reviewDue ?? 0}
        followUpCount={metrics.data?.followUpRequired ?? 0}
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
