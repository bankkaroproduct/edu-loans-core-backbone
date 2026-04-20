import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, FileText, GitBranch, FileWarning, Inbox, Building2, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminReportFilters } from "@/components/admin/reports/AdminReportFilters";
import { ReportCard } from "@/components/admin/reports/ReportCard";
import {
  countDocumentsPending,
  countEditRequests,
  countLeadsReport,
  countPartnerPerformance,
  countStageMovement,
  defaultReportFilters,
  fetchDocumentsPendingReport,
  fetchEditRequestsReport,
  fetchLeadsReport,
  fetchPartnerPerformanceReport,
  fetchStageMovementReport,
  type ReportFilterState,
} from "@/lib/reportExports";
import type { Database } from "@/integrations/supabase/types";

type StageEnum = Database["public"]["Enums"]["lead_stage_enum"];
type StatusEnum = Database["public"]["Enums"]["lead_status_enum"];

interface SummaryStrip {
  activeLeads: number;
  stageTransitions30d: number;
  docsPending: number;
  pendingRequests: number;
}

export default function AdminReports() {
  // Master data
  const [stages, setStages] = useState<{ stage_key: StageEnum; stage_label: string }[]>([]);
  const [statuses, setStatuses] = useState<{ status_key: StatusEnum; status_label: string }[]>([]);
  const [countries, setCountries] = useState<{ country_name: string }[]>([]);
  const [partners, setPartners] = useState<{ id: string; display_name: string }[]>([]);

  const [filters, setFilters] = useState<ReportFilterState>(defaultReportFilters);
  // Bump this whenever filters change to retrigger ReportCard count fetch.
  const filterVersion = useMemo(() => JSON.stringify(filters), [filters]);

  const [summary, setSummary] = useState<SummaryStrip | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Load master data
  useEffect(() => {
    (async () => {
      const [sRes, stRes, cRes, pRes] = await Promise.all([
        supabase.from("lifecycle_stage_master").select("stage_key, stage_label, sort_order").eq("active_flag", true).order("sort_order"),
        supabase.from("lifecycle_status_master").select("status_key, status_label, sort_order").eq("active_flag", true).order("sort_order"),
        supabase.from("countries_master").select("country_name").eq("active_flag", true).order("country_name"),
        supabase.from("partner_organizations").select("id, display_name, partner_code").eq("is_archived", false).neq("partner_code", "PTR-DIRECT").order("display_name"),
      ]);
      const statusMap = new Map<string, { status_key: StatusEnum; status_label: string }>();
      (stRes.data ?? []).forEach((r) => {
        if (!statusMap.has(r.status_key)) statusMap.set(r.status_key, { status_key: r.status_key, status_label: r.status_label });
      });
      setStages(sRes.data ?? []);
      setStatuses(Array.from(statusMap.values()));
      setCountries(cRes.data ?? []);
      setPartners((pRes.data ?? []).filter((p) => !!p.display_name?.trim()));
    })();
  }, []);

  // Summary strip — independent of report filters
  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
      const [a, b, c, d] = await Promise.all([
        supabase
          .from("student_leads")
          .select("id", { count: "exact", head: true })
          .eq("is_archived", false)
          .not("current_stage", "in", "(disbursed,rejected,dropped)"),
        supabase
          .from("lead_stage_history")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since30),
        supabase
          .from("lead_documents")
          .select("id", { count: "exact", head: true })
          .eq("is_latest", true)
          .in("verification_status", ["uploaded", "reupload_needed"]),
        supabase
          .from("lead_edit_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
      ]);
      setSummary({
        activeLeads: a.count ?? 0,
        stageTransitions30d: b.count ?? 0,
        docsPending: c.count ?? 0,
        pendingRequests: d.count ?? 0,
      });
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const [refreshKey, setRefreshKey] = useState(0);
  const handleRefresh = () => {
    loadSummary();
    setRefreshKey((k) => k + 1);
  };

  // Report card configs — fetch fns capture latest filters via closure on each render.
  const cardKey = `${filterVersion}|${refreshKey}`;

  return (
    <AdminLayout>
      <div className="max-w-screen-2xl mx-auto px-4 py-6 space-y-5">
        <PageHeader
          title="Reports & Exports"
          description="Filtered exports across leads, lifecycle, documents, requests, and partners. Hard cap of 5,000 rows per export."
        >
          <Button variant="outline" size="sm" onClick={handleRefresh} className="h-9">
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
        </PageHeader>

        {/* Summary strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryTile label="Active leads" value={summary?.activeLeads} loading={summaryLoading} hint="Non-archived, non-terminal" />
          <SummaryTile label="Stage transitions (30d)" value={summary?.stageTransitions30d} loading={summaryLoading} hint="Last 30 days" />
          <SummaryTile label="Documents pending review" value={summary?.docsPending} loading={summaryLoading} hint="Awaiting verification" />
          <SummaryTile label="Pending edit requests" value={summary?.pendingRequests} loading={summaryLoading} hint="Awaiting admin action" />
        </div>

        {/* Filters */}
        <AdminReportFilters
          filters={filters}
          onChange={setFilters}
          stages={stages}
          statuses={statuses}
          countries={countries}
          partners={partners}
        />

        {/* Report grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ReportCard
            title="Leads Report"
            description="All leads with full business attributes — Source, Type, Entry Mode, Region, Loan, Stage, Status."
            slug="leads-report"
            icon={<FileText className="h-4 w-4" />}
            filterVersion={cardKey}
            fetchCount={() => countLeadsReport(filters)}
            fetchData={() => fetchLeadsReport(filters)}
          />
          <ReportCard
            title="Stage Movement Report"
            description="Lifecycle audit trail — every stage transition with previous → new and change reason."
            slug="stage-movement-report"
            icon={<GitBranch className="h-4 w-4" />}
            filterVersion={cardKey}
            fetchCount={() => countStageMovement(filters)}
            fetchData={() => fetchStageMovementReport(filters)}
          />
          <ReportCard
            title="Documents Pending Review"
            description="Latest document versions awaiting verification (uploaded or reupload-needed). Sorted by days waiting."
            slug="documents-pending-report"
            icon={<FileWarning className="h-4 w-4" />}
            filterVersion={cardKey}
            fetchCount={() => countDocumentsPending(filters)}
            fetchData={() => fetchDocumentsPendingReport(filters)}
          />
          <ReportCard
            title="Edit Requests Report"
            description="Partner-raised edit requests with status, fields changed, and decision notes."
            slug="edit-requests-report"
            icon={<Inbox className="h-4 w-4" />}
            filterVersion={cardKey}
            fetchCount={() => countEditRequests(filters)}
            fetchData={() => fetchEditRequestsReport(filters)}
          />
          <div className="md:col-span-2">
            <ReportCard
              title="Partner Performance"
              description="One row per active partner with total leads + per-stage breakdown. Excludes archived and system partners."
              slug="partner-performance-report"
              icon={<Building2 className="h-4 w-4" />}
              filterVersion={cardKey}
              fetchCount={() => countPartnerPerformance()}
              fetchData={() => fetchPartnerPerformanceReport(filters)}
            />
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground text-center pt-2 flex items-center justify-center gap-1.5">
          <FileSpreadsheet className="h-3 w-3" />
          Exports are capped at 5,000 rows. Use filters to narrow large reports.
        </p>
      </div>
    </AdminLayout>
  );
}

function SummaryTile({ label, value, loading, hint }: { label: string; value: number | undefined; loading: boolean; hint?: string }) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <div className="mt-1">
          {loading ? (
            <Skeleton className="h-7 w-16" />
          ) : (
            <p className="text-2xl font-semibold tabular-nums text-foreground">{(value ?? 0).toLocaleString()}</p>
          )}
        </div>
        {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
      </CardContent>
    </Card>
  );
}
