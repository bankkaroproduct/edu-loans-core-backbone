import { Link } from "react-router-dom";
import { ExternalLink, AlertCircle, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricDrillDrawer } from "./MetricDrillDrawer";
import { useActivePartnersDrilldown } from "@/hooks/useAdminMetricDrilldowns";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  totalCount: number;
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export function PartnersDrillDown({ open, onOpenChange, totalCount }: Props) {
  const { partners } = useActivePartnersDrilldown(open);

  return (
    <MetricDrillDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Active Partners"
      description="Partner organizations currently active on the platform."
      totalLabel="Active"
      total={totalCount}
    >
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Network className="h-3.5 w-3.5" /> Partner list
          </h3>
          <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
            <Link to="/admin/partners">View all →</Link>
          </Button>
        </div>

        {partners.loading ? (
          <div className="space-y-2">{[0,1,2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : partners.error ? (
          <div className="text-xs text-destructive bg-destructive/10 rounded-lg p-3 flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5" /> {partners.error}
          </div>
        ) : partners.rows.length === 0 ? (
          <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 text-center">
            No active partners
          </div>
        ) : (
          <div className="space-y-2">
            {partners.rows.map((p) => (
              <div key={p.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3 bg-card">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground truncate">{p.display_name}</span>
                    <span className="text-[11px] text-muted-foreground font-mono">{p.partner_code}</span>
                    <Badge variant="outline" className="h-5 text-[10px] capitalize">
                      {p.partner_type.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>Onboarded: {fmtDate(p.onboarding_date ?? p.created_at)}</span>
                    {typeof p.lead_count === "number" && (
                      <span>Leads: <span className="tabular-nums text-foreground/80">{p.lead_count}</span></span>
                    )}
                  </div>
                </div>
                <Button asChild size="sm" variant="outline" className="h-7 text-xs shrink-0">
                  <Link to="/admin/partners">Open <ExternalLink className="ml-1 h-3 w-3" /></Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </MetricDrillDrawer>
  );
}
