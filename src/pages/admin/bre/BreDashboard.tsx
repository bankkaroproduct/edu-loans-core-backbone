import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Banknote, History, ScrollText, Calculator } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { canEditBre, normalizeBrePermission, isReadOnlyBre } from "@/lib/bre/permissions";

interface DashboardData {
  activeConfigVersion: number | null;
  configBucketThreshold: number | null;
  activeLenderRulesCount: number;
  totalLenderRulesCount: number;
  totalConfigVersions: number;
  recentBreAuditCount: number;
}

export default function BreDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [activeConfigRes, allConfigsRes, activeRulesRes, allRulesRes, auditRes] = await Promise.all([
        supabase
          .from("bre_scoring_configs")
          .select("version_number, bucket_threshold")
          .eq("is_active", true)
          .maybeSingle(),
        supabase.from("bre_scoring_configs").select("id", { count: "exact", head: true }),
        supabase
          .from("bre_lender_rules")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true),
        supabase.from("bre_lender_rules").select("id", { count: "exact", head: true }),
        supabase
          .from("audit_logs")
          .select("id", { count: "exact", head: true })
          .in("entity_type", ["bre_scoring_config", "bre_lender_rule", "bre_simulation"]),
      ]);

      if (cancelled) return;

      const errs = [activeConfigRes.error, allConfigsRes.error, activeRulesRes.error, allRulesRes.error, auditRes.error].filter(Boolean);
      if (errs.length) {
        toast({ title: "Failed to load BRE dashboard", description: errs[0]!.message, variant: "destructive" });
      }

      setData({
        activeConfigVersion: activeConfigRes.data?.version_number ?? null,
        configBucketThreshold: activeConfigRes.data?.bucket_threshold ?? null,
        activeLenderRulesCount: activeRulesRes.count ?? 0,
        totalLenderRulesCount: allRulesRes.count ?? 0,
        totalConfigVersions: allConfigsRes.count ?? 0,
        recentBreAuditCount: auditRes.count ?? 0,
      });
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="BRE Engine"
        description="Internal Business Rule Engine console — configure lender policies, scoring logic, and version history. Admin-only."
      >
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">Phase 2 · Read-only shells</Badge>
      </PageHeader>

      {loading || !data ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Active scoring config</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tabular-nums">
                {data.activeConfigVersion !== null ? `v${data.activeConfigVersion}` : "—"}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Bucket threshold: {data.configBucketThreshold ?? "—"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Active lender rules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tabular-nums">{data.activeLenderRulesCount}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                of {data.totalLenderRulesCount} total rule rows
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Config versions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tabular-nums">{data.totalConfigVersions}</div>
              <p className="mt-1 text-xs text-muted-foreground">Across global scoring history</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">BRE audit events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tabular-nums">{data.recentBreAuditCount}</div>
              <p className="mt-1 text-xs text-muted-foreground">All-time, BRE entities only</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <NavTile icon={<Banknote className="h-4 w-4" />} title="Lender Rules" desc="View seeded lender rule rows" to="/admin/bre/lenders" />
        <NavTile icon={<History className="h-4 w-4" />} title="Version History" desc="Active scoring & rule versions" to="/admin/bre/versions" />
        <NavTile icon={<ScrollText className="h-4 w-4" />} title="Audit Log" desc="Filtered BRE audit events" to="/admin/bre/audit" />
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Settings2 className="h-4 w-4 text-muted-foreground" /> Editor (Phase 3)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Lender rule editor, scoring editor and simulation runner are out of Phase 2 scope.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function NavTile({ icon, title, desc, to }: { icon: React.ReactNode; title: string; desc: string; to: string }) {
  return (
    <Card className="hover:border-primary/40 transition-colors">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">{icon} {title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{desc}</p>
        <Button asChild size="sm" variant="outline" className="w-full">
          <Link to={to}>Open</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
