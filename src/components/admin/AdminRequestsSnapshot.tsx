import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminPendingRequests } from "@/hooks/useAdminPendingRequests";

export function AdminRequestsSnapshot() {
  const navigate = useNavigate();
  const { count, loading } = useAdminPendingRequests();

  return (
    <Card className="p-6 rounded-2xl border-border/60 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <ClipboardCheck className="h-3.5 w-3.5 text-primary" />
          </span>
          Requests &amp; Approvals
        </h3>
        {!loading && count > 0 && (
          <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold tabular-nums">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </div>

      {loading ? (
        <div className="mb-4 space-y-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-3 w-40" />
        </div>
      ) : (
        <div className="mb-4 rounded-lg border border-border/60 bg-muted/30 p-4">
          <p className="text-3xl font-semibold leading-none tabular-nums text-foreground">{count}</p>
          <p className="text-xs text-muted-foreground mt-1.5">
            {count === 0
              ? "No pending requests right now"
              : `Pending request${count !== 1 ? "s" : ""} awaiting admin action`}
          </p>
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        className="w-full justify-between border-border/70"
        onClick={() => navigate("/admin/requests")}
      >
        <span>View all requests</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </Card>
  );
}
