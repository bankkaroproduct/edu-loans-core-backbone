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
import { StatCard } from "@/components/shared/StatCard";
import { AdminLeadFilters, type AdminLeadFilterState } from "@/components/admin/AdminLeadFilters";
import { applyBusinessFilters as applySharedBusinessFilters } from "@/lib/leadBusinessFilters";
import {
  AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, BadgeCheck, ChevronLeft, ChevronRight,
  Clock, FileSearch, Inbox, Layers, Pencil, RefreshCw, Send, SlidersHorizontal,
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

/**
 * "Stale > 48h" definition (single source of truth):
 *   - last activity (`updated_at`) is older than 48h, AND
 *   - lead is NOT in a terminal stage, AND
 *   - lead is NOT in a blocked/awaiting-input status (admin can't act yet).
 *
 * This intentionally uses `updated_at` (not `created_at`) so editing or moving
 * a lead immediately removes it from the Stale list — matching the operational
 * meaning admins expect.
 */
const STALE_TERMINAL_STAGES: StageEnum[] = ["disbursed", "rejected", "dropped", "on_hold"];
const STALE_BLOCKED_STATUSES: StatusEnum[] = ["pending_info", "query_raised", "reupload_needed"];
const STALE_HOURS = 48;

/** Sanitize search input for PostgREST .or() string — strip chars that break the parser. */
function sanitizeSearch(s: string): string {
  return s.trim().replace(/[(),"]/g, "").slice(0, 100);
}


function studentName(r: AdminLeadRow): string {
  return r.student_full_name?.trim() ||
    `${r.student_first_name}${r.student_last_name ? " " + r.student_last_name : ""}`.trim() ||
    "—";
}

function studentInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0 || parts[0] === "—") return "—";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase() || "—";
}


export default function AdminLeads() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Master data
  const [stages, setStages] = useState<{ stage_key: StageEnum; stage_label: string }[]>([]);
  const [statuses, setStatuses] = useState<{ stage_key: StageEnum; status_key: StatusEnum; status_label: string }[]>([]);
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
    staleOnly: searchParams.get("stale") === "1",
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [filters, setFilters] = useState<AdminLeadFilterState>(initialFilters);
  const [searchInput, setSearchInput] = useState(initialFilters.search);
  const [sortKey, setSortKey] = useState<SortKey>((searchParams.get("sort") as SortKey) ?? "created_at");
  const [sortDir, setSortDir] = useState<SortDir>((searchParams.get("dir") as SortDir) ?? "desc");
  const [page, setPage] = useState(parseInt(searchParams.get("page") ?? "1", 10) || 1);

  // Data state
  const [rows, setRows] = useState<AdminLeadRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(() => new Date());

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
        supabase.from("lifecycle_status_master").select("stage_key, status_key, status_label, sort_order").eq("active_flag", true).order("sort_order"),
        supabase.from("countries_master").select("country_name").eq("active_flag", true).order("country_name"),
        supabase.from("partner_organizations").select("id, display_name").eq("is_archived", false).order("display_name"),
      ]);
      setStages(sRes.data ?? []);
      setStatuses((stRes.data ?? []).map((r) => ({ stage_key: r.stage_key, status_key: r.status_key, status_label: r.status_label })));
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
    if (filters.staleOnly) p.set("stale", "1");
    if (sortKey !== "created_at") p.set("sort", sortKey);
    if (sortDir !== "desc") p.set("dir", sortDir);
    if (page > 1) p.set("page", String(page));
    setSearchParams(p, { replace: true });
  }, [filters, sortKey, sortDir, page, setSearchParams]);

  /**
   * Apply business-bifurcation filters via shared helper (`@/lib/leadBusinessFilters`).
   * Single source of truth — keeps Lead Queue and Reports consistent and ensures
   * Source buckets (Partner / Student Direct / Referral) are mutually exclusive.
   */
  const applyBusinessFilters = useCallback((q: any) => {
    return applySharedBusinessFilters(q, {
      source: filters.source,
      type: filters.type,
      entryMode: filters.entryMode,
      region: filters.region,
      loanRange: filters.loanRange,
      intake: filters.intake,
      loanType: filters.loanType,
    });
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
        // Stale > 48h: real latest activity logic (updated_at), excluding terminal/blocked states.
        if (filters.staleOnly) {
          const cutoff = new Date(Date.now() - STALE_HOURS * 3600 * 1000).toISOString();
          q = q
            .lt("updated_at", cutoff)
            .not("current_stage", "in", `(${STALE_TERMINAL_STAGES.join(",")})`)
            .not("current_status", "in", `(${STALE_BLOCKED_STATUSES.join(",")})`);
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
      setLastRefreshedAt(new Date());
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
      // Stale > 48h: keep counts in sync with the table (only when overriding for the
      // four health cards, the stale gate is intentionally ignored — those tiles always
      // reflect total/pending/lender/sanction in the current filter, not the stale subset).
      if (filters.staleOnly && !overrideStage && !overrideStatuses) {
        const cutoff = new Date(Date.now() - STALE_HOURS * 3600 * 1000).toISOString();
        q = q
          .lt("updated_at", cutoff)
          .not("current_stage", "in", `(${STALE_TERMINAL_STAGES.join(",")})`)
          .not("current_status", "in", `(${STALE_BLOCKED_STATUSES.join(",")})`);
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
      icon: AlertCircle,
      active: filters.status !== "all" && ["new", "awaiting_verification", "pending_info"].includes(filters.status),
      apply: () => { setFilters({ ...filters, status: "awaiting_verification" as StatusEnum, stage: "all" }); setPage(1); },
    },
    {
      label: "Docs to verify",
      icon: FileSearch,
      active: filters.stage === "documents_under_review",
      apply: () => { setFilters({ ...filters, stage: "documents_under_review" as StageEnum, status: "all" }); setPage(1); },
    },
    {
      label: "Sent to Lender",
      icon: Send,
      active: filters.stage === "sent_to_lender",
      apply: () => { setFilters({ ...filters, stage: "sent_to_lender" as StageEnum, status: "all" }); setPage(1); },
    },
    {
      label: "Sanction Received",
      icon: BadgeCheck,
      active: filters.stage === "sanction_received",
      apply: () => { setFilters({ ...filters, stage: "sanction_received" as StageEnum, status: "all" }); setPage(1); },
    },
    {
      label: "Stale > 48h",
      icon: Clock,
      active: filters.staleOnly,
      apply: () => {
        // Toggle the dedicated stale flag (real updated_at logic, terminal/blocked excluded).
        // Clears any leftover dateTo from the legacy stale chip so it doesn't double-filter.
        setFilters({
          ...filters,
          staleOnly: !filters.staleOnly,
          dateTo: filters.staleOnly ? filters.dateTo : undefined,
          stage: "all",
          status: "all",
        });
        setPage(1);
      },
    },
  ];

  // Active filter count (visual-only derivation from existing filters state)
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.search) n++;
    if (filters.source !== "all") n++;
    if (filters.stage !== "all") n++;
    if (filters.status !== "all") n++;
    if (filters.country !== "all") n++;
    if (filters.partnerId !== "all") n++;
    if (filters.dateFrom) n++;
    if (filters.dateTo) n++;
    if (filters.type !== "all") n++;
    if (filters.entryMode !== "all") n++;
    if (filters.region !== "all") n++;
    if (filters.loanRange !== "all") n++;
    if (filters.intake !== "all") n++;
    if (filters.loanType !== "all") n++;
    if (filters.staleOnly) n++;
    return n;
  }, [filters]);

  return (
    <div className="space-y-6 max-w-screen-2xl mx-auto">
      <PageHeader
        title="Lead Queue"
        description="Review, prioritize, assign, and manage education-loan leads across all sources."
        count={healthCounts.total}
        lastUpdated={lastRefreshedAt}
      >
        <Button size="sm" variant="outline" onClick={() => fetchPage()} disabled={loading}>
          <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </PageHeader>

      {/* Pipeline Summary Cards — premium tiles */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Total in queue",
            value: healthCounts.total,
            sub: "Matching current filters",
            icon: Layers,
            iconBg: "bg-slate-100 dark:bg-slate-500/15",
            iconFg: "text-slate-700 dark:text-slate-300",
          },
          {
            label: "Pending review",
            value: healthCounts.pendingReview,
            sub: "New · Awaiting verification · Pending info",
            icon: AlertCircle,
            iconBg: "bg-amber-100 dark:bg-amber-500/15",
            iconFg: "text-amber-700 dark:text-amber-400",
          },
          {
            label: "Sent to Lender",
            value: healthCounts.withLender,
            sub: "Awaiting lender decision",
            icon: Send,
            iconBg: "bg-primary/10",
            iconFg: "text-primary",
          },
          {
            label: "Sanction Received",
            value: healthCounts.sanction,
            sub: "Sanction in hand",
            icon: BadgeCheck,
            iconBg: "bg-emerald-100 dark:bg-emerald-500/15",
            iconFg: "text-emerald-700 dark:text-emerald-400",
          },
        ].map((tile) => {
          const Icon = tile.icon;
          return (
            <Card
              key={tile.label}
              className="p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2 min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight">
                    {tile.label}
                  </p>
                  {loading ? (
                    <Skeleton className="h-9 w-20" />
                  ) : (
                    <p className="text-3xl font-bold tabular-nums leading-none text-foreground">
                      {tile.value.toLocaleString("en-IN")}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                    {tile.sub}
                  </p>
                </div>
                <div className={`rounded-xl p-2.5 shrink-0 ${tile.iconBg}`}>
                  <Icon className={`h-5 w-5 ${tile.iconFg}`} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Control Bar — Filters & Search */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Filters & Search</h3>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 tabular-nums ml-1">
                {activeFilterCount} active
              </Badge>
            )}
          </div>
        </div>
        <CardContent className="p-5 space-y-4">
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

          {/* Quick views */}
          <div className="pt-4 border-t border-border/60 space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Quick views
            </p>
            <div className="flex flex-wrap gap-2">
              {quickChips.map((c) => {
                const Icon = c.icon;
                return (
                  <button
                    key={c.label}
                    type="button"
                    onClick={c.apply}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                      c.active
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-background hover:bg-muted hover:border-muted-foreground/30 text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table card */}
      <Card className="overflow-hidden">
        {/* Table header strip */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-5 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Leads</h3>
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 tabular-nums">
              {loading ? "—" : totalCount.toLocaleString("en-IN")}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {loading ? "Loading…" : error ? "—" : `Page ${page} of ${totalPages}`}
          </span>
        </div>

        <CardContent className="p-0">
          {/* Loading skeleton — table-shaped */}
          {loading && (
            <div className="divide-y divide-border">
              <div className="flex items-center gap-4 px-4 py-3 bg-muted/40">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-3 w-20" />)}
              </div>
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24 ml-auto" />
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 border-l-4 border-l-destructive bg-destructive/5">
              <div className="flex items-start gap-3 text-destructive">
                <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Failed to load lead queue</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => fetchPage()}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
              </Button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && rows.length === 0 && (
            <EmptyState
              icon={Inbox}
              title="No leads match your filters"
              description="Try adjusting filters or search terms above to see leads."
            />
          )}

          {/* Table */}
          {!loading && !error && rows.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Lead ID</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead className="text-right">
                      <button type="button" onClick={() => toggleSort("loan_amount_required")} className="inline-flex items-center gap-1 hover:text-foreground">
                        Loan {sortIcon("loan_amount_required")}
                      </button>
                    </TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>
                      <button type="button" onClick={() => toggleSort("updated_at")} className="inline-flex items-center gap-1 hover:text-foreground">
                        Updated {sortIcon("updated_at")}
                      </button>
                    </TableHead>
                    <TableHead className="text-right w-[60px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const name = studentName(r);
                    const initials = studentInitials(name);
                    return (
                      <TableRow
                        key={r.id}
                        data-clickable="true"
                        onClick={() => navigate(`/admin/leads/${r.id}`)}
                        className="group"
                      >
                        <TableCell className="py-3.5 font-mono text-xs text-muted-foreground">{r.lead_id ?? "—"}</TableCell>
                        <TableCell className="py-3.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold tracking-wide">
                              {initials}
                            </div>
                            <span className="font-medium text-foreground truncate">{name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3.5">
                          {r.source_type === "student_direct" ? (
                            <Badge variant="outline" className="text-[10px] font-medium">Student Portal</Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-medium max-w-[200px] truncate inline-block"
                              title={r.partner_display_name ? `Partner: ${r.partner_display_name}` : "Partner Lead"}
                            >
                              {r.partner_display_name ? `Partner · ${r.partner_display_name}` : "Partner Lead"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-3.5 text-muted-foreground tabular-nums text-xs">{r.student_phone}</TableCell>
                        <TableCell className="py-3.5 text-sm">{r.intended_study_country || "—"}</TableCell>
                        <TableCell className="py-3.5 max-w-[180px] truncate text-sm" title={r.course_name}>{r.course_name || "—"}</TableCell>
                        <TableCell className="py-3.5 text-right tabular-nums font-semibold text-foreground">
                          {r.loan_amount_required === null || r.loan_amount_required === undefined ? (
                            <span className="text-muted-foreground font-normal">—</span>
                          ) : (
                            <>
                              <span className="text-muted-foreground font-normal mr-0.5">₹</span>
                              {Number(r.loan_amount_required).toLocaleString("en-IN")}
                            </>
                          )}
                        </TableCell>
                        <TableCell className="py-3.5"><StageBadge stage={r.current_stage} /></TableCell>
                        <TableCell className="py-3.5"><StatusBadge status={r.current_status} /></TableCell>
                        <TableCell className="py-3.5 text-muted-foreground whitespace-nowrap text-xs">
                          {formatDistanceToNow(new Date(r.updated_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="py-3.5 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                            title="Edit lead"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/leads/new?edit=${r.id}`);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {!loading && !error && totalCount > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-3.5 border-t bg-muted/20">
              <span className="text-xs text-muted-foreground tabular-nums">
                Showing <span className="font-semibold text-foreground">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)}</span> of <span className="font-semibold text-foreground">{totalCount.toLocaleString("en-IN")}</span>
              </span>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
                </Button>
                <span className="text-xs px-3 tabular-nums text-muted-foreground">Page <span className="font-semibold text-foreground">{page}</span> / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
