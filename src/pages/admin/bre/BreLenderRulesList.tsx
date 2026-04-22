import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Pencil, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { canEditBre, normalizeBrePermission } from "@/lib/bre/permissions";

interface LenderRuleRow {
  id: string;
  lender_id: string;
  version_number: number;
  is_active: boolean;
  created_at: string;
  basic_info: { lender_name?: string; lender_code?: string; lender_type?: string; active_flag?: boolean } | null;
  loan_caps: { unsecured?: { min?: number | null; max?: number | null }; secured?: { min?: number | null; max?: number | null } } | null;
  coverage: { supported_countries?: string[] } | null;
  policy: { processing_time_days?: number | null } | null;
  hard_thresholds: { min_income?: number | null } | null;
}

export default function BreLenderRulesList() {
  const { appUser } = useAuth();
  const canEdit = canEditBre(appUser?.role, normalizeBrePermission(appUser?.bre_permission));

  const [rows, setRows] = useState<LenderRuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("bre_lender_rules")
        .select("id, lender_id, version_number, is_active, created_at, basic_info, loan_caps, coverage, policy, hard_thresholds")
        .eq("is_active", true);
      if (cancelled) return;
      if (error) {
        toast({ title: "Failed to load lender rules", description: error.message, variant: "destructive" });
        setRows([]);
      } else {
        const sorted = ((data ?? []) as unknown as LenderRuleRow[]).sort((a, b) =>
          (a.basic_info?.lender_name ?? "").localeCompare(b.basic_info?.lender_name ?? ""),
        );
        setRows(sorted);
      }
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      (r.basic_info?.lender_name ?? "").toLowerCase().includes(q) ||
      (r.basic_info?.lender_code ?? "").toLowerCase().includes(q) ||
      (r.basic_info?.lender_type ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="BRE Lender Rules"
        description="Active rule version per lender. Click Edit to view and create a new version."
      >
        <Badge variant="outline" className="bg-muted text-muted-foreground">{rows.length} active</Badge>
      </PageHeader>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search lender name, code, type…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              No lender rules match your search.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lender</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Loan range (₹)</TableHead>
                    <TableHead>Countries</TableHead>
                    <TableHead>TAT (days)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const min = r.loan_caps?.unsecured?.min ?? r.loan_caps?.secured?.min ?? null;
                    const max = r.loan_caps?.unsecured?.max ?? r.loan_caps?.secured?.max ?? null;
                    const countries = r.coverage?.supported_countries ?? [];
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium">{r.basic_info?.lender_name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground font-mono">{r.basic_info?.lender_code ?? "—"}</div>
                        </TableCell>
                        <TableCell className="text-sm">{r.basic_info?.lender_type ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">v{r.version_number}</Badge>
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {min !== null && max !== null
                            ? `${formatLakhs(min)} – ${formatLakhs(max)}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {countries.length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : countries.length <= 4 ? (
                            countries.join(", ")
                          ) : (
                            <span title={countries.join(", ")}>{countries.slice(0, 4).join(", ")} +{countries.length - 4}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">{r.policy?.processing_time_days ?? "—"}</TableCell>
                        <TableCell>
                          {r.basic_info?.active_flag === false ? (
                            <Badge variant="outline" className="bg-muted">Inactive</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300">Active</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" disabled title={canEdit ? "Editor ships in Phase 3" : "Read-only — Phase 3 will gate this by permission"}>
                            {canEdit ? <Pencil className="h-3.5 w-3.5 mr-1" /> : <Lock className="h-3.5 w-3.5 mr-1" />}
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatLakhs(n: number): string {
  if (n >= 10000000) return `${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(1)} L`;
  return n.toLocaleString("en-IN");
}
