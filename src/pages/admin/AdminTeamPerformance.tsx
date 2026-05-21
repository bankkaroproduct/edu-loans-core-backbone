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
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { cn } from "@/lib/utils";

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

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "this_month", label: "This Month" },
  { key: "last_3m", label: "Last 3 Months" },
  { key: "last_6m", label: "Last 6 Months" },
  { key: "all", label: "All Time" },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

type HeatTone = "neutral" | "good" | "warn" | "bad" | "info" | "zero";

function heatToneClass(tone: HeatTone): string {
  switch (tone) {
    case "good": return "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200/60";
    case "warn": return "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200/60";
    case "bad":  return "bg-rose-50 text-rose-800 ring-1 ring-inset ring-rose-200/60";
    case "info": return "bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-200/60";
    case "zero": return "bg-muted/40 text-muted-foreground";
    default:     return "text-foreground";
  }
}

function HeatCell({
  display,
  tone,
  align = "right",
}: { display: React.ReactNode; tone: HeatTone; align?: "right" | "center" }) {
  return (
    <TableCell className={align === "right" ? "text-right" : "text-center"}>
      <span
        className={cn(
          "inline-flex min-w-[3rem] items-center justify-center rounded-md px-2 py-1 text-xs font-medium tabular-nums",
          heatToneClass(tone),
        )}
      >
        {display}
      </span>
    </TableCell>
  );
}

function Avatar({ name, size = "md", muted }: { name: string; size?: "md" | "lg"; muted?: boolean }) {
  return (
    <div
      className={cn(
        "shrink-0 rounded-full flex items-center justify-center font-semibold",
        size === "lg" ? "h-12 w-12 text-base" : "h-9 w-9 text-xs",
        muted ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
      )}
    >
      {initials(name)}
    </div>
  );
}

export default function AdminTeamPerformance() {
  const [range, setRange] = useState<RangeKey>("this_month");
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [assignments, setAssignments] = useState<{ user_id: string; partner_id: string }[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [firstSentMap, setFirstSentMap] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

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

  const unassignedPartners = useMemo(
    () => partners.filter((p) => p.partner_code !== "PTR-DIRECT" && !assignedPartnerSet.has(p.id)),
    [partners, assignedPartnerSet],
  );

  const unassignedMetrics = useMemo(() => {
    return computeMetrics(unassignedPartners.map((p) => p.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unassignedPartners, leads, partnerById, firstSentMap]);

  // ---- Heat thresholds
  const staleTone = (n: number, empty: boolean): HeatTone => empty ? "zero" : n === 0 ? "good" : n <= 10 ? "warn" : "bad";
  const avgTone = (v: number | null, empty: boolean): HeatTone =>
    empty || v == null ? "zero" : v < 3 ? "good" : v <= 7 ? "warn" : "bad";
  const rejTone = (v: number, total: number, empty: boolean): HeatTone =>
    empty || total === 0 ? "zero" : v < 5 ? "good" : v <= 15 ? "warn" : "bad";
  const positive = (n: number, empty: boolean): HeatTone => empty || n === 0 ? "zero" : "good";
  const countTone = (n: number, empty: boolean): HeatTone => empty || n === 0 ? "zero" : "info";

  const fmtAvg = (v: number | null) => v == null ? "—" : v.toFixed(1);
  const fmtPct = (v: number) => `${v.toFixed(1)}%`;

  const toggleRow = (key: string) => setExpanded((cur) => (cur === key ? null : key));

  return (
    <div className="space-y-5 max-w-screen-2xl mx-auto">
      <PageHeader
        title="Team performance"
        description="Per-admin pipeline health, throughput, and stale-lead exposure."
      >
        <div className="inline-flex rounded-lg border bg-card p-0.5">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setRange(opt.key)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                range === opt.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </PageHeader>

      {/* Unassigned banner */}
      {!loading && (
        unassignedPartners.length > 0 ? (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3">
            <AlertTriangle className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
            <div className="text-sm">
              <span className="font-medium text-amber-900">
                {unassignedPartners.length} partner{unassignedPartners.length === 1 ? "" : "s"} unassigned
              </span>
              <span className="text-amber-800/80">
                {" "}— {unassignedMetrics.totalLeads} lead{unassignedMetrics.totalLeads === 1 ? "" : "s"} with no admin owner.
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200/60 bg-emerald-50/40 p-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
            <span className="text-sm text-emerald-900">All partners are assigned to an admin.</span>
          </div>
        )
      )}

      {loading ? (
        <PageSkeleton variant="table" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="border-b px-4 py-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Admin heatmap</h2>
                <p className="text-xs text-muted-foreground">Click a row to expand profile detail. Cell color reflects performance.</p>
              </div>
              <div className="hidden md:flex items-center gap-3 text-[10px] text-muted-foreground">
                <LegendDot tone="good" label="Healthy" />
                <LegendDot tone="warn" label="Watch" />
                <LegendDot tone="bad" label="At risk" />
                <LegendDot tone="zero" label="None" />
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead className="text-right">Partners</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Stale (48h+)</TableHead>
                  <TableHead className="text-right">Avg Days→Lender</TableHead>
                  <TableHead className="text-right">Sanctioned</TableHead>
                  <TableHead className="text-right">Rejected</TableHead>
                  <TableHead className="text-right">Rej. Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adminRows.map(({ admin, metrics }) => {
                  const open = expanded === admin.id;
                  const empty = metrics.partners.length === 0;
                  return (
                    <Fragment key={admin.id}>
                      <TableRow
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-muted/40",
                          open && "bg-muted/30",
                          empty && "opacity-70",
                        )}
                        onClick={() => toggleRow(admin.id)}
                      >
                        <TableCell>
                          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar name={admin.full_name} muted={empty} />
                            <div className="min-w-0">
                              <p className={cn("text-sm truncate", empty ? "font-normal text-muted-foreground" : "font-medium")}>
                                {admin.full_name}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate">{admin.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <HeatCell display={metrics.partners.length} tone={countTone(metrics.partners.length, false)} />
                        <HeatCell display={metrics.totalLeads} tone={countTone(metrics.totalLeads, empty)} />
                        <HeatCell display={metrics.staleLeads.length} tone={staleTone(metrics.staleLeads.length, empty)} />
                        <HeatCell display={fmtAvg(metrics.avgDaysToLender)} tone={avgTone(metrics.avgDaysToLender, empty)} />
                        <HeatCell display={metrics.sanctioned} tone={positive(metrics.sanctioned, empty)} />
                        <HeatCell display={metrics.rejected} tone={empty ? "zero" : metrics.rejected === 0 ? "zero" : "bad"} />
                        <HeatCell
                          display={empty || metrics.totalLeads === 0 ? "—" : fmtPct(metrics.rejectionRate)}
                          tone={rejTone(metrics.rejectionRate, metrics.totalLeads, empty)}
                        />
                      </TableRow>
                      {open && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={9} className="bg-muted/20 p-5 border-t">
                            <ExpandedDetail name={admin.full_name} email={admin.email} metrics={metrics} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}

                {/* Unassigned bucket */}
                {unassignedPartners.length > 0 && (
                  <Fragment>
                    <TableRow
                      className={cn(
                        "cursor-pointer bg-amber-50/30 hover:bg-amber-50/60 transition-colors",
                        expanded === "__un" && "bg-amber-50/70",
                      )}
                      onClick={() => toggleRow("__un")}
                    >
                      <TableCell>
                        {expanded === "__un" ? <ChevronDown className="h-4 w-4 text-amber-700" /> : <ChevronRight className="h-4 w-4 text-amber-700" />}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center">
                            <AlertTriangle className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-amber-900">Unassigned</p>
                            <p className="text-[11px] text-amber-800/70">Partners without an admin owner</p>
                          </div>
                        </div>
                      </TableCell>
                      <HeatCell display={unassignedMetrics.partners.length} tone="warn" />
                      <HeatCell display={unassignedMetrics.totalLeads} tone={countTone(unassignedMetrics.totalLeads, false)} />
                      <HeatCell display={unassignedMetrics.staleLeads.length} tone={staleTone(unassignedMetrics.staleLeads.length, false)} />
                      <HeatCell display={fmtAvg(unassignedMetrics.avgDaysToLender)} tone={avgTone(unassignedMetrics.avgDaysToLender, false)} />
                      <HeatCell display={unassignedMetrics.sanctioned} tone={positive(unassignedMetrics.sanctioned, false)} />
                      <HeatCell display={unassignedMetrics.rejected} tone={unassignedMetrics.rejected === 0 ? "zero" : "bad"} />
                      <HeatCell
                        display={unassignedMetrics.totalLeads ? fmtPct(unassignedMetrics.rejectionRate) : "—"}
                        tone={rejTone(unassignedMetrics.rejectionRate, unassignedMetrics.totalLeads, false)}
                      />
                    </TableRow>
                    {expanded === "__un" && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={9} className="bg-amber-50/20 p-5 border-t">
                          <ExpandedDetail name="Unassigned" email="Partners with no admin owner" metrics={unassignedMetrics} accent="amber" />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LegendDot({ tone, label }: { tone: HeatTone; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-sm", heatToneClass(tone))} />
      {label}
    </span>
  );
}

function ExpandedDetail({
  name, email, metrics, accent,
}: { name: string; email: string; metrics: AdminMetrics; accent?: "amber" }) {
  const perPartner = metrics.partners
    .map((p) => ({ partner: p, count: metrics.leads.filter((l) => l.partner_id === p.id).length }))
    .sort((a, b) => b.count - a.count);

  const submitted = metrics.leads.filter((l) => l.current_stage !== "draft").length;
  const sentToLender = metrics.leads.filter((l) =>
    ["sent_to_lender","login_submitted","credit_query","sanction_received","disbursed"].includes(l.current_stage),
  ).length;

  const funnel = [
    { label: "Submitted", value: submitted, color: "bg-sky-500" },
    { label: "Sent to Lender", value: sentToLender, color: "bg-indigo-500" },
    { label: "Sanctioned", value: metrics.sanctioned, color: "bg-amber-500" },
    { label: "Disbursed", value: metrics.disbursed, color: "bg-emerald-500" },
  ];
  const funnelMax = Math.max(...funnel.map((f) => f.value), 1);

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Left: profile */}
      <div className="lg:col-span-5">
        <div className="flex items-start gap-3 mb-4">
          <Avatar name={name} size="lg" muted={accent === "amber" || metrics.partners.length === 0} />
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold truncate">{name}</p>
            <p className="text-xs text-muted-foreground truncate">{email}</p>
            <Badge variant="outline" className="mt-2 text-[10px]">
              {metrics.partners.length} partner{metrics.partners.length === 1 ? "" : "s"}
            </Badge>
          </div>
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Assigned partners
        </p>
        {perPartner.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No partners assigned.</p>
        ) : (
          <div className="space-y-0.5 max-h-72 overflow-auto pr-2 rounded border bg-background">
            {perPartner.map(({ partner, count }) => (
              <div key={partner.id} className="flex items-center justify-between text-xs px-3 py-2 border-b last:border-b-0 hover:bg-muted/40">
                <span className="truncate mr-3">{partner.display_name}</span>
                <span className={cn("tabular-nums font-medium", count === 0 ? "text-muted-foreground" : "text-foreground")}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Center: funnel + grid */}
      <div className="lg:col-span-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Pipeline funnel
        </p>
        <div className="space-y-2 mb-5">
          {funnel.map((f) => {
            const pct = (f.value / funnelMax) * 100;
            return (
              <div key={f.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{f.label}</span>
                  <span className="tabular-nums font-medium">{f.value}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all", f.color)} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MiniStat label="Active" value={metrics.activeLeads} />
          <MiniStat label="Total leads" value={metrics.totalLeads} />
          <MiniStat label="Rejected" value={metrics.rejected} tone={metrics.rejected > 0 ? "bad" : "zero"} />
          <MiniStat label="Rej. rate" value={metrics.totalLeads ? `${metrics.rejectionRate.toFixed(1)}%` : "—"} />
        </div>
      </div>

      {/* Right: stale */}
      <div className="lg:col-span-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Stale leads
        </p>
        <div className={cn(
          "rounded-md border p-3 mb-2",
          metrics.staleLeads.length === 0 ? "border-emerald-200 bg-emerald-50/40" : "border-amber-200 bg-amber-50/40",
        )}>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-semibold tabular-nums">
              {metrics.staleLeads.length}
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">48h+ idle</span>
          </div>
        </div>
        {metrics.staleLeads.length === 0 ? (
          <p className="text-xs text-emerald-700 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> All caught up.
          </p>
        ) : (
          <div className="space-y-0.5 max-h-60 overflow-auto pr-2 rounded border bg-background">
            {metrics.staleLeads.slice(0, 50).map((l) => (
              <div key={l.id} className="text-xs px-3 py-2 border-b last:border-b-0 hover:bg-muted/40">
                <div className="flex justify-between gap-2 mb-0.5">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {l.lead_id ?? l.id.slice(0, 8)}
                  </span>
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

function MiniStat({ label, value, tone = "neutral" }: { label: string; value: number | string; tone?: "neutral" | "bad" | "zero" }) {
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn(
        "text-base font-semibold tabular-nums",
        tone === "bad" && "text-rose-700",
        tone === "zero" && "text-muted-foreground font-normal",
      )}>
        {typeof value === "number" ? value.toLocaleString("en-IN") : value}
      </p>
    </div>
  );
}
