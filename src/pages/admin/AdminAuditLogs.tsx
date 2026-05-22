import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, ScrollText, ExternalLink } from "lucide-react";

type AuditLog = {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  actor_role: string | null;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  meta: Record<string, unknown> | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
};

type AdminOption = { id: string; full_name: string | null; email: string | null };

const PAGE_SIZE = 25;

const DATE_PRESETS = [
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "3m", label: "Last 3 Months" },
  { value: "custom", label: "Custom" },
] as const;

type DatePreset = (typeof DATE_PRESETS)[number]["value"];

function presetRange(preset: DatePreset): { from: Date | null; to: Date | null } {
  const now = new Date();
  if (preset === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return { from: d, to: now };
  }
  if (preset === "month") {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
  }
  if (preset === "3m") {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 3);
    return { from: d, to: now };
  }
  return { from: null, to: null };
}

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function initials(name: string | null | undefined, email: string | null | undefined) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

const ACTION_LABELS: Record<string, string> = {
  create: "Created",
  update: "Updated",
  delete: "Deleted",
  invite: "Invited",
  terminate: "Terminated",
  reactivate: "Reactivated",
  review: "Reviewed",
  decision: "Decision",
  approve: "Approved",
  reject: "Rejected",
  assign: "Assigned",
  unassign: "Unassigned",
  upload: "Uploaded",
  send: "Sent",
};

function actionLabel(action: string) {
  const key = action.toLowerCase();
  for (const k of Object.keys(ACTION_LABELS)) {
    if (key.includes(k)) return ACTION_LABELS[k];
  }
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function actionTone(action: string): string {
  const k = action.toLowerCase();
  if (/(create|invite|approve|reactivate|upload|send)/.test(k))
    return "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400";
  if (/(delete|terminate|reject)/.test(k))
    return "bg-destructive/10 text-destructive border-destructive/30";
  if (/(review|decision|assign|unassign)/.test(k))
    return "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400";
  if (/(update|edit|change)/.test(k))
    return "bg-primary/10 text-primary border-primary/30";
  return "bg-muted text-muted-foreground border-border";
}

function entityLink(entityType: string, entityId: string | null, meta: Record<string, unknown> | null) {
  if (!entityId) return null;
  if (entityType === "lead") return `/admin/leads/${entityId}`;
  return null;
}

function entityDisplayId(entityType: string, entityId: string | null, meta: Record<string, unknown> | null) {
  if (meta && typeof meta === "object") {
    const m = meta as Record<string, unknown>;
    if (typeof m.lead_code === "string") return m.lead_code;
    if (typeof m.code === "string") return m.code;
    if (typeof m.partner_code === "string") return m.partner_code;
    if (typeof m.batch_id === "string") return m.batch_id;
  }
  if (!entityId) return "—";
  return entityId.slice(0, 8);
}

function computeDiff(oldV: Record<string, unknown> | null, newV: Record<string, unknown> | null) {
  if (!oldV && !newV) return [];
  const keys = new Set([...Object.keys(oldV ?? {}), ...Object.keys(newV ?? {})]);
  const diff: { key: string; old: unknown; new: unknown }[] = [];
  for (const k of keys) {
    const a = oldV?.[k];
    const b = newV?.[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) diff.push({ key: k, old: a, new: b });
  }
  return diff;
}

function previewValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v.length > 40 ? v.slice(0, 40) + "…" : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  const s = JSON.stringify(v);
  return s.length > 40 ? s.slice(0, 40) + "…" : s;
}

function metaInline(meta: Record<string, unknown> | null): string {
  if (!meta) return "";
  const entries = Object.entries(meta).filter(([k]) => !["lead_code", "code", "partner_code", "batch_id"].includes(k));
  return entries
    .slice(0, 2)
    .map(([k, v]) => `${k}: ${previewValue(v)}`)
    .join(" · ");
}

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [admins, setAdmins] = useState<AdminOption[]>([]);
  const [actionTypes, setActionTypes] = useState<string[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);

  // Filters
  const [preset, setPreset] = useState<DatePreset>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [actorFilter, setActorFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Load admin list & distinct values
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase
        .from("users")
        .select("id, full_name, email, role, is_super_admin")
        .or("role.eq.admin,is_super_admin.eq.true")
        .order("full_name");
      setAdmins((u ?? []) as AdminOption[]);

      const { data: a } = await supabase
        .from("audit_logs")
        .select("action_type, entity_type")
        .limit(1000);
      const acts = new Set<string>();
      const ents = new Set<string>();
      (a ?? []).forEach((r: any) => {
        if (r.action_type) acts.add(r.action_type);
        if (r.entity_type) ents.add(r.entity_type);
      });
      setActionTypes(Array.from(acts).sort());
      setEntityTypes(Array.from(ents).sort());
    })();
  }, []);

  // Actor lookup map
  const actorMap = useMemo(() => {
    const m = new Map<string, AdminOption>();
    admins.forEach((a) => m.set(a.id, a));
    return m;
  }, [admins]);

  // Fetch logs
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      let from: Date | null = null;
      let to: Date | null = null;
      if (preset === "custom") {
        if (customFrom) from = new Date(customFrom);
        if (customTo) {
          to = new Date(customTo);
          to.setHours(23, 59, 59, 999);
        }
      } else {
        const r = presetRange(preset);
        from = r.from;
        to = r.to;
      }
      if (from) q = q.gte("created_at", from.toISOString());
      if (to) q = q.lte("created_at", to.toISOString());
      if (actorFilter !== "all") q = q.eq("actor_user_id", actorFilter);
      if (actionFilter !== "all") q = q.eq("action_type", actionFilter);
      if (entityFilter !== "all") q = q.eq("entity_type", entityFilter);

      q = q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      const { data, count } = await q;
      if (cancelled) return;
      let rows = (data ?? []) as AuditLog[];
      if (search.trim()) {
        const s = search.trim().toLowerCase();
        rows = rows.filter((r) => {
          const blob = JSON.stringify({ m: r.meta, o: r.old_value, n: r.new_value, e: r.entity_id }).toLowerCase();
          return blob.includes(s);
        });
      }
      setLogs(rows);
      setTotal(count ?? 0);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [preset, customFrom, customTo, actorFilter, actionFilter, entityFilter, page, search]);

  useEffect(() => {
    setPage(0);
  }, [preset, customFrom, customTo, actorFilter, actionFilter, entityFilter, search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const clearFilters = () => {
    setPreset("month");
    setCustomFrom("");
    setCustomTo("");
    setActorFilter("all");
    setActionFilter("all");
    setEntityFilter("all");
    setSearch("");
  };

  return (
    <div className="p-6 space-y-5 font-sans">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">Read-only audit trail of admin actions across the system.</p>
        </div>
        <Button variant="outline" size="sm" onClick={clearFilters}>
          Clear filters
        </Button>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {DATE_PRESETS.map((p) => (
              <Button
                key={p.value}
                size="sm"
                variant={preset === p.value ? "default" : "outline"}
                onClick={() => setPreset(p.value)}
                className="h-8 rounded-full"
              >
                {p.label}
              </Button>
            ))}
            {preset === "custom" && (
              <div className="flex items-center gap-2 ml-2">
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-8 w-[150px]"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-8 w-[150px]"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <Select value={actorFilter} onValueChange={setActorFilter}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Admin" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All admins</SelectItem>
                {admins.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.full_name || a.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {actionTypes.map((a) => (
                  <SelectItem key={a} value={a}>{actionLabel(a)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Entity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All entities</SelectItem>
                {entityTypes.map((e) => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Search in details…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {loading ? "Loading…" : `${total.toLocaleString()} log${total === 1 ? "" : "s"}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ScrollText className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">No logs found for the selected filters.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Timestamp</TableHead>
                  <TableHead className="w-[200px]">Admin</TableHead>
                  <TableHead className="w-[140px]">Action</TableHead>
                  <TableHead className="w-[200px]">Entity</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="w-[280px]">Changes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const actor = log.actor_user_id ? actorMap.get(log.actor_user_id) : null;
                  const actorName = actor?.full_name || actor?.email || "System";
                  const diff = computeDiff(log.old_value, log.new_value);
                  const link = entityLink(log.entity_type, log.entity_id, log.meta);
                  const isOpen = expanded === log.id;
                  return (
                    <>
                      <TableRow
                        key={log.id}
                        data-clickable="true"
                        onClick={() => setExpanded(isOpen ? null : log.id)}
                      >
                        <TableCell className="text-xs tabular-nums text-muted-foreground">
                          {formatTimestamp(log.created_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-7 w-7 rounded-full bg-primary/10 text-primary text-[11px] font-medium flex items-center justify-center shrink-0">
                              {initials(actor?.full_name, actor?.email)}
                            </div>
                            <span className="text-sm truncate">{actorName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${actionTone(log.action_type)} font-normal`}>
                            {actionLabel(log.action_type)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground capitalize">{log.entity_type.replace(/_/g, " ")}</span>
                            {link ? (
                              <Link
                                to={link}
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs tabular-nums text-primary hover:underline inline-flex items-center gap-1"
                              >
                                {entityDisplayId(log.entity_type, log.entity_id, log.meta)}
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            ) : (
                              <span className="text-xs tabular-nums text-foreground/80">
                                {entityDisplayId(log.entity_type, log.entity_id, log.meta)}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground truncate max-w-[280px]">
                          {metaInline(log.meta) || "—"}
                        </TableCell>
                        <TableCell>
                          {diff.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <div className="space-y-0.5">
                              {diff.slice(0, 2).map((d) => (
                                <div key={d.key} className="text-[11px] truncate">
                                  <span className="text-muted-foreground">{d.key}:</span>{" "}
                                  <span className="text-destructive line-through">{previewValue(d.old)}</span>{" "}
                                  <span className="text-emerald-600 dark:text-emerald-400">→ {previewValue(d.new)}</span>
                                </div>
                              ))}
                              {diff.length > 2 && (
                                <div className="text-[10px] text-muted-foreground">+{diff.length - 2} more</div>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow key={`${log.id}-detail`} className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={6} className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Meta</div>
                                <pre className="text-[11px] bg-background border rounded p-3 overflow-auto max-h-72 whitespace-pre-wrap">
{JSON.stringify(log.meta ?? {}, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
                                  Changes ({diff.length})
                                </div>
                                {diff.length === 0 ? (
                                  <div className="text-xs text-muted-foreground">No field-level changes recorded.</div>
                                ) : (
                                  <div className="space-y-1.5 max-h-72 overflow-auto">
                                    {diff.map((d) => (
                                      <div key={d.key} className="text-[11px] border rounded p-2 bg-background">
                                        <div className="font-medium mb-0.5">{d.key}</div>
                                        <div className="text-destructive line-through break-all">{previewValue(d.old)}</div>
                                        <div className="text-emerald-600 dark:text-emerald-400 break-all">{previewValue(d.new)}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground tabular-nums">
            Page {page + 1} of {totalPages}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
