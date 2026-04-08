import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StageBadge, StatusBadge, formatStageLabel } from "@/components/dashboard/StageBadge";
import {
  Plus, Search, Upload, X, ChevronLeft, ChevronRight, ArrowUpDown,
  AlertTriangle, FileText, Zap, Filter, LayoutList,
} from "lucide-react";
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

  // ── State ──
  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(paramSearch);
  const [stageFilter, setStageFilter] = useState(paramStage || "all");
  const [statusFilter, setStatusFilter] = useState(paramStatus || "all");
  const [attentionFilter, setAttentionFilter] = useState(paramAttention);
  const [duplicateFilter, setDuplicateFilter] = useState(paramDuplicate);
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(paramPage);

  // ── Summary counts (from current result set) ──
  const [summaryCounts, setSummaryCounts] = useState<Record<string, number>>({});

  // ── Fetch leads ──
  const fetchLeads = useCallback(async () => {
    setLoading(true);

    // Count query (simplified)
    let countQ = supabase.from("student_leads").select("id", { count: "exact", head: true }).eq("is_archived", false);
    if (agentUserId) countQ = countQ.eq("partner_user_id", agentUserId);
    if (stageFilter !== "all") {
      if (stageFilter.includes(",")) countQ = countQ.in("current_stage", stageFilter.split(",") as Stage[]);
      else countQ = countQ.eq("current_stage", stageFilter as Stage);
    }
    if (statusFilter !== "all") countQ = countQ.eq("current_status", statusFilter as Status);
    if (duplicateFilter) countQ = countQ.eq("duplicate_flag", true);

    // Data query
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let q = supabase.from("student_leads").select("*").eq("is_archived", false).order(sortKey, { ascending: sortDir === "asc" }).range(from, to);

    if (agentUserId) q = q.eq("partner_user_id", agentUserId);
    if (stageFilter !== "all") {
      if (stageFilter.includes(",")) q = q.in("current_stage", stageFilter.split(",") as Stage[]);
      else q = q.eq("current_stage", stageFilter as Stage);
    }
    if (statusFilter !== "all") q = q.eq("current_status", statusFilter as Status);
    if (duplicateFilter) q = q.eq("duplicate_flag", true);

    // Text search (ilike across multiple fields)
    if (search.trim()) {
      const s = `%${search.trim()}%`;
      q = q.or(`student_first_name.ilike.${s},student_last_name.ilike.${s},student_phone.ilike.${s},student_email.ilike.${s},lead_id.ilike.${s},course_name.ilike.${s}`);
      countQ = countQ.or(`student_first_name.ilike.${s},student_last_name.ilike.${s},student_phone.ilike.${s},student_email.ilike.${s},lead_id.ilike.${s},course_name.ilike.${s}`);
    }

    const [{ data }, { count }] = await Promise.all([q, countQ]);
    let results = data ?? [];

    // Client-side attention filter (combines stages + statuses)
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
  }, [stageFilter, statusFilter, duplicateFilter, attentionFilter, search, sortKey, sortDir, page, agentUserId]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // ── Sync filters to URL ──
  useEffect(() => {
    const p = new URLSearchParams();
    if (stageFilter !== "all") p.set("stage", stageFilter);
    if (statusFilter !== "all") p.set("status", statusFilter);
    if (attentionFilter) p.set("attention", "true");
    if (duplicateFilter) p.set("duplicate", "true");
    if (search) p.set("q", search);
    if (page > 1) p.set("page", String(page));
    setSearchParams(p, { replace: true });
  }, [stageFilter, statusFilter, attentionFilter, duplicateFilter, search, page]);

  // ── Active filter chips ──
  const activeFilters: { label: string; clear: () => void }[] = [];
  if (stageFilter !== "all") activeFilters.push({ label: `Stage: ${fmt(stageFilter)}`, clear: () => setStageFilter("all") });
  if (statusFilter !== "all") activeFilters.push({ label: `Status: ${fmt(statusFilter)}`, clear: () => setStatusFilter("all") });
  if (attentionFilter) activeFilters.push({ label: "Needs Attention", clear: () => setAttentionFilter(false) });
  if (duplicateFilter) activeFilters.push({ label: "Duplicates Only", clear: () => setDuplicateFilter(false) });
  if (search) activeFilters.push({ label: `Search: "${search}"`, clear: () => setSearch("") });

  const clearAll = () => {
    setStageFilter("all");
    setStatusFilter("all");
    setAttentionFilter(false);
    setDuplicateFilter(false);
    setSearch("");
    setPage(1);
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
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          { label: "Total", key: "_total", color: "" },
          { label: "Under Review", key: "under_initial_review", color: "text-amber-700" },
          { label: "Docs Pending", key: "documents_pending", color: "text-orange-700" },
          { label: "On Hold", key: "on_hold", color: "text-yellow-700" },
          { label: "Disbursed", key: "disbursed", color: "text-green-700" },
          { label: "Attention", key: "_attention", color: "text-destructive" },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => {
              if (s.key === "_attention") { setAttentionFilter(true); setStageFilter("all"); }
              else if (s.key === "_total") clearAll();
              else { setStageFilter(s.key); setAttentionFilter(false); }
              setPage(1);
            }}
            className="rounded-lg border p-2.5 text-center hover:bg-muted/50 transition-colors"
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
                placeholder="Search by name, phone, email, lead ID, course…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <Select value={stageFilter} onValueChange={(v) => { setStageFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {ALL_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>{fmt(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {ALL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{fmt(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={attentionFilter ? "default" : "outline"}
              size="sm"
              onClick={() => { setAttentionFilter(!attentionFilter); setPage(1); }}
            >
              <AlertTriangle className="mr-1 h-3.5 w-3.5" /> Attention
            </Button>
            <Button
              variant={duplicateFilter ? "default" : "outline"}
              size="sm"
              onClick={() => { setDuplicateFilter(!duplicateFilter); setPage(1); }}
            >
              <Filter className="mr-1 h-3.5 w-3.5" /> Duplicates
            </Button>
          </div>

          {/* Active filter chips */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2">
              {activeFilters.map((f, i) => (
                <Badge key={i} variant="secondary" className="gap-1 text-xs cursor-pointer" onClick={f.clear}>
                  {f.label} <X className="h-3 w-3" />
                </Badge>
              ))}
              {activeFilters.length > 1 && (
                <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={clearAll}>
                  Clear all
                </Button>
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
                  <p className="text-xs text-muted-foreground mb-3">Try adjusting or clearing your filters.</p>
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
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead) => {
                      const attn = needsAttention(lead);
                      return (
                        <TableRow
                          key={lead.id}
                          className={`cursor-pointer ${attn ? "bg-yellow-50/40 dark:bg-yellow-900/5" : ""}`}
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
                          <TableCell className="text-sm max-w-[130px] truncate">{lead.course_name}</TableCell>
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
                            {lead.current_stage === "draft" && (
                              <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={(e) => { e.stopPropagation(); navigate(`/leads/new?draft=${lead.id}`); }}>
                                Resume
                              </Button>
                            )}
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
