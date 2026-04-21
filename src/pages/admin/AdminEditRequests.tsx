import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, ClipboardCheck, Eye, Search } from "lucide-react";
import { ViewRequestDialog } from "@/components/admin/ViewRequestDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import type { Tables } from "@/integrations/supabase/types";

type EditRequest = Tables<"lead_edit_requests">;
type Lead = Pick<Tables<"student_leads">, "id" | "lead_id" | "student_full_name" | "student_first_name" | "student_last_name">;
type Partner = Pick<Tables<"partner_organizations">, "id" | "display_name">;

type Filter = "pending" | "applied" | "rejected" | "all";
type SortKey = "latest_submitted" | "oldest_submitted" | "pending_first" | "latest_decided";

const STATUS_CLS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900 border-amber-300",
  applied: "bg-emerald-100 text-emerald-900 border-emerald-300",
  acknowledged: "bg-slate-100 text-slate-800 border-slate-300",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

interface Counts {
  pending: number;
  applied: number;
  acknowledged: number;
  rejected: number;
}

function deriveStatusLabel(r: EditRequest): { key: string; label: string } {
  if (r.status === "applied") {
    const applied = (r.applied_changes ?? {}) as Record<string, unknown>;
    if (Object.keys(applied).length === 0) return { key: "acknowledged", label: "Acknowledged" };
    return { key: "applied", label: "Applied" };
  }
  return { key: r.status, label: r.status.charAt(0).toUpperCase() + r.status.slice(1) };
}

export default function AdminEditRequests() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("pending");
  const [partnerFilter, setPartnerFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("latest_submitted");
  const [requests, setRequests] = useState<EditRequest[]>([]);
  const [leads, setLeads] = useState<Record<string, Lead>>({});
  const [partners, setPartners] = useState<Record<string, Partner>>({});
  const [allPartners, setAllPartners] = useState<Partner[]>([]);
  const [counts, setCounts] = useState<Counts>({ pending: 0, applied: 0, acknowledged: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<EditRequest | null>(null);

  // ---- Load counts (all-time, head queries) ----
  const loadCounts = async () => {
    const [pRes, aRes, rRes, allAppliedRes] = await Promise.all([
      supabase.from("lead_edit_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("lead_edit_requests").select("id, applied_changes").eq("status", "applied"),
      supabase.from("lead_edit_requests").select("*", { count: "exact", head: true }).eq("status", "rejected"),
      Promise.resolve(null),
    ]);
    void allAppliedRes;
    let appliedCount = 0;
    let acknowledgedCount = 0;
    (aRes.data ?? []).forEach((row: { applied_changes: unknown }) => {
      const ac = (row.applied_changes ?? {}) as Record<string, unknown>;
      if (Object.keys(ac).length === 0) acknowledgedCount += 1;
      else appliedCount += 1;
    });
    setCounts({
      pending: pRes.count ?? 0,
      applied: appliedCount,
      acknowledged: acknowledgedCount,
      rejected: rRes.count ?? 0,
    });
  };

  // ---- Load partner list for the filter dropdown ----
  const loadPartners = async () => {
    const { data } = await supabase
      .from("partner_organizations")
      .select("id, display_name")
      .order("display_name");
    setAllPartners(data ?? []);
  };

  // ---- Load request rows ----
  const loadRequests = async () => {
    setLoading(true);
    let q = supabase.from("lead_edit_requests").select("*").limit(200);

    if (filter !== "all") q = q.eq("status", filter);
    if (partnerFilter !== "all") q = q.eq("partner_id", partnerFilter);

    // Sort
    if (sortKey === "latest_submitted") q = q.order("created_at", { ascending: false });
    else if (sortKey === "oldest_submitted") q = q.order("created_at", { ascending: true });
    else if (sortKey === "latest_decided") q = q.order("decided_at", { ascending: false, nullsFirst: false });
    else if (sortKey === "pending_first") {
      // Pending first via two-key sort: status pending sorts before others, then by created_at desc.
      // PostgREST doesn't support custom enum order, so we sort by created_at desc and rely on the
      // row pinning below. Server returns recent first; client step pins pending to top.
      q = q.order("created_at", { ascending: false });
    }

    const { data } = await q;
    let rows = data ?? [];

    // Server-side search (lead_id text or student name) — fetch matching lead ids first
    if (search.trim().length >= 2) {
      const term = search.trim();
      const leadMatches = await supabase
        .from("student_leads")
        .select("id")
        .or(`lead_id.ilike.%${term}%,student_full_name.ilike.%${term}%,student_first_name.ilike.%${term}%,student_last_name.ilike.%${term}%`)
        .limit(500);
      const allowedIds = new Set((leadMatches.data ?? []).map((l) => l.id));
      rows = rows.filter((r) => allowedIds.has(r.lead_id));
    }

    if (sortKey === "pending_first") {
      rows = [...rows].sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    setRequests(rows);

    const leadIds = Array.from(new Set(rows.map((r) => r.lead_id)));
    const partnerIds = Array.from(new Set(rows.map((r) => r.partner_id)));
    const [leadsRes, partnersRes] = await Promise.all([
      leadIds.length
        ? supabase.from("student_leads").select("id,lead_id,student_full_name,student_first_name,student_last_name").in("id", leadIds)
        : Promise.resolve({ data: [] as Lead[] } as never),
      partnerIds.length
        ? supabase.from("partner_organizations").select("id,display_name").in("id", partnerIds)
        : Promise.resolve({ data: [] as Partner[] } as never),
    ]);
    const leadMap: Record<string, Lead> = {};
    (leadsRes.data ?? []).forEach((l: Lead) => { leadMap[l.id] = l; });
    setLeads(leadMap);
    const partnerMap: Record<string, Partner> = {};
    (partnersRes.data ?? []).forEach((p: Partner) => { partnerMap[p.id] = p; });
    setPartners(partnerMap);
    setLoading(false);
  };

  useEffect(() => {
    loadCounts();
    loadPartners();
  }, []);

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, partnerFilter, sortKey]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => { loadRequests(); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const summary = useMemo(() => ([
    { key: "pending", label: "Pending", value: counts.pending, cls: "border-amber-300 bg-amber-50/60", text: "text-amber-900" },
    { key: "applied", label: "Applied", value: counts.applied, cls: "border-emerald-300 bg-emerald-50/60", text: "text-emerald-900" },
    { key: "acknowledged", label: "Acknowledged", value: counts.acknowledged, cls: "border-slate-300 bg-slate-50/60", text: "text-slate-800" },
    { key: "rejected", label: "Rejected", value: counts.rejected, cls: "border-destructive/30 bg-destructive/5", text: "text-destructive" },
  ]), [counts]);

  const viewedLead = viewing ? leads[viewing.lead_id] : undefined;
  const viewedPartner = viewing ? partners[viewing.partner_id] : undefined;
  const viewedStudentName = viewedLead
    ? (viewedLead.student_full_name ?? `${viewedLead.student_first_name ?? ""} ${viewedLead.student_last_name ?? ""}`.trim())
    : "";

  return (
    <div className="max-w-screen-2xl mx-auto space-y-6">
      <PageHeader
        title="Requests & Approvals"
        description="Partner-raised edit requests across all leads · all-time view."
      />


      {/* Summary cards (all-time) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summary.map((s) => (
          <Card key={s.key} className={`p-4 ${s.cls}`}>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.text}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Status tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="applied">Applied</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-2 md:items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Lead ID or student name…"
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Select value={partnerFilter} onValueChange={setPartnerFilter}>
          <SelectTrigger className="md:w-[220px] h-9 text-sm">
            <SelectValue placeholder="All partners" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All partners</SelectItem>
            {allPartners.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger className="md:w-[200px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="latest_submitted">Latest submitted</SelectItem>
            <SelectItem value="oldest_submitted">Oldest submitted</SelectItem>
            <SelectItem value="pending_first">Pending first</SelectItem>
            <SelectItem value="latest_decided">Latest decided</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">{requests.length} request{requests.length !== 1 ? "s" : ""}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <ClipboardCheck className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium">No requests in this view.</p>
              <p className="text-xs text-muted-foreground">Edit requests submitted by partners will appear here.</p>
            </div>
          ) : (
            <div className="border rounded-md divide-y overflow-x-auto">
              <div className="grid grid-cols-[80px_minmax(200px,1.3fr)_minmax(140px,1fr)_110px_minmax(150px,1fr)_140px_140px_88px] gap-3 px-3 py-2.5 text-[11px] font-medium uppercase text-muted-foreground tracking-wide min-h-11 items-center min-w-[1100px]">
                <span>Req ID</span>
                <span>Lead</span>
                <span>Partner</span>
                <span>Status</span>
                <span>Reason</span>
                <span>Submitted</span>
                <span>Decided</span>
                <span className="text-right">Actions</span>
              </div>
              {requests.map((r) => {
                const lead = leads[r.lead_id];
                const partner = partners[r.partner_id];
                const changes = (r.requested_changes ?? {}) as Record<string, unknown>;
                const fieldCount = Object.keys(changes).length;
                const studentName = lead?.student_full_name ?? `${lead?.student_first_name ?? ""} ${lead?.student_last_name ?? ""}`.trim();
                const status = deriveStatusLabel(r);
                return (
                  <div key={r.id} className="grid grid-cols-[80px_minmax(200px,1.3fr)_minmax(140px,1fr)_110px_minmax(150px,1fr)_140px_140px_88px] gap-3 px-3 py-2.5 text-xs items-center hover:bg-muted/30 min-h-11 min-w-[1100px]">
                    <span className="font-mono text-[10px] text-muted-foreground truncate" title={r.id}>{r.id.slice(0, 8)}</span>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{studentName || "—"}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{lead?.lead_id ?? "—"}</p>
                    </div>
                    <span className="truncate">{partner?.display_name ?? "—"}</span>
                    <Badge variant="outline" className={`${STATUS_CLS[status.key] ?? ""} justify-self-start whitespace-nowrap`}>
                      {fieldCount > 0 ? `${fieldCount} · ${status.label}` : status.label}
                    </Badge>
                    <span className="truncate text-muted-foreground" title={r.partner_reason ?? ""}>{r.partner_reason ?? "—"}</span>
                    <span className="text-muted-foreground truncate" title={new Date(r.created_at).toLocaleString()}>
                      {new Date(r.created_at).toLocaleDateString()} {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="text-muted-foreground truncate">
                      {r.decided_at ? `${new Date(r.decided_at).toLocaleDateString()} ${new Date(r.decided_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "—"}
                    </span>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewing(r)} title="View request">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/admin/leads/${r.lead_id}`)} title="Open lead">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ViewRequestDialog
        open={!!viewing}
        onOpenChange={(v) => { if (!v) setViewing(null); }}
        request={viewing}
        studentName={viewedStudentName}
        leadDisplayId={viewedLead?.lead_id ?? undefined}
        partnerName={viewedPartner?.display_name ?? undefined}
        onOpenLead={viewing ? () => { navigate(`/admin/leads/${viewing.lead_id}`); setViewing(null); } : undefined}
      />
    </div>
  );
}
