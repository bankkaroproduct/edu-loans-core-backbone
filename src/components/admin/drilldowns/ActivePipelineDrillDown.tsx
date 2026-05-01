import { Link } from "react-router-dom";
import { ExternalLink, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricDrillDrawer } from "./MetricDrillDrawer";
import { useActivePipelineDrilldown } from "@/hooks/useAdminMetricDrilldowns";
import type { PipelineStage } from "@/hooks/useAdminDashboard";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  totalCount: number;
  pipelineStages: PipelineStage[];
}

const fmtTime = (iso: string) => {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export function ActivePipelineDrillDown({
  open, onOpenChange, totalCount, pipelineStages,
}: Props) {
  const { recent } = useActivePipelineDrilldown(open);
  const stagesWithCounts = pipelineStages.filter((s) => s.count > 0);

  return (
    <MetricDrillDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Active Pipeline"
      description="All non-archived leads in the system, broken down by lifecycle stage."
      totalLabel="Total"
      total={totalCount}
    >
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Stage breakdown
        </h3>
        <div className="space-y-1.5 rounded-lg border border-border/60 bg-card p-2">
          {stagesWithCounts.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2 text-center">No active leads</div>
          ) : (
            stagesWithCounts.map((s) => (
              <div key={s.stage_key} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-md hover:bg-muted/50">
                <span className="text-foreground capitalize">{s.stage_label}</span>
                <span className="tabular-nums text-muted-foreground font-medium">
                  {s.count.toLocaleString("en-IN")}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent activity
          </h3>
          <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
            <Link to="/admin/leads">View all →</Link>
          </Button>
        </div>
        {recent.loading ? (
          <div className="space-y-2">{[0,1,2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : recent.error ? (
          <div className="text-xs text-destructive bg-destructive/10 rounded-lg p-3 flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5" /> {recent.error}
          </div>
        ) : recent.rows.length === 0 ? (
          <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 text-center">No leads</div>
        ) : (
          <div className="space-y-2">
            {recent.rows.map((l) => (
              <div key={l.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3 bg-card">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium truncate">
                    <span className="text-foreground truncate">{l.student_name}</span>
                    {l.lead_id && <span className="text-[11px] text-muted-foreground font-mono">{l.lead_id}</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 truncate capitalize">
                    {l.current_stage.replace(/_/g, " ")} · {l.current_status.replace(/_/g, " ")} · {fmtTime(l.updated_at)}
                    {l.partner_name ? ` · ${l.partner_name}` : ""}
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
