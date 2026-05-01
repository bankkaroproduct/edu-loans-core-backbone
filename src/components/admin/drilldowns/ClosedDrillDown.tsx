import { Link } from "react-router-dom";
import { ExternalLink, AlertCircle, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricDrillDrawer } from "./MetricDrillDrawer";
import { useDisbursedDrilldown } from "@/hooks/useAdminMetricDrilldowns";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  totalCount: number;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export function ClosedDrillDown({ open, onOpenChange, totalCount }: Props) {
  const { leads } = useDisbursedDrilldown(open);

  return (
    <MetricDrillDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Closed: Disbursed Leads"
      description="Leads that have reached the disbursed stage (lifetime). Rejected, dropped, and withdrawn leads are tracked separately and not included here."
      totalLabel="Lifetime"
      total={totalCount}
    >
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <BadgeCheck className="h-3.5 w-3.5" /> Most recent disbursed
          </h3>
          <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
            <Link to="/admin/leads?stage=disbursed">View all →</Link>
          </Button>
        </div>

        {leads.loading ? (
          <div className="space-y-2">{[0,1,2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : leads.error ? (
          <div className="text-xs text-destructive bg-destructive/10 rounded-lg p-3 flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5" /> {leads.error}
          </div>
        ) : leads.rows.length === 0 ? (
          <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 text-center">
            No disbursed leads yet
          </div>
        ) : (
          <div className="space-y-2">
            {leads.rows.map((l) => (
              <div key={l.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3 bg-card">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium truncate">
                    <span className="text-foreground truncate">{l.student_name}</span>
                    {l.lead_id && <span className="text-[11px] text-muted-foreground font-mono">{l.lead_id}</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 truncate capitalize">
                    {l.partner_name ? `${l.partner_name} · ` : ""}Disbursed · {fmtDate(l.updated_at)}
                  </div>
                </div>
                <Button asChild size="sm" variant="outline" className="h-7 text-xs shrink-0">
                  <Link to={`/admin/leads/${l.id}`}>Open <ExternalLink className="ml-1 h-3 w-3" /></Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </MetricDrillDrawer>
  );
}
