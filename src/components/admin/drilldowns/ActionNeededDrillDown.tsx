import { Link } from "react-router-dom";
import { ExternalLink, ClipboardList, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricDrillDrawer } from "./MetricDrillDrawer";
import { useActionNeededDrilldown } from "@/hooks/useAdminMetricDrilldowns";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  totalCount: number;
  reviewDueCount: number;
  followUpCount: number;
}

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const h = Math.floor(diffMs / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
};

const fmtStage = (s: string) => s.replace(/_/g, " ");

export function ActionNeededDrillDown({
  open, onOpenChange, totalCount, reviewDueCount, followUpCount,
}: Props) {
  const { reviewDue, followUp } = useActionNeededDrilldown(open);

  return (
    <MetricDrillDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Action Needed Today"
      description="Leads requiring admin attention — incomplete profiles (Review Due) and open leads not yet at a closed outcome (Follow-up Required)."
      totalLabel="Total"
      total={totalCount}
      chips={[
        { label: "Review Due", value: reviewDueCount },
        { label: "Follow-up Required", value: followUpCount },
      ]}
    >
      {/* Review Due */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" /> Review Due
            <span className="text-[10px] font-normal text-muted-foreground/70 normal-case tracking-normal">
              (&gt; 5 mandatory fields missing)
            </span>
          </h3>
        </div>
        <ReviewDueList loading={reviewDue.loading} error={reviewDue.error} rows={reviewDue.rows} />
      </section>

      {/* Follow-up Required */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Follow-up Required
            <span className="text-[10px] font-normal text-muted-foreground/70 normal-case tracking-normal">
              (open leads, oldest first)
            </span>
          </h3>
        </div>
        <FollowUpList loading={followUp.loading} error={followUp.error} rows={followUp.rows} />
      </section>
    </MetricDrillDrawer>
  );
}

function ReviewDueList({ loading, error, rows }: any) {
  if (loading) return <ListSkeleton />;
  if (error) return <ErrorBox msg={error} />;
  if (!rows.length) return <EmptyBox msg="No leads with > 5 missing mandatory fields" />;
  return (
    <div className="space-y-2">
      {rows.map((r: any) => (
        <div key={r.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3 bg-card">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm font-medium truncate">
              <span className="text-foreground truncate">{r.student_name}</span>
              {r.lead_id && <span className="text-[11px] text-muted-foreground font-mono">{r.lead_id}</span>}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {r.partner_name ? `${r.partner_name} · ` : ""}{fmtStage(r.current_stage)} · {fmtTime(r.updated_at)}
            </div>
            <div className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
              {r.missing_count} mandatory fields missing
            </div>
          </div>
          <Button asChild size="sm" variant="outline" className="h-7 text-xs shrink-0">
            <Link to={`/admin/leads/${r.lead_uuid}`}>Open <ExternalLink className="ml-1 h-3 w-3" /></Link>
          </Button>
        </div>
      ))}
    </div>
  );
}

function FollowUpList({ loading, error, rows }: any) {
  if (loading) return <ListSkeleton />;
  if (error) return <ErrorBox msg={error} />;
  if (!rows.length) return <EmptyBox msg="No open leads pending follow-up" />;
  return (
    <div className="space-y-2">
      {rows.map((r: any) => (
        <div key={r.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3 bg-card">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm font-medium truncate">
              <span className="text-foreground truncate">{r.student_name}</span>
              {r.lead_id && <span className="text-[11px] text-muted-foreground font-mono">{r.lead_id}</span>}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {r.partner_name ? `${r.partner_name} · ` : ""}{fmtStage(r.current_stage)} · {fmtStage(r.current_status)} · {fmtTime(r.updated_at)}
            </div>
          </div>
          <Button asChild size="sm" variant="outline" className="h-7 text-xs shrink-0">
            <Link to={`/admin/leads/${r.lead_uuid}`}>Open <ExternalLink className="ml-1 h-3 w-3" /></Link>
          </Button>
        </div>
      ))}
    </div>
  );
}

const ListSkeleton = () => (
  <div className="space-y-2">{[0,1,2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
);
const EmptyBox = ({ msg }: { msg: string }) => (
  <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 text-center">{msg}</div>
);
const ErrorBox = ({ msg }: { msg: string }) => (
  <div className="text-xs text-destructive bg-destructive/10 rounded-lg p-3 flex items-center gap-2">
    <AlertCircle className="h-3.5 w-3.5" /> {msg}
  </div>
);
