import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StageBadge, StatusBadge } from "@/components/dashboard/StageBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { AdminLeadFilters, defaultAdminLeadFilters, type AdminLeadFilterState } from "@/components/admin/AdminLeadFilters";
import {
  AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Inbox, RefreshCw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type StageEnum = Database["public"]["Enums"]["lead_stage_enum"];
type StatusEnum = Database["public"]["Enums"]["lead_status_enum"];

interface AdminLeadRow {
  id: string;
  lead_id: string | null;
  student_full_name: string | null;
  student_first_name: string;
  student_last_name: string | null;
  student_phone: string;
  source_type: string;
  partner_id: string | null;
  intended_study_country: string;
  course_name: string;
  loan_amount_required: number | null;
  current_stage: StageEnum;
  current_status: StatusEnum;
  updated_at: string;
  created_at: string;
  partner_display_name: string | null;
}

const PAGE_SIZE = 25;
type SortKey = "updated_at" | "created_at" | "loan_amount_required";
type SortDir = "asc" | "desc";

/** Sanitize search input for PostgREST .or() string — strip chars that break the parser. */
function sanitizeSearch(s: string): string {
  return s.trim().replace(/[(),"]/g, "").slice(0, 100);
}

function sourceLabel(row: AdminLeadRow): string {
  if (row.source_type === "student_direct") return "Student Portal";
  if (row.partner_display_name) return `Partner: ${row.partner_display_name}`;
  return "Partner Lead";
}

function studentName(r: AdminLeadRow): string {
  return r.student_full_name?.trim() ||
    `${r.student_first_name}${r.student_last_name ? " " + r.student_last_name : ""}`.trim() ||
    "—";
}

function fmtAmount(n: number | null): string {
  if (n === null || n === undefined) return "—";
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

export default function AdminLeads() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Master data
  const [stages, setStages] = useState<{ stage_key: StageEnum; stage_label: string }[]>([]);
  const [statuses, setStatuses] = useState<{ status_key: StatusEnum; status_label: string }[]>([]);
  const [countries, setCountries] = useState<{ country_name: string }[]>([]);
  const [partners, setPartners] = useState<{ id: string; display_name: string }[]>([]);
  const [mastersLoaded, setMastersLoaded] = useState(false);

  // Hydrate filters from URL once
  const initialFilters: AdminLeadFilterState = useMemo(() => ({
    search: searchParams.get("q") ?? "",
    source: (searchParams.get("source") as any) ?? "all",
    stage: (searchParams.get("stage") as any) ?? "all",
    status: (searchParams.get("status") as any) ?? "all",
    country: searchParams.get("country") ?? "all",
    partnerId: searchParams.get("partner") ?? "all",
    dateFrom: searchParams.get("from") ? new Date(searchParams.get("from")!) : undefined,
    dateTo: searchParams.get("to") ? new Date(searchParams.get("to")!) : undefined,
    type: (searchParams.get("type") as any) ?? "all",
    entryMode: (searchParams.get("entry") as any) ?? "all",
    region: (searchParams.get("region") as any) ?? "all",
    loanRange: (searchParams.get("loan") as any) ?? "all",
    intake: (searchParams.get("intake") as any) ?? "all",
    loanType: (searchParams.get("loantype") as any) ?? "all",
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [filters, setFilters] = useState<AdminLeadFilterState>(initialFilters);
  const [searchInput, setSearchInput] = useState(initialFilters.search);
  const [sortKey, setSortKey] = useState<SortKey>((searchParams.get("sort") as SortKey) ?? "updated_at");
  const [sortDir, setSortDir] = useState<SortDir>((searchParams.get("dir") as SortDir) ?? "desc");
  const [page, setPage] = useState(parseInt(searchParams.get("page") ?? "1", 10) || 1);

  // Data state
  const [rows, setRows] = useState<AdminLeadRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Health strip counts (filter-aware: same WHERE except status/stage overrides)
  const [healthCounts, setHealthCounts] = useState<{
    total: number; pendingReview: number; withLender: number; sanction: number;
  }>({ total: 0, pendingReview: 0, withLender: 0, sanction: 0 });

  // Debounce search
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      setFilters((f) => ({ ...f, search: searchInput }));
      setPage(1);
    }, 300);
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [searchInput]);

  // Load master data once
  useEffect(() => {
    (async () => {
      const [sRes, stRes, cRes, pRes] = await Promise.all([
        supabase.from("lifecycle_stage_master").select("stage_key, stage_label, sort_order").eq("active_flag", true).order("sort_order"),
        supabase.from("lifecycle_status_master").select("status_key, status_label, sort_order").eq("active_flag", true).order("sort_order"),
        supabase.from("countries_master").select("country_name").eq("active_flag", true).order("country_name"),
        supabase.from("partner_organizations").select("id, display_name").eq("is_archived", false).order("display_name"),
      ]);
      // De-duplicate status keys (the master may have multiple rows per status across stages)
      const statusMap = new Map<string, { status_key: StatusEnum; status_label: string }>();
      (stRes.data ?? []).forEach((r) => {
        if (!statusMap.has(r.status_key)) statusMap.set(r.status_key, { status_key: r.status_key, status_label: r.status_label });
      });
      setStages(sRes.data ?? []);
      setStatuses(Array.from(statusMap.values()));
      setCountries(cRes.data ?? []);
      setPartners((pRes.data ?? []).filter((p) => !!p.display_name?.trim()));
      setMastersLoaded(true);
    })();
  }, []);

  // Sync filters → URL
  useEffect(() => {
    const p = new URLSearchParams();
    if (filters.search) p.set("q", filters.search);
    if (filters.source !== "all") p.set("source", filters.source);
    if (filters.stage !== "all") p.set("stage", filters.stage);
    if (filters.status !== "all") p.set("status", filters.status);
    if (filters.country !== "all") p.set("country", filters.country);
    if (filters.partnerId !== "all") p.set("partner", filters.partnerId);
    if (filters.dateFrom) p.set("from", filters.dateFrom.toISOString().slice(0, 10));
    if (filters.dateTo) p.set("to", filters.dateTo.toISOString().slice(0, 10));
    if (filters.type !== "all") p.set("type", filters.type);
    if (filters.entryMode !== "all") p.set("entry", filters.entryMode);
    if (filters.region !== "all") p.set("region", filters.region);
    if (filters.loanRange !== "all") p.set("loan", filters.loanRange);
    if (filters.intake !== "all") p.set("intake", filters.intake);
    if (filters.loanType !== "all") p.set("loantype", filters.loanType);
    if (sortKey !== "updated_at") p.set("sort", sortKey);
    if (sortDir !== "desc") p.set("dir", sortDir);
    if (page > 1) p.set("page", String(page));
    setSearchParams(p, { replace: true });
  }, [filters, sortKey, sortDir, page, setSearchParams]);

  /**
   * Apply business-bifurcation filters to a PostgREST query builder.
   * Maps clean UI labels → real source_type/source_sub_type/region/loan/etc rules.
   */
  const applyBusinessFilters = useCallback((q: any) => {
    // Source (clean UI → real source_type + source_sub_type)
    switch (filters.source) {
      case "partner_direct":
        q = q.eq("source_type", "partner").not("source_sub_type", "ilike", "%refer%");
        break;
      case "partner_referral":
        q = q.eq("source_type", "partner").ilike("source_sub_type", "%refer%");
        break;
      case "student_portal":
        q = q.eq("source_type", "student_direct");
        break;
      case "university_referral":
        q = q.eq("source_sub_type", "university_referral");
        break;
    }
    // Type — Quick Lead vs Full Lead
    if (filters.type === "quick_lead") {
      q = q.eq("source_sub_type", "quick_lead");
    } else if (filters.type === "full_lead") {
      q = q.or("source_sub_type.is.null,source_sub_type.neq.quick_lead");
    }
    // Entry Mode
    switch (filters.entryMode) {
      case "add_lead":
        // Anything not Quick Lead, not Bulk Upload, and not Student Portal — i.e., manually-added or uncategorized partner leads
        q = q.eq("source_type", "partner").not("source_sub_type", "in", "(quick_lead,bulk_upload)");
        break;
      case "bulk_upload":
        q = q.eq("source_sub_type", "bulk_upload");
        break;
      case "quick_lead":
        q = q.eq("source_sub_type", "quick_lead");
        break;
      case "student_portal":
        q = q.eq("source_type", "student_direct");
        break;
    }
    // Region — based on intended_study_country
    if (filters.region === "domestic") {
      q = q.eq("intended_study_country", "India");
    } else if (filters.region === "international") {
      q = q.neq("intended_study_country", "India");
    }
    // Loan Range (₹) — 1L = 100000
    switch (filters.loanRange) {
      case "lt10": q = q.lt("loan_amount_required", 1000000); break;
      case "10to25": q = q.gte("loan_amount_required", 1000000).lt("loan_amount_required", 2500000); break;
      case "25to50": q = q.gte("loan_amount_required", 2500000).lt("loan_amount_required", 5000000); break;
      case "gt50": q = q.gte("loan_amount_required", 5000000); break;
    }
    // Intake term
    if (filters.intake !== "all") q = q.eq("intake_term", filters.intake);
    // Loan Type
    if (filters.loanType === "secured") q = q.eq("collateral_available", true);
    else if (filters.loanType === "unsecured") q = q.or("collateral_available.is.null,collateral_available.eq.false");

    return q;
  }, [filters]);

  const fetchPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const buildBase = () => {
        let q: any = supabase.from("student_leads")
          .select(
            "id, lead_id, student_full_name, student_first_name, student_last_name, student_phone, source_type, partner_id, intended_study_country, course_name, loan_amount_required, current_stage, current_status, updated_at, created_at",
            { count: "exact" }
          )
          .eq("is_archived", false);

        // Filters first (AND) — note: source mapping handled by applyBusinessFilters
        if (filters.stage !== "all") q = q.eq("current_stage", filters.stage);
        if (filters.status !== "all") q = q.eq("current_status", filters.status);
        if (filters.country !== "all") q = q.eq("intended_study_country", filters.country);
        if (filters.partnerId !== "all") q = q.eq("partner_id", filters.partnerId);
        if (filters.dateFrom) q = q.gte("created_at", filters.dateFrom.toISOString());
        if (filters.dateTo) {
          const end = new Date(filters.dateTo);
          end.setHours(23, 59, 59, 999);
          q = q.lte("created_at", end.toISOString());
        }
        // Apply business bifurcation filters (Source / Type / Entry Mode / Region / Loan / Intake / Loan Type)
        q = applyBusinessFilters(q);

        // Search applied AFTER filters as a single OR group (AND with the filters)
        const t = sanitizeSearch(filters.search);
        if (t) {
          q = q.or(
            `student_full_name.ilike.%${t}%,student_first_name.ilike.%${t}%,student_last_name.ilike.%${t}%,student_phone.ilike.%${t}%,lead_id.ilike.%${t}%`
          );
        }
        return q;
      };

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const q = buildBase().order(sortKey, { ascending: sortDir === "asc" }).range(from, to);

      const { data, count, error: qErr } = await q;
      if (qErr) throw qErr;

      const baseRows = (data ?? []) as Omit<AdminLeadRow, "partner_display_name">[];

      // Partner enrichment, null-safe
      const partnerIds = Array.from(new Set(baseRows.map((r) => r.partner_id).filter((x): x is string => !!x)));
      const partnerMap = new Map<string, string>();
      if (partnerIds.length) {
        const { data: pData } = await supabase
          .from("partner_organizations")
          .select("id, display_name")
          .in("id", partnerIds);
        (pData ?? []).forEach((p) => {
          if (p.display_name?.trim()) partnerMap.set(p.id, p.display_name.trim());
        });
      }

      const enriched: AdminLeadRow[] = baseRows.map((r) => ({
        ...r,
        partner_display_name: r.partner_id ? (partnerMap.get(r.partner_id) ?? null) : null,
      }));

      setRows(enriched);
      setTotalCount(count ?? 0);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load leads");
      setRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [filters, sortKey, sortDir, page, applyBusinessFilters]);

  useEffect(() => { fetchPage(); }, [fetchPage]);

  // Fetch filter-aware health counts (lightweight head:true).
  // Total = current filters; the others = current filters with their own stage/status override.
  const fetchHealthCounts = useCallback(async () => {
    const buildCount = (overrideStage?: StageEnum, overrideStatuses?: StatusEnum[]) => {
      let q: any = supabase.from("student_leads")
        .select("*", { count: "exact", head: true })
        .eq("is_archived", false);
      if (filters.source !== "all") q = q.eq("source_type", filters.source);
      if (overrideStage) q = q.eq("current_stage", overrideStage);
      else if (filters.stage !== "all") q = q.eq("current_stage", filters.stage);
      if (overrideStatuses) q = q.in("current_status", overrideStatuses);
      else if (filters.status !== "all") q = q.eq("current_status", filters.status);
      if (filters.country !== "all") q = q.eq("intended_study_country", filters.country);
      if (filters.partnerId !== "all") q = q.eq("partner_id", filters.partnerId);
      if (filters.dateFrom) q = q.gte("created_at", filters.dateFrom.toISOString());
      if (filters.dateTo) {
        const end = new Date(filters.dateTo);
        end.setHours(23, 59, 59, 999);
        q = q.lte("created_at", end.toISOString());
      }
      // Apply business bifurcation filters (Source/Type/Entry/Region/Loan/Intake/LoanType)
      q = applyBusinessFilters(q);
      const t = sanitizeSearch(filters.search);
      if (t) {
        q = q.or(`student_full_name.ilike.%${t}%,student_first_name.ilike.%${t}%,student_last_name.ilike.%${t}%,student_phone.ilike.%${t}%,lead_id.ilike.%${t}%`);
      }
      return q;
    };
    const [tot, pend, lender, sanc] = await Promise.all([
      buildCount(),
      buildCount(undefined, ["new", "awaiting_verification", "pending_info"] as StatusEnum[]),
      buildCount("sent_to_lender" as StageEnum),
      buildCount("sanction_received" as StageEnum),
    ]);
    setHealthCounts({
      total: tot.count ?? 0,
      pendingReview: pend.count ?? 0,
      withLender: lender.count ?? 0,
      sanction: sanc.count ?? 0,
    });
  }, [filters, applyBusinessFilters]);

  useEffect(() => { fetchHealthCounts(); }, [fetchHealthCounts]);

  // Realtime: debounced refresh on student_leads changes
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel("admin-leads-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "student_leads" }, () => {
        if (t) clearTimeout(t);
        t = setTimeout(() => fetchPage(), 600);
      })
      .subscribe();
    return () => { if (t) clearTimeout(t); supabase.removeChannel(channel); };
  }, [fetchPage]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
    setPage(1);
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  // Quick-filter chip presets (admin workspace shortcuts)
  const quickChips = [
    {
      label: "Pending review",
      active: filters.status !== "all" && ["new", "awaiting_verification", "pending_info"].includes(filters.status),
      apply: () => { setFilters({ ...filters, status: "awaiting_verification" as StatusEnum, stage: "all" }); setPage(1); },
    },
    {
      label: "Docs to verify",
      active: filters.stage === "documents_under_review",
      apply: () => { setFilters({ ...filters, stage: "documents_under_review" as StageEnum, status: "all" }); setPage(1); },
    },
    {
      label: "With lender",
      active: filters.stage === "sent_to_lender",
      apply: () => { setFilters({ ...filters, stage: "sent_to_lender" as StageEnum, status: "all" }); setPage(1); },
    },
    {
      label: "Sanctioned",
      active: filters.stage === "sanction_received",
      apply: () => { setFilters({ ...filters, stage: "sanction_received" as StageEnum, status: "all" }); setPage(1); },
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lead Queue"
        description="Cross-partner lead inbox — student & partner leads in one place."
      >
        <Button size="sm" variant="outline" onClick={() => fetchPage()} disabled={loading}>
          <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </PageHeader>

      {/* Queue Health Strip — filter-aware counts */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {[
          { label: "Total in queue", value: healthCounts.total, color: "text-primary" },
          { label: "Pending review", value: healthCounts.pendingReview, color: "text-amber-700" },
          { label: "With lender", value: healthCounts.withLender, color: "text-primary" },
          { label: "Sanction received", value: healthCounts.sanction, color: "text-emerald-700" },
        ].map((m) => (
          <Card key={m.label} className="p-3">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{m.label}</p>
            <p className={`text-xl font-bold tabular-nums mt-0.5 ${m.color}`}>{m.value.toLocaleString("en-IN")}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          {!mastersLoaded ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
            <AdminLeadFilters
              filters={filters}
              onChange={(next) => { setFilters(next); setPage(1); }}
              searchInput={searchInput}
              onSearchInputChange={setSearchInput}
              stages={stages}
              statuses={statuses}
              countries={countries}
              partners={partners}
            />
          )}

          {/* Quick filter chips */}
          <div className="flex flex-wrap gap-2">
            {quickChips.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={c.apply}
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  c.active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-muted text-foreground"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Result summary */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {loading ? "Loading…" : error ? "—" : `${totalCount} lead${totalCount === 1 ? "" : "s"} matching filters`}
            </span>
            <span>Page {page} of {totalPages}</span>
          </div>

          {/* Table / states */}
          {loading && (
            <div className="space-y-2">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          )}

          {!loading && error && (
            <div className="flex items-center justify-between gap-4 py-6 px-4 border border-destructive/30 bg-destructive/5 rounded-md">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <div>
                  <p className="font-medium text-sm">Failed to load lead queue</p>
                  <p className="text-xs text-muted-foreground">{error}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => fetchPage()}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
              </Button>
            </div>
          )}

          {!loading && !error && rows.length === 0 && (
            <EmptyState icon={Inbox} title="No leads match" description="Adjust filters or clear search to see leads here." />
          )}

          {!loading && !error && rows.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Lead ID</TableHead>
                    <TableHead className="text-xs">Student</TableHead>
                    <TableHead className="text-xs">Source</TableHead>
                    <TableHead className="text-xs">Phone</TableHead>
                    <TableHead className="text-xs">Country</TableHead>
                    <TableHead className="text-xs">Course</TableHead>
                    <TableHead className="text-xs text-right">
                      <button type="button" onClick={() => toggleSort("loan_amount_required")} className="inline-flex items-center gap-1 hover:text-foreground">
                        Loan {sortIcon("loan_amount_required")}
                      </button>
                    </TableHead>
                    <TableHead className="text-xs">Stage</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">
                      <button type="button" onClick={() => toggleSort("updated_at")} className="inline-flex items-center gap-1 hover:text-foreground">
                        Updated {sortIcon("updated_at")}
                      </button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow
                      key={r.id}
                      onClick={() => navigate(`/admin/leads/${r.id}`)}
                      className="cursor-pointer"
                    >
                      <TableCell className="font-mono text-xs">{r.lead_id ?? "—"}</TableCell>
                      <TableCell className="font-medium text-sm">{studentName(r)}</TableCell>
                      <TableCell className="text-xs">
                        {r.source_type === "student_direct" ? (
                          <Badge variant="outline" className="text-[10px]">Student Portal</Badge>
                        ) : (
                          <span className="text-muted-foreground">{r.partner_display_name ? `Partner: ${r.partner_display_name}` : "Partner Lead"}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.student_phone}</TableCell>
                      <TableCell className="text-xs">{r.intended_study_country || "—"}</TableCell>
                      <TableCell className="text-xs max-w-[180px] truncate" title={r.course_name}>{r.course_name || "—"}</TableCell>
                      <TableCell className="text-xs text-right">{fmtAmount(r.loan_amount_required)}</TableCell>
                      <TableCell><StageBadge stage={r.current_stage} /></TableCell>
                      <TableCell><StatusBadge status={r.current_status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(r.updated_at), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {!loading && !error && totalCount > 0 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs px-2">Page {page} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
