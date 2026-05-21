import { useEffect, useState } from "react";
import { useReadOnly } from "@/components/admin/ReadOnlyContext";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Banknote, History, ScrollText, Calculator, FlaskConical, GitBranch, ListChecks, Layers, Activity } from "lucide-react";
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
  const { appUser } = useAuth();
  const perm = normalizeBrePermission(appUser?.bre_permission);
  const canEdit = canEditBre(appUser?.role, perm);
  const sectionReadOnly = useReadOnly(); const readOnly = sectionReadOnly || isReadOnlyBre(appUser?.role, perm);

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
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
          Phase 3 · Editing {readOnly ? "(read-only)" : "enabled"}
        </Badge>
      </PageHeader>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active scoring config"
          value={data ? (data.activeConfigVersion !== null ? `v${data.activeConfigVersion}` : "—") : undefined}
          sub={data ? `Bucket threshold: ${data.configBucketThreshold ?? "—"}` : undefined}
          icon={GitBranch}
          loading={loading}
        />
        <StatCard
          label="Active lender rules"
          value={data?.activeLenderRulesCount}
          sub={data ? `of ${data.totalLenderRulesCount} total rule rows` : undefined}
          icon={ListChecks}
          loading={loading}
        />
        <StatCard
          label="Config versions"
          value={data?.totalConfigVersions}
          sub="Across global scoring history"
          icon={Layers}
          loading={loading}
        />
        <StatCard
          label="BRE audit events"
          value={data?.recentBreAuditCount}
          sub="All-time, BRE entities only"
          icon={Activity}
          loading={loading}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <NavTile
          icon={<Calculator className="h-4 w-4" />}
          title={canEdit ? "Edit Scoring Config" : "Scoring Config"}
          desc={canEdit ? "Edit weights, bands & overall mapping" : "View active scoring configuration"}
          to="/admin/bre/scoring"
        />
        <NavTile icon={<Banknote className="h-4 w-4" />} title="Lender Rules" desc={canEdit ? "Open a lender to edit its rule" : "View active lender rule rows"} to="/admin/bre/lenders" />
        <NavTile icon={<FlaskConical className="h-4 w-4" />} title="Simulator" desc="Run a deterministic eligibility simulation" to="/admin/bre/simulate" />
        <NavTile icon={<History className="h-4 w-4" />} title="Version History" desc={canEdit ? "Browse & roll back to old versions" : "View scoring & rule version history"} to="/admin/bre/versions" />
        <NavTile icon={<ScrollText className="h-4 w-4" />} title="Audit Log" desc="Filtered BRE audit events" to="/admin/bre/audit" />
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
