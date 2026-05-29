import { useCallback, useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, FileSpreadsheet, CalendarIcon, RotateCcw, Users, GitCommitHorizontal, FileText, Mail, BarChart3 } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, subDays, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { AdminReportFilters } from "@/components/admin/reports/AdminReportFilters";
import { ReportListRow } from "@/components/admin/reports/ReportListRow";
import { ReportListPanel, ReportListGroup } from "@/components/admin/reports/ReportListPanel";
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
import { useAdminLeadScope } from "@/hooks/useAdminLeadScope";
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
  const [statuses, setStatuses] = useState<{ stage_key: StageEnum; status_key: StatusEnum; status_label: string }[]>([]);
  const [countries, setCountries] = useState<{ country_name: string }[]>([]);
  const [partners, setPartners] = useState<{ id: string; display_name: string }[]>([]);

  const { isSuperAdmin, scopedPartnerIds, hasNoScope, ready: scopeReady } = useAdminLeadScope();
  const [rawFilters, setFilters] = useState<ReportFilterState>(defaultReportFilters);
  const filters = useMemo<ReportFilterState>(
    () => ({ ...rawFilters, scopedPartnerIds: isSuperAdmin ? undefined : scopedPartnerIds }),
    [rawFilters, isSuperAdmin, scopedPartnerIds]
  );
  // Bump this whenever filters change to retrigger ReportCard count fetch.
  const filterVersion = useMemo(() => JSON.stringify(filters), [filters]);

  const [summary, setSummary] = useState<SummaryStrip | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Load master data
  useEffect(() => {
    (async () => {
      const [sRes, stRes, cRes, pRes] = await Promise.all([
        supabase.from("lifecycle_stage_master").select("stage_key, stage_label, sort_order").eq("active_flag", true).order("sort_order"),
        supabase.from("lifecycle_status_master").select("stage_key, status_key, status_label, sort_order").eq("active_flag", true).order("sort_order"),
        supabase.from("countries_master").select("country_name").eq("active_flag", true).order("country_name"),
        supabase.from("partner_organizations").select("id, display_name, partner_code").eq("is_archived", false).neq("partner_code", "PTR-DIRECT").order("display_name"),
      ]);
      setStages(sRes.data ?? []);
      setStatuses((stRes.data ?? []).map((r) => ({ stage_key: r.stage_key, status_key: r.status_key, status_label: r.status_label })));
      setCountries(cRes.data ?? []);
      setPartners((pRes.data ?? []).filter((p) => !!p.display_name?.trim()));
    })();
  }, []);

  // Summary strip — independent of report filters
  const loadSummary = useCallback(async () => {
    if (!scopeReady) return;
    setSummaryLoading(true);
    try {
      if (hasNoScope) {
        setSummary({ activeLeads: 0, stageTransitions30d: 0, docsPending: 0, pendingRequests: 0 });
        return;
      }
      const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
      let activeQ: any = supabase
        .from("student_leads")
        .select("id", { count: "exact", head: true })
        .eq("is_archived", false)
        .not("current_stage", "in", "(disbursed,rejected,dropped)");
      if (!isSuperAdmin) activeQ = activeQ.in("partner_id", scopedPartnerIds);
      const [a, b, c, d] = await Promise.all([
        activeQ,
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
  }, [scopeReady, hasNoScope, isSuperAdmin, scopedPartnerIds]);

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
    <>
      <div className="space-y-5 max-w-screen-2xl mx-auto">
        <PageHeader
          title="Reports & Exports"
          description="Filtered exports across leads, lifecycle, documents, requests, and partners. Hard cap of 5,000 rows per export."
        >
          <Button variant="outline" size="sm" onClick={handleRefresh} className="h-9">
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
        </PageHeader>

        {/* Reporting Scope Bar — global hero filter */}
        <ReportingScopeBar filters={filters} onChange={setFilters} partners={partners} />

        {/* Summary strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryTile label="Active leads" value={summary?.activeLeads} loading={summaryLoading} hint="Non-archived, non-terminal" />
          <SummaryTile label="Stage transitions (30d)" value={summary?.stageTransitions30d} loading={summaryLoading} hint="Last 30 days" />
          <SummaryTile label="Documents pending review" value={summary?.docsPending} loading={summaryLoading} hint="Awaiting verification" />
          <SummaryTile label="Pending edit requests" value={summary?.pendingRequests} loading={summaryLoading} hint="Awaiting admin action" />
        </div>

        {/* Advanced Filters */}
        <AdminReportFilters
          filters={filters}
          onChange={setFilters}
          stages={stages}
          statuses={statuses}
          countries={countries}
          partners={partners}
        />

        {/* Available reports */}
        <div className="flex items-baseline justify-between pt-1">
          <h2 className="text-sm font-semibold text-foreground">Available reports</h2>
          <p className="text-[11px] text-muted-foreground">One row per report · respects the filters above</p>
        </div>

        <ReportListPanel>
          <ReportListGroup label="Leads & Pipeline">
            <ReportListRow
              title="Leads Report"
              description="All leads with full business attributes — Source, Type, Entry Mode, Region, Loan, Stage, Status."
              slug="leads-report"
              accent="leads"
              Icon={Users}
              filterVersion={cardKey}
              fetchCount={() => countLeadsReport(filters)}
              fetchData={() => fetchLeadsReport(filters)}
              dateFieldHint="Uses created date"
            />
            <ReportListRow
              title="Stage Movement Report"
              description="Lifecycle audit trail — every stage transition with previous → new and change reason."
              slug="stage-movement-report"
              accent="stage"
              Icon={GitCommitHorizontal}
              filterVersion={cardKey}
              fetchCount={() => countStageMovement(filters)}
              fetchData={() => fetchStageMovementReport(filters)}
              dateFieldHint="Uses transition date"
              isLast
            />
          </ReportListGroup>

          <ReportListGroup label="Documents & Requests">
            <ReportListRow
              title="Documents Pending Review"
              description="Latest document versions awaiting verification (uploaded or reupload-needed). Sorted by days waiting."
              slug="documents-pending-report"
              accent="documents"
              Icon={FileText}
              filterVersion={cardKey}
              fetchCount={() => countDocumentsPending(filters)}
              fetchData={() => fetchDocumentsPendingReport(filters)}
              dateFieldHint="Uses uploaded date"
            />
            <ReportListRow
              title="Edit Requests Report"
              description="Partner-raised edit requests with status, fields changed, and decision notes."
              slug="edit-requests-report"
              accent="editRequests"
              Icon={Mail}
              filterVersion={cardKey}
              fetchCount={() => countEditRequests(filters)}
              fetchData={() => fetchEditRequestsReport(filters)}
              dateFieldHint="Uses created date"
              isLast
            />
          </ReportListGroup>

          <ReportListGroup label="Partners">
            <ReportListRow
              title="Partner Performance"
              description="One row per active partner with total leads + per-stage breakdown. Excludes archived and system partners."
              slug="partner-performance-report"
              accent="partners"
              Icon={BarChart3}
              filterVersion={cardKey}
              fetchCount={() => countPartnerPerformance(filters)}
              fetchData={() => fetchPartnerPerformanceReport(filters)}
              dateFieldHint="Uses created date"
              isLast
            />
          </ReportListGroup>
        </ReportListPanel>

        <p className="text-[11px] text-muted-foreground text-center pt-2 flex items-center justify-center gap-1.5">
          <FileSpreadsheet className="h-3 w-3" />
          Exports are capped at 5,000 rows. Use filters to narrow large reports.
        </p>
      </div>
    </>
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

// ============================================================
// Reporting Scope Bar — global hero filter (date range + partner)
// Local pending state, commits to page filters only on Apply / preset / Reset.
// Stays in sync with external filter changes via useEffect.
// No new fetch path: only calls onChange(setFilters).
// ============================================================
type Preset = "today" | "7d" | "30d" | "thisMonth" | "lastMonth" | "custom";

function ReportingScopeBar({
  filters,
  onChange,
  partners,
}: {
  filters: ReportFilterState;
  onChange: (next: ReportFilterState) => void;
  partners: { id: string; display_name: string }[];
}) {
  const [pendingFrom, setPendingFrom] = useState<Date | undefined>(filters.dateFrom);
  const [pendingTo, setPendingTo] = useState<Date | undefined>(filters.dateTo);
  const [pendingPartner, setPendingPartner] = useState<string>(filters.partnerId);
  const [activePreset, setActivePreset] = useState<Preset | null>(null);

  // Sync pending state when filters change externally (Reset, Advanced Filters Partner edit, etc.)
  useEffect(() => {
    setPendingFrom(filters.dateFrom);
    setPendingTo(filters.dateTo);
    setPendingPartner(filters.partnerId);
  }, [filters.dateFrom, filters.dateTo, filters.partnerId]);

  const dirty =
    pendingFrom?.getTime() !== filters.dateFrom?.getTime() ||
    pendingTo?.getTime() !== filters.dateTo?.getTime() ||
    pendingPartner !== filters.partnerId;

  const applyPreset = (preset: Preset) => {
    setActivePreset(preset);
    if (preset === "custom") return;
    const today = startOfDay(new Date());
    let from: Date | undefined;
    let to: Date | undefined = today;
    if (preset === "today") from = today;
    else if (preset === "7d") from = subDays(today, 6);
    else if (preset === "30d") from = subDays(today, 29);
    else if (preset === "thisMonth") from = startOfMonth(today);
    else if (preset === "lastMonth") {
      const lastMo = subMonths(today, 1);
      from = startOfMonth(lastMo);
      to = endOfMonth(lastMo);
    }
    onChange({ ...filters, dateFrom: from, dateTo: to, partnerId: pendingPartner });
  };

  const handleApply = () => {
    onChange({ ...filters, dateFrom: pendingFrom, dateTo: pendingTo, partnerId: pendingPartner });
  };

  const handleReset = () => {
    setActivePreset(null);
    onChange({ ...filters, dateFrom: undefined, dateTo: undefined, partnerId: "all" });
  };

  const partnerName =
    filters.partnerId === "all"
      ? "All Partners"
      : partners.find((p) => p.id === filters.partnerId)?.display_name ?? "Selected Partner";

  const rangeLabel =
    filters.dateFrom && filters.dateTo
      ? `${format(filters.dateFrom, "dd MMM yyyy")} – ${format(filters.dateTo, "dd MMM yyyy")}`
      : filters.dateFrom
      ? `From ${format(filters.dateFrom, "dd MMM yyyy")}`
      : filters.dateTo
      ? `Until ${format(filters.dateTo, "dd MMM yyyy")}`
      : "All time";

  const presetBtn = (key: Preset, label: string) => (
    <Button
      key={key}
      variant={activePreset === key ? "default" : "outline"}
      size="sm"
      className="h-9 text-xs px-3"
      onClick={() => applyPreset(key)}
    >
      {label}
    </Button>
  );

  return (
    <div className="space-y-2">
      <Card className="border-border/60">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("h-9 text-xs justify-start font-normal min-w-[140px]", !pendingFrom && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                  {pendingFrom ? format(pendingFrom, "dd MMM yyyy") : "From date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={pendingFrom}
                  onSelect={(d) => {
                    setPendingFrom(d);
                    setActivePreset("custom");
                  }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("h-9 text-xs justify-start font-normal min-w-[140px]", !pendingTo && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                  {pendingTo ? format(pendingTo, "dd MMM yyyy") : "To date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={pendingTo}
                  onSelect={(d) => {
                    setPendingTo(d);
                    setActivePreset("custom");
                  }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>

            <div className="flex flex-wrap items-center gap-1.5">
              {presetBtn("today", "Today")}
              {presetBtn("7d", "Last 7 Days")}
              {presetBtn("30d", "Last 30 Days")}
              {presetBtn("thisMonth", "This Month")}
              {presetBtn("lastMonth", "Last Month")}
              {presetBtn("custom", "Custom")}
            </div>

            <div className="min-w-[200px]">
              <Select value={pendingPartner} onValueChange={setPendingPartner}>
                <SelectTrigger className="w-full h-9 text-xs">
                  <SelectValue placeholder="Partner" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="all">All Partners</SelectItem>
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={handleReset}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Reset
              </Button>
              <Button size="sm" className="h-9 text-xs px-4" onClick={handleApply} disabled={!dirty}>
                Apply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground px-1">
        Showing data for <span className="font-medium text-foreground">{rangeLabel}</span>
        <span className="mx-1.5">•</span>
        <span className="font-medium text-foreground">{partnerName}</span>
      </p>
    </div>
  );
}
