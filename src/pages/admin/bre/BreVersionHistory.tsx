import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDownToLine, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { canEditBre, normalizeBrePermission } from "@/lib/bre/permissions";
import { RollbackDialog } from "@/components/bre/editor/RollbackDialog";
import { rollbackScoringConfigToVersion, rollbackLenderRuleToVersion } from "@/lib/bre/versioning";

interface ConfigVersion {
  id: string;
  version_number: number;
  is_active: boolean;
  bucket_threshold: number;
  change_summary: string | null;
  created_at: string;
}

interface LenderRuleVersion {
  id: string;
  lender_id: string;
  version_number: number;
  is_active: boolean;
  change_summary: string | null;
  created_at: string;
  basic_info: { lender_name?: string; lender_code?: string } | null;
}

export default function BreVersionHistory() {
  const [configs, setConfigs] = useState<ConfigVersion[]>([]);
  const [rules, setRules] = useState<LenderRuleVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [c, r] = await Promise.all([
        supabase
          .from("bre_scoring_configs")
          .select("id, version_number, is_active, bucket_threshold, change_summary, created_at")
          .order("version_number", { ascending: false }),
        supabase
          .from("bre_lender_rules")
          .select("id, lender_id, version_number, is_active, change_summary, created_at, basic_info")
          .order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      if (c.error) toast({ title: "Failed to load config versions", description: c.error.message, variant: "destructive" });
      if (r.error) toast({ title: "Failed to load lender rule versions", description: r.error.message, variant: "destructive" });
      setConfigs((c.data ?? []) as ConfigVersion[]);
      const sortedRules = ((r.data ?? []) as unknown as LenderRuleVersion[]).sort((a, b) => {
        const an = a.basic_info?.lender_name ?? "";
        const bn = b.basic_info?.lender_name ?? "";
        if (an !== bn) return an.localeCompare(bn);
        return b.version_number - a.version_number;
      });
      setRules(sortedRules);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="BRE Version History"
        description="All scoring-config versions and per-lender rule versions. Rollback ships in a later phase."
      >
        <Badge variant="outline" className="bg-muted text-muted-foreground">Read-only shell</Badge>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Global scoring config versions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : configs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scoring config versions yet.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Bucket threshold</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Change summary</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell><Badge variant="secondary">v{c.version_number}</Badge></TableCell>
                      <TableCell>
                        {c.is_active ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted">Archived</Badge>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">{c.bucket_threshold}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-sm">{c.change_summary ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" disabled title="Rollback ships in a later phase">
                          <Lock className="h-3.5 w-3.5 mr-1" /> Rollback
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lender rule versions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lender rule versions yet.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lender</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Change summary</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">{r.basic_info?.lender_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground font-mono">{r.basic_info?.lender_code ?? "—"}</div>
                      </TableCell>
                      <TableCell><Badge variant="secondary">v{r.version_number}</Badge></TableCell>
                      <TableCell>
                        {r.is_active ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted">Archived</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-sm">{r.change_summary ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" disabled title="Rollback ships in a later phase">
                          <Lock className="h-3.5 w-3.5 mr-1" /> Rollback
                        </Button>
                      </TableCell>
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
