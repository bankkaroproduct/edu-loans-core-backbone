import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronRight, Users, UserX } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";

type RangeKey = "this_month" | "last_3m" | "last_6m" | "all";

const TERMINAL = new Set(["rejected", "dropped", "disbursed"]);

type LeadRow = {
  id: string;
  lead_id: string | null;
  student_first_name: string | null;
  student_last_name: string | null;
  partner_id: string;
  current_stage: string;
  created_at: string;
  updated_at: string;
};
type AdminUser = { id: string; full_name: string; email: string; role: string; is_super_admin: boolean };
type Partner = { id: string; display_name: string; partner_code: string };
type HistRow = { lead_id: string; new_stage: string; created_at: string };

interface AdminMetrics {
  partners: Partner[];
  leads: LeadRow[];
  totalLeads: number;
  activeLeads: number;
  staleLeads: LeadRow[];
  sanctioned: number;
  disbursed: number;
  rejected: number;
  rejectionRate: number;
  avgDaysToLender: number | null;
}

function getRangeStart(r: RangeKey): Date | null {
  const d = new Date();
  if (r === "this_month") { d.setDate(1); d.setHours(0,0,0,0); return d; }
  if (r === "last_3m") { d.setMonth(d.getMonth() - 3); return d; }
  if (r === "last_6m") { d.setMonth(d.getMonth() - 6); return d; }
  return null;
}

export default function AdminTeamPerformance() {
  const [range, setRange] = useState<RangeKey>("this_month");
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [assignments, setAssignments] = useState<{ user_id: string; partner_id: string }[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [firstSentMap, setFirstSentMap] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const start = getRangeStart(range);
      const leadsQ = supabase
        .from("student_leads")
        .select("id, lead_id, student_first_name, student_last_name, partner_id, current_stage, created_at, updated_at")
        .eq("is_archived", false)
        .order("updated_at", { ascending: false })
        .limit(5000);
      if (start) leadsQ.gte("created_at", start.toISOString());

      const [usersRes, partnersRes, assignsRes, leadsRes, histRes] = await Promise.all([
        supabase.from("users").select("id, full_name, email, role, is_super_admin")
          .eq("role", "admin").eq("is_super_admin", false).eq("is_active", true),
        supabase.from("partner_organizations").select("id, display_name, partner_code").eq("is_archived", false),
        supabase.from("admin_partner_assignments").select("user_id, partner_id"),
        leadsQ,
        supabase.from("lead_stage_history").select("lead_id, new_stage, created_at")
          .eq("new_stage", "sent_to_lender").order("created_at", { ascending: true }).limit(5000),
      ]);
      if (cancelled) return;
      setAdmins(usersRes.data ?? []);
      setPartners(partnersRes.data ?? []);
      setAssignments(assignsRes.data ?? []);
      setLeads((leadsRes.data ?? []) as LeadRow[]);
      const m: Record<string, string> = {};
      for (const h of (histRes.data ?? []) as HistRow[]) {
        if (!m[h.lead_id]) m[h.lead_id] = h.created_at;
      }
      setFirstSentMap(m);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [range]);

  const partnerById = useMemo(() => {
    const m: Record<string, Partner> = {};
    for (const p of partners) m[p.id] = p;
    return m;
  }, [partners]);

  const adminPartnersMap = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const a of assignments) (m[a.user_id] ??= []).push(a.partner_id);
    return m;
  }, [assignments]);

  const assignedPartnerSet = useMemo(() => new Set(assignments.map((a) => a.partner_id)), [assignments]);

  const computeMetrics = (partnerIds: string[]): AdminMetrics => {
    const idSet = new Set(partnerIds);
    const ls = leads.filter((l) => idSet.has(l.partner_id));
    const now = Date.now();
    const STALE_MS = 48 * 60 * 60 * 1000;
    const active = ls.filter((l) => !TERMINAL.has(l.current_stage));
    const stale = active.filter((l) => now - new Date(l.updated_at).getTime() > STALE_MS);
    const sanctioned = ls.filter((l) => l.current_stage === "sanction_received").length;
    const disbursed = ls.filter((l) => l.current_stage === "disbursed").length;
    const rejected = ls.filter((l) => l.current_stage === "rejected").length;
    const sentDurations: number[] = [];
    for (const l of ls) {
      const sentAt = firstSentMap[l.id];
      if (sentAt) {
        const days = (new Date(sentAt).getTime() - new Date(l.created_at).getTime()) / 86400000;
        if (days >= 0) sentDurations.push(days);
      }
    }
    const avg = sentDurations.length
      ? sentDurations.reduce((a, b) => a + b, 0) / sentDurations.length
      : null;
    return {
      partners: partnerIds.map((id) => partnerById[id]).filter(Boolean),
      leads: ls,
      totalLeads: ls.length,
      activeLeads: active.length,
      staleLeads: stale,
      sanctioned, disbursed, rejected,
      rejectionRate: ls.length ? (rejected / ls.length) * 100 : 0,
      avgDaysToLender: avg,
    };
  };

  const adminRows = useMemo(() => {
    const rows = admins.map((a) => ({
      admin: a,
      metrics: computeMetrics(adminPartnersMap[a.id] ?? []),
    }));
    rows.sort((a, b) => {
      const aHas = a.metrics.partners.length > 0 ? 1 : 0;
      const bHas = b.metrics.partners.length > 0 ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas;
      if (aHas === 1) return b.metrics.totalLeads - a.metrics.totalLeads;
      return a.admin.full_name.localeCompare(b.admin.full_name);
    });
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admins, adminPartnersMap, leads, partnerById, firstSentMap]);

  const unassignedMetrics = useMemo(() => {
    const ids = partners.filter((p) => p.partner_code !== "PTR-DIRECT" && !assignedPartnerSet.has(p.id)).map((p) => p.id);
    return computeMetrics(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partners, assignedPartnerSet, leads, partnerById, firstSentMap]);

  const fmtAvg = (v: number | null) => v == null ? "—" : v.toFixed(1);
  const fmtPct = (v: number) => `${v.toFixed(1)}%`;

  return (
    <div className="space-y-6 max-w-screen-2xl mx-auto">
      <PageHeader
        title="Team Performance"
        description="Per-admin lead pipeline, throughput, and stale-lead visibility."
      >
        <Select value={range} onValueChange={(v: RangeKey) => setRange(v)}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="this_month">This month</SelectItem>
            <SelectItem value="last_3m">Last 3 months</SelectItem>
            <SelectItem value="last_6m">Last 6 months</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </PageHeader>

      {loading ? (
        <PageSkeleton variant="table" />
      ) : (
        <>
          {/* Overview cards */}
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {adminRows.map(({ admin, metrics }) => (
              <Card key={admin.id} className="p-4 flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <div className="rounded bg-primary/10 p-1.5">
                    <Users className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{admin.full_name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{admin.email}</p>
                  </div>
                  {admin.is_super_admin && (
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/30 text-[9px] px-1.5 py-0">SUPER</Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs mt-auto">
                  <Stat label="Partners" value={metrics.partners.length} />
                  <Stat label="Total leads" value={metrics.totalLeads} />
                  <Stat label="Active" value={metrics.activeLeads} />
                  <Stat label="Stale 48h+" value={metrics.staleLeads.length} amber={metrics.staleLeads.length > 0} />
                </div>
              </Card>
            ))}
            <Card className="p-4 flex flex-col border-amber-200 bg-amber-50/30">
              <div className="flex items-center gap-2 mb-3">
                <div className="rounded bg-amber-100 p-1.5">
                  <UserX className="h-3.5 w-3.5 text-amber-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">Unassigned</p>
                  <p className="text-[11px] text-muted-foreground truncate">No admin owner</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mt-auto">
                <Stat label="Partners" value={unassignedMetrics.partners.length} amber={unassignedMetrics.partners.length > 0} />
                <Stat label="Total leads" value={unassignedMetrics.totalLeads} />
                <Stat label="Active" value={unassignedMetrics.activeLeads} />
                <Stat label="Stale 48h+" value={unassignedMetrics.staleLeads.length} amber={unassignedMetrics.staleLeads.length > 0} />
              </div>
            </Card>
          </div>

          {/* Performance table */}
          <Card>
            <CardContent className="p-0">
              <div className="border-b px-4 py-3">
                <h2 className="text-sm font-semibold">Admin breakdown</h2>
                <p className="text-xs text-muted-foreground">Click a row to expand partner-level detail.</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead className="text-right">Partners</TableHead>
                    <TableHead className="text-right">Total Leads</TableHead>
                    <TableHead className="text-right">Stale (48h+)</TableHead>
                    <TableHead className="text-right">Avg Days to Lender</TableHead>
                    <TableHead className="text-right">Sanctioned</TableHead>
                    <TableHead className="text-right">Disbursed</TableHead>
                    <TableHead className="text-right">Rejected</TableHead>
                    <TableHead className="text-right">Rejection Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adminRows.map(({ admin, metrics }) => {
                    const open = !!expanded[admin.id];
                    return (
                      <Fragment key={admin.id}>
                        <TableRow className="cursor-pointer" onClick={() => setExpanded((s) => ({ ...s, [admin.id]: !s[admin.id] }))}>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium">{admin.full_name}</p>
                            <p className="text-[11px] text-muted-foreground">{admin.email}</p>
                          </TableCell>
                          <Num value={metrics.partners.length} />
                          <Num value={metrics.totalLeads} />
                          <Num value={metrics.staleLeads.length} amber={metrics.staleLeads.length > 0} />
                          <TableCell className="text-right tabular-nums">{fmtAvg(metrics.avgDaysToLender)}</TableCell>
                          <Num value={metrics.sanctioned} />
                          <Num value={metrics.disbursed} />
                          <Num value={metrics.rejected} />
                          <TableCell className="text-right tabular-nums">{metrics.totalLeads ? fmtPct(metrics.rejectionRate) : <span className="text-muted-foreground">—</span>}</TableCell>
                        </TableRow>
                        {open && (
                          <TableRow>
                            <TableCell colSpan={10} className="bg-muted/30 p-4">
                              <ExpandedDetail metrics={metrics} />
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                  <TableRow className="cursor-pointer bg-amber-50/30" onClick={() => setExpanded((s) => ({ ...s, __un: !s.__un }))}>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        {expanded.__un ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-amber-800">Unassigned</p>
                      <p className="text-[11px] text-muted-foreground">Partners without an admin owner</p>
                    </TableCell>
                    <Num value={unassignedMetrics.partners.length} amber={unassignedMetrics.partners.length > 0} />
                    <Num value={unassignedMetrics.totalLeads} />
                    <Num value={unassignedMetrics.staleLeads.length} amber={unassignedMetrics.staleLeads.length > 0} />
                    <TableCell className="text-right tabular-nums">{fmtAvg(unassignedMetrics.avgDaysToLender)}</TableCell>
                    <Num value={unassignedMetrics.sanctioned} />
                    <Num value={unassignedMetrics.disbursed} />
                    <Num value={unassignedMetrics.rejected} />
                    <TableCell className="text-right tabular-nums">{unassignedMetrics.totalLeads ? fmtPct(unassignedMetrics.rejectionRate) : <span className="text-muted-foreground">—</span>}</TableCell>
                  </TableRow>
                  {expanded.__un && (
                    <TableRow>
                      <TableCell colSpan={10} className="bg-muted/30 p-4">
                        <ExpandedDetail metrics={unassignedMetrics} />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, amber }: { label: string; value: number; amber?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${amber ? "text-amber-700" : value === 0 ? "text-muted-foreground" : "text-foreground"}`}>
        {value.toLocaleString("en-IN")}
      </p>
    </div>
  );
}

function Num({ value, amber }: { value: number; amber?: boolean }) {
  return (
    <TableCell className={`text-right tabular-nums ${amber ? "text-amber-700 font-medium" : value === 0 ? "text-muted-foreground" : ""}`}>
      {value.toLocaleString("en-IN")}
    </TableCell>
  );
}

function ExpandedDetail({ metrics }: { metrics: AdminMetrics }) {
  // Per-partner counts
  const perPartner = metrics.partners.map((p) => ({
    partner: p,
    count: metrics.leads.filter((l) => l.partner_id === p.id).length,
  }));

  // Mini funnel
  const funnel = [
    { label: "Submitted", value: metrics.leads.filter((l) => l.current_stage !== "draft").length },
    { label: "Documents", value: metrics.leads.filter((l) => ["documents_pending","documents_under_review","bre_evaluated"].includes(l.current_stage)).length },
    { label: "Sent to Lender", value: metrics.leads.filter((l) => ["sent_to_lender","login_submitted","credit_query"].includes(l.current_stage)).length },
    { label: "Sanctioned", value: metrics.sanctioned },
    { label: "Disbursed", value: metrics.disbursed },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div>
        <p className="text-xs font-semibold mb-2 uppercase tracking-wide text-muted-foreground">Partners ({perPartner.length})</p>
        {perPartner.length === 0 ? (
          <p className="text-xs text-muted-foreground">No partners assigned.</p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-auto pr-2">
            {perPartner.map(({ partner, count }) => (
              <div key={partner.id} className="flex items-center justify-between text-xs py-1 border-b border-border/40">
                <span className="truncate mr-2">{partner.display_name}</span>
                <span className="tabular-nums text-muted-foreground">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold mb-2 uppercase tracking-wide text-muted-foreground">Pipeline funnel</p>
        <div className="space-y-1.5">
          {funnel.map((f) => {
            const max = Math.max(...funnel.map((x) => x.value), 1);
            const pct = (f.value / max) * 100;
            return (
              <div key={f.label}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span>{f.label}</span>
                  <span className="tabular-nums font-medium">{f.value}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold mb-2 uppercase tracking-wide text-muted-foreground">
          Stale leads ({metrics.staleLeads.length})
        </p>
        {metrics.staleLeads.length === 0 ? (
          <p className="text-xs text-muted-foreground">No stale leads. ✓</p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-auto pr-2">
            {metrics.staleLeads.slice(0, 50).map((l) => (
              <div key={l.id} className="text-xs py-1 border-b border-border/40">
                <div className="flex justify-between gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">{l.lead_id ?? l.id.slice(0, 8)}</span>
                  <span className="text-amber-700 tabular-nums text-[10px]">
                    {formatDistanceToNowStrict(new Date(l.updated_at), { addSuffix: false })}
                  </span>
                </div>
                <p className="truncate">
                  {[l.student_first_name, l.student_last_name].filter(Boolean).join(" ") || "—"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
