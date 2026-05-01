import { Link } from "react-router-dom";
import { ExternalLink, FileText, ClipboardList, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricDrillDrawer } from "./MetricDrillDrawer";
import { useActionNeededDrilldown } from "@/hooks/useAdminMetricDrilldowns";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  totalCount: number;
  requestsCount: number;
  documentsCount: number;
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

export function ActionNeededDrillDown({
  open, onOpenChange, totalCount, requestsCount, documentsCount,
}: Props) {
  const { requests, documents } = useActionNeededDrilldown(open);

  return (
    <MetricDrillDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Action Needed Today"
      description="Items waiting on admin attention: pending edit-request approvals and uploaded documents awaiting verification."
      totalLabel="Total"
      total={totalCount}
      chips={[
        { label: "Requests", value: requestsCount },
        { label: "Docs", value: documentsCount },
      ]}
    >
      {/* Requests section */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" /> Pending requests
          </h3>
          <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
            <Link to="/admin/requests">View all →</Link>
          </Button>
        </div>
        <RequestsList loading={requests.loading} error={requests.error} rows={requests.rows} />
      </section>

      {/* Documents section */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Documents awaiting review
          </h3>
        </div>
        <DocumentsList loading={documents.loading} error={documents.error} rows={documents.rows} />
      </section>
    </MetricDrillDrawer>
  );
}

function RequestsList({ loading, error, rows }: any) {
  if (loading) return <ListSkeleton />;
  if (error) return <ErrorBox msg={error} />;
  if (!rows.length) return <EmptyBox msg="No pending requests" />;
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
              {r.partner_name ? `${r.partner_name} · ` : ""}{fmtTime(r.created_at)}
            </div>
            {r.partner_reason && (
              <div className="text-[11px] text-foreground/70 mt-1 line-clamp-2">{r.partner_reason}</div>
            )}
          </div>
          <Button asChild size="sm" variant="outline" className="h-7 text-xs shrink-0">
            <Link to={`/admin/leads/${r.lead_uuid}`}>Open <ExternalLink className="ml-1 h-3 w-3" /></Link>
          </Button>
        </div>
      ))}
    </div>
  );
}

function DocumentsList({ loading, error, rows }: any) {
  if (loading) return <ListSkeleton />;
  if (error) return <ErrorBox msg={error} />;
  if (!rows.length) return <EmptyBox msg="No documents awaiting review" />;
  return (
    <div className="space-y-2">
      {rows.map((d: any) => (
        <div key={d.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3 bg-card">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm font-medium truncate">
              <span className="text-foreground truncate">{d.student_name}</span>
              {d.lead_id && <span className="text-[11px] text-muted-foreground font-mono">{d.lead_id}</span>}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {d.document_name} · {d.partner_name ? `${d.partner_name} · ` : ""}{fmtTime(d.uploaded_at)}
            </div>
          </div>
          <Button asChild size="sm" variant="outline" className="h-7 text-xs shrink-0">
            <Link to={`/admin/leads/${d.lead_uuid}/documents`}>Review <ExternalLink className="ml-1 h-3 w-3" /></Link>
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
