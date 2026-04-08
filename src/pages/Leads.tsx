import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { StageBadge, StatusBadge, formatStageLabel } from "@/components/dashboard/StageBadge";
import {
  Plus, Search, Upload, X, ChevronLeft, ChevronRight, ArrowUpDown,
  AlertTriangle, FileText, Zap, Filter, LayoutList, CalendarIcon, ChevronDown,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";
import type { Database } from "@/integrations/supabase/types";

type Lead = Tables<"student_leads">;
type Stage = Database["public"]["Enums"]["lead_stage_enum"];
type Status = Database["public"]["Enums"]["lead_status_enum"];

const ALL_STAGES: Stage[] = [
  "draft", "submitted", "under_initial_review", "documents_pending",
  "documents_under_review", "bre_evaluated", "sent_to_lender",
  "login_submitted", "credit_query", "sanction_received",
  "disbursed", "rejected", "dropped", "on_hold",
];

const ALL_STATUSES: Status[] = [
  "new", "in_progress", "pending_info", "reupload_needed", "awaiting_verification",
  "verified", "under_assessment", "query_raised", "query_resolved",
  "approved", "conditionally_approved", "declined", "withdrawn", "on_hold", "completed", "not_applicable",
];

const ATTENTION_STAGES: Stage[] = ["on_hold", "documents_pending", "credit_query"];
const ATTENTION_STATUSES: Status[] = ["pending_info", "reupload_needed", "query_raised"];

const ORIGIN_OPTIONS = [
  { value: "all", label: "All Origins" },
  { value: "manual", label: "Manual" },
  { value: "quick_lead", label: "Quick Lead" },
  { value: "bulk_upload", label: "Bulk Upload" },
];

const PAGE_SIZE = 50;

type SortKey = "updated_at" | "created_at" | "student_first_name" | "loan_amount_required" | "intake_year";
type SortDir = "asc" | "desc";

const fmt = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function originLabel(lead: Lead): string {
  if (lead.source_sub_type === "bulk_upload") return "Bulk Upload";
  if (lead.source_sub_type === "quick_lead") return "Quick Lead";
  return "Manual";
}

function needsAttention(l: Lead): boolean {
  return (
    ATTENTION_STAGES.includes(l.current_stage) ||
    ATTENTION_STATUSES.includes(l.current_status) ||
    l.duplicate_flag
  );
}

/* ─── Summary strip config ─── */
const SUMMARY_ITEMS = [
  { label: "Total", key: "_total", color: "" },
  { label: "Under Review", key: "under_initial_review", color: "text-amber-700" },
  { label: "Docs Pending", key: "documents_pending", color: "text-orange-700" },
  { label: "Sanction Received", key: "sanction_received", color: "text-emerald-700" },
  { label: "Disbursed", key: "disbursed", color: "text-green-700" },
  { label: "On Hold", key: "on_hold", color: "text-yellow-700" },
  { label: "Rejected", key: "rejected", color: "text-destructive" },
  { label: "Attention", key: "_attention", color: "text-destructive" },
];

export default function Leads() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { agentUserId } = useRoleAccess();

  // ── Read URL params ──
  const paramStage = searchParams.get("stage") ?? "";
  const paramStatus = searchParams.get("status") ?? "";
  const paramAttention = searchParams.get("attention") === "true";
  const paramSearch = searchParams.get("q") ?? "";
  const paramDuplicate = searchParams.get("duplicate") === "true";
  const paramPage = parseInt(searchParams.get("page") ?? "1", 10) || 1;
  const paramOrigin = searchParams.get("origin") ?? "";
  const paramCountry = searchParams.get("country") ?? "";
  const paramIntakeTerm = searchParams.get("intake_term") ?? "";
  const paramIntakeYear = searchParams.get("intake_year") ?? "";
  const paramDateFrom = searchParams.get("date_from") ?? "";
  const paramDateTo = searchParams.get("date_to") ?? "";

  // ── State ──
  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(paramSearch);
  const [stageFilter, setStageFilter] = useState(paramStage || "all");
  const [statusFilter, setStatusFilter] = useState(paramStatus || "all");
  const [attentionFilter, setAttentionFilter] = useState(paramAttention);
  const [duplicateFilter, setDuplicateFilter] = useState(paramDuplicate);
  const [originFilter, setOriginFilter] = useState(paramOrigin || "all");
  const [countryFilter, setCountryFilter] = useState(paramCountry || "all");
  const [intakeTermFilter, setIntakeTermFilter] = useState(paramIntakeTerm || "all");
  const [intakeYearFilter, setIntakeYearFilter] = useState(paramIntakeYear || "all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(paramDateFrom ? new Date(paramDateFrom) : undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(paramDateTo ? new Date(paramDateTo) : undefined);
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(paramPage);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ── Master data for filters ──
  const [countries, setCountries] = useState<string[]>([]);
  const [intakeTerms, setIntakeTerms] = useState<string[]>([]);
  const [intakeYears, setIntakeYears] = useState<number[]>([]);

  // ── Summary counts ──
  const [summaryCounts, setSummaryCounts] = useState<Record<string, number>>({});

  // ── Load master data once ──
  useEffect(() => {
    const load = async () => {
      const [cRes, iRes] = await Promise.all([
        supabase.from("countries_master").select("country_name").eq("active_flag", true).order("country_name"),
        supabase.from("intake_master").select("intake_term, intake_year").eq("active_flag", true).order("sort_order"),
      ]);
      if (cRes.data) setCountries(cRes.data.map((c) => c.country_name));
      if (iRes.data) {
        const terms = [...new Set(iRes.data.map((i) => i.intake_term))];
        const years = [...new Set(iRes.data.map((i) => i.intake_year))].sort((a, b) => b - a);
        setIntakeTerms(terms);
        setIntakeYears(years);
      }
    };
    load();
  }, []);

  // ── Auto-show advanced filters if any are active from URL ──
  useEffect(() => {
    if (paramOrigin || paramCountry || paramIntakeTerm || paramIntakeYear || paramDateFrom || paramDateTo) {
      setShowAdvanced(true);
    }
  }, []);

  // ── Fetch leads ──
  const fetchLeads = useCallback(async () => {
    setLoading(true);

    const applyFilters = (q: any) => {
      if (agentUserId) q = q.eq("partner_user_id", agentUserId);
      if (stageFilter !== "all") {
        if (stageFilter.includes(",")) q = q.in("current_stage", stageFilter.split(",") as Stage[]);
        else q = q.eq("current_stage", stageFilter as Stage);
      }
      if (statusFilter !== "all") q = q.eq("current_status", statusFilter as Status);
      if (duplicateFilter) q = q.eq("duplicate_flag", true);
      if (originFilter !== "all") {
        if (originFilter === "manual") {
          q = q.or("source_sub_type.is.null,source_sub_type.eq.manual");
        } else {
          q = q.eq("source_sub_type", originFilter);
        }
      }
      if (countryFilter !== "all") q = q.eq("intended_study_country", countryFilter);
      if (intakeTermFilter !== "all") q = q.eq("intake_term", intakeTermFilter);
      if (intakeYearFilter !== "all") q = q.eq("intake_year", parseInt(intakeYearFilter));
      if (dateFrom) q = q.gte("created_at", dateFrom.toISOString());
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        q = q.lte("created_at", end.toISOString());
      }
      if (search.trim()) {
        const s = `%${search.trim()}%`;
        q = q.or(`student_first_name.ilike.${s},student_last_name.ilike.${s},student_phone.ilike.${s},student_email.ilike.${s},lead_id.ilike.${s},course_name.ilike.${s},university_name_raw.ilike.${s}`);
      }
      return q;
    };

    // Count query
    let countQ = supabase.from("student_leads").select("id", { count: "exact", head: true }).eq("is_archived", false);
    countQ = applyFilters(countQ);

    // Data query
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let q = supabase.from("student_leads").select("*").eq("is_archived", false).order(sortKey, { ascending: sortDir === "asc" }).range(from, to);
    q = applyFilters(q);

    const [{ data }, { count }] = await Promise.all([q, countQ]);
    let results = data ?? [];

    if (attentionFilter) {
      results = results.filter(needsAttention);
    }

    setLeads(results);
    setTotalCount(attentionFilter ? results.length : (count ?? results.length));
    setLoading(false);

    // Summary counts from returned data
    const counts: Record<string, number> = {};
    for (const l of results) {
      counts[l.current_stage] = (counts[l.current_stage] ?? 0) + 1;
    }
    counts._attention = results.filter(needsAttention).length;
    counts._total = attentionFilter ? results.length : (count ?? results.length);
    setSummaryCounts(counts);
  }, [stageFilter, statusFilter, duplicateFilter, attentionFilter, originFilter, countryFilter, intakeTermFilter, intakeYearFilter, dateFrom, dateTo, search, sortKey, sortDir, page, agentUserId]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // ── Sync filters to URL ──
  useEffect(() => {
    const p = new URLSearchParams();
    if (stageFilter !== "all") p.set("stage", stageFilter);
    if (statusFilter !== "all") p.set("status", statusFilter);
    if (attentionFilter) p.set("attention", "true");
    if (duplicateFilter) p.set("duplicate", "true");
    if (originFilter !== "all") p.set("origin", originFilter);
    if (countryFilter !== "all") p.set("country", countryFilter);
    if (intakeTermFilter !== "all") p.set("intake_term", intakeTermFilter);
    if (intakeYearFilter !== "all") p.set("intake_year", intakeYearFilter);
    if (dateFrom) p.set("date_from", dateFrom.toISOString().split("T")[0]);
    if (dateTo) p.set("date_to", dateTo.toISOString().split("T")[0]);
    if (search) p.set("q", search);
    if (page > 1) p.set("page", String(page));
    setSearchParams(p, { replace: true });
  }, [stageFilter, statusFilter, attentionFilter, duplicateFilter, originFilter, countryFilter, intakeTermFilter, intakeYearFilter, dateFrom, dateTo, search, page]);

  // ── Active filter chips ──
  const activeFilters: { label: string; clear: () => void }[] = [];
  if (stageFilter !== "all") activeFilters.push({ label: `Stage: ${fmt(stageFilter)}`, clear: () => setStageFilter("all") });
  if (statusFilter !== "all") activeFilters.push({ label: `Status: ${fmt(statusFilter)}`, clear: () => setStatusFilter("all") });
  if (attentionFilter) activeFilters.push({ label: "Needs Attention", clear: () => setAttentionFilter(false) });
  if (duplicateFilter) activeFilters.push({ label: "Duplicates Only", clear: () => setDuplicateFilter(false) });
  if (originFilter !== "all") activeFilters.push({ label: `Origin: ${fmt(originFilter)}`, clear: () => setOriginFilter("all") });
  if (countryFilter !== "all") activeFilters.push({ label: `Country: ${countryFilter}`, clear: () => setCountryFilter("all") });
  if (intakeTermFilter !== "all") activeFilters.push({ label: `Term: ${intakeTermFilter}`, clear: () => setIntakeTermFilter("all") });
  if (intakeYearFilter !== "all") activeFilters.push({ label: `Year: ${intakeYearFilter}`, clear: () => setIntakeYearFilter("all") });
  if (dateFrom) activeFilters.push({ label: `From: ${format(dateFrom, "dd MMM yyyy")}`, clear: () => setDateFrom(undefined) });
  if (dateTo) activeFilters.push({ label: `To: ${format(dateTo, "dd MMM yyyy")}`, clear: () => setDateTo(undefined) });
  if (search) activeFilters.push({ label: `Search: "${search}"`, clear: () => setSearch("") });

  const clearAll = () => {
    setStageFilter("all"); setStatusFilter("all"); setAttentionFilter(false);
    setDuplicateFilter(false); setOriginFilter("all"); setCountryFilter("all");
    setIntakeTermFilter("all"); setIntakeYearFilter("all");
    setDateFrom(undefined); setDateTo(undefined); setSearch(""); setPage(1);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Submitted Leads</h1>
          <p className="text-sm text-muted-foreground">Track and manage all submitted partner leads from one place.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate("/leads/quick")}>
            <Zap className="mr-1 h-4 w-4" /> Quick Lead
          </Button>
          <Button size="sm" onClick={() => navigate("/leads/new")}>
            <Plus className="mr-1 h-4 w-4" /> Add Lead
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/bulk-upload")}>
            <Upload className="mr-1 h-4 w-4" /> Bulk Upload
          </Button>
        </div>
      </div>

      {/* ── Summary Strip ── */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
        {SUMMARY_ITEMS.map((s) => (
          <button
            key={s.key}
            onClick={() => {
              if (s.key === "_attention") { setAttentionFilter(true); setStageFilter("all"); }
              else if (s.key === "_total") clearAll();
              else { setStageFilter(s.key); setAttentionFilter(false); }
              setPage(1);
            }}
            className={cn(
              "rounded-lg border p-2.5 text-center hover:bg-muted/50 transition-colors",
              stageFilter === s.key && "ring-2 ring-primary/40"
            )}
          >
            <p className={`text-lg font-bold ${s.color}`}>{summaryCounts[s.key] ?? 0}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{s.label}</p>
          </button>
        ))}
      </div>

      {/* ── Search & Filters ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, email, lead ID, course, university…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <Select value={stageFilter} onValueChange={(v) => { setStageFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[170px]"><SelectValue placeholder="All Stages" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {ALL_STAGES.map((s) => <SelectItem key={s} value={s}>{fmt(s)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[170px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {ALL_STATUSES.map((s) => <SelectItem key={s} value={s}>{fmt(s)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant={attentionFilter ? "default" : "outline"} size="sm" onClick={() => { setAttentionFilter(!attentionFilter); setPage(1); }}>
              <AlertTriangle className="mr-1 h-3.5 w-3.5" /> Attention
            </Button>
            <Button variant={duplicateFilter ? "default" : "outline"} size="sm" onClick={() => { setDuplicateFilter(!duplicateFilter); setPage(1); }}>
              <Filter className="mr-1 h-3.5 w-3.5" /> Duplicates
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowAdvanced(!showAdvanced)} className="text-xs">
              <ChevronDown className={cn("mr-1 h-3.5 w-3.5 transition-transform", showAdvanced && "rotate-180")} />
              More Filters
            </Button>
          </div>

          {/* ── Advanced Filters Row ── */}
          {showAdvanced && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-3 border-t mt-3">
              {/* Study Destination */}
              <Select value={countryFilter} onValueChange={(v) => { setCountryFilter(v); setPage(1); }}>
                <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Study Destination" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Destinations</SelectItem>
                  {countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              {/* Intake Term */}
              <Select value={intakeTermFilter} onValueChange={(v) => { setIntakeTermFilter(v); setPage(1); }}>
                <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Intake Term" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Terms</SelectItem>
                  {intakeTerms.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              {/* Intake Year */}
              <Select value={intakeYearFilter} onValueChange={(v) => { setIntakeYearFilter(v); setPage(1); }}>
                <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Intake Year" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {intakeYears.map((y) => <SelectItem key={y} value={String(y)}>{String(y)}</SelectItem>)}
                </SelectContent>
              </Select>
              {/* Origin */}
              <Select value={originFilter} onValueChange={(v) => { setOriginFilter(v); setPage(1); }}>
                <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Origin" /></SelectTrigger>
                <SelectContent>
                  {ORIGIN_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {/* Date Range */}
              <div className="flex gap-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("h-9 text-xs flex-1 justify-start", !dateFrom && "text-muted-foreground")}>
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {dateFrom ? format(dateFrom, "dd/MM/yy") : "From"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); setPage(1); }} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("h-9 text-xs flex-1 justify-start", !dateTo && "text-muted-foreground")}>
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {dateTo ? format(dateTo, "dd/MM/yy") : "To"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); setPage(1); }} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {/* Active filter chips */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2">
              {activeFilters.map((f, i) => (
                <Badge key={i} variant="secondary" className="gap-1 text-xs cursor-pointer" onClick={f.clear}>
                  {f.label} <X className="h-3 w-3" />
                </Badge>
              ))}
              {activeFilters.length > 1 && (
                <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={clearAll}>Clear all</Button>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <LayoutList className="h-8 w-8 text-muted-foreground mx-auto mb-2 animate-pulse" />
              <p className="text-sm text-muted-foreground">Loading leads…</p>
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              {activeFilters.length > 0 ? (
                <>
                  <p className="text-muted-foreground mb-1">No leads match your current filters.</p>
                  <p className="text-xs text-muted-foreground mb-3">Try adjusting or clearing your filters to see results.</p>
                  <Button variant="outline" size="sm" onClick={clearAll}>Clear Filters</Button>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground mb-1">No submitted leads yet.</p>
                  <p className="text-xs text-muted-foreground mb-3">Add a lead or upload a batch to get started.</p>
                  <div className="flex justify-center gap-2">
                    <Button size="sm" onClick={() => navigate("/leads/new")}><Plus className="mr-1 h-3.5 w-3.5" /> Add Lead</Button>
                    <Button variant="outline" size="sm" onClick={() => navigate("/bulk-upload")}><Upload className="mr-1 h-3.5 w-3.5" /> Bulk Upload</Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              {/* ── Table ── */}
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">Lead ID</TableHead>
                      <TableHead>
                        <button className="flex items-center gap-1" onClick={() => toggleSort("student_first_name")}>
                          Student <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Intake</TableHead>
                      <TableHead>University</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>
                        <button className="flex items-center gap-1" onClick={() => toggleSort("loan_amount_required")}>
                          Loan Amt <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </TableHead>
                      <TableHead>Origin</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>
                        <button className="flex items-center gap-1" onClick={() => toggleSort("updated_at")}>
                          Updated <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead) => {
                      const attn = needsAttention(lead);
                      return (
                        <TableRow
                          key={lead.id}
                          className={cn(
                            "cursor-pointer",
                            attn && "bg-yellow-50/40 dark:bg-yellow-900/5",
                            lead.duplicate_flag && "bg-orange-50/30 dark:bg-orange-900/5"
                          )}
                          onClick={() => navigate(`/leads/${lead.id}`)}
                        >
                          <TableCell className="font-mono text-xs">{lead.lead_id ?? "—"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-sm">{lead.student_full_name ?? lead.student_first_name}</span>
                              {lead.duplicate_flag && (
                                <Badge variant="outline" className="text-[10px] px-1 border-yellow-300 text-yellow-700">Dup</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{lead.student_phone}</TableCell>
                          <TableCell className="text-sm">{lead.intended_study_country}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{lead.intake_term} {lead.intake_year}</TableCell>
                          <TableCell className="text-sm max-w-[120px] truncate" title={lead.university_name_raw ?? ""}>{lead.university_name_raw ?? "—"}</TableCell>
                          <TableCell className="text-sm max-w-[120px] truncate" title={lead.course_name}>{lead.course_name}</TableCell>
                          <TableCell className="text-sm">
                            {lead.loan_amount_required ? `₹${Number(lead.loan_amount_required).toLocaleString("en-IN")}` : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px] px-1.5">{originLabel(lead)}</Badge>
                          </TableCell>
                          <TableCell><StageBadge stage={lead.current_stage} /></TableCell>
                          <TableCell><StatusBadge status={lead.current_status} /></TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(lead.updated_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {lead.current_stage === "draft" && (
                                <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={(e) => { e.stopPropagation(); navigate(`/leads/new?draft=${lead.id}`); }}>
                                  Resume
                                </Button>
                              )}
                              {lead.duplicate_flag && (
                                <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-yellow-700" title="View duplicate context" onClick={(e) => { e.stopPropagation(); navigate(`/leads/${lead.id}`); }}>
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* ── Pagination ── */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-xs text-muted-foreground">
                    Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs px-2">Page {page} of {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
