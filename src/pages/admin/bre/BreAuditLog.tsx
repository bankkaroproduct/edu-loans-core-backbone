import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const BRE_ENTITY_TYPES = ["bre_scoring_config", "bre_lender_rule", "bre_simulation"] as const;
type BreEntityType = (typeof BRE_ENTITY_TYPES)[number];
type EntityFilter = "all" | BreEntityType;

interface AuditRow {
  id: string;
  created_at: string;
  entity_type: string;
  entity_id: string | null;
  action_type: string;
  actor_role: string | null;
  actor_user_id: string | null;
  meta: unknown;
}

export default function BreAuditLog() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<EntityFilter>("all");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, created_at, entity_type, entity_id, action_type, actor_role, actor_user_id, meta")
        .in("entity_type", [...BRE_ENTITY_TYPES])
        .order("created_at", { ascending: false })
        .limit(200);
      if (cancelled) return;
      if (error) {
        toast({ title: "Failed to load audit log", description: error.message, variant: "destructive" });
        setRows([]);
      } else {
        setRows((data ?? []) as AuditRow[]);
      }
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => r.entity_type === filter);
  }, [rows, filter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="BRE Audit Log"
        description="All audit events scoped to BRE entities only. Most recent 200 events."
        count={loading ? null : rows.length}
      />

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Filter entity:</span>
            <Select value={filter} onValueChange={(v) => setFilter(v as EntityFilter)}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All BRE entities</SelectItem>
                <SelectItem value="bre_scoring_config">Scoring config</SelectItem>
                <SelectItem value="bre_lender_rule">Lender rule</SelectItem>
                <SelectItem value="bre_simulation">Simulation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              No BRE audit events yet. Events will appear here once admins start editing scoring configs, lender rules, or running simulations (Phase 3+).
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Actor role</TableHead>
                    <TableHead>Entity ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[10px]">{r.entity_type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{r.action_type}</TableCell>
                      <TableCell className="text-xs">{r.actor_role ?? "—"}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{r.entity_id?.slice(0, 8) ?? "—"}…</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
