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
    <Card className="p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          Requests & Approvals
        </h3>
      </div>
      {loading ? (
        <Skeleton className="h-12 w-24 mb-3" />
      ) : (
        <div className="mb-3">
          <p className="text-3xl font-bold leading-none">{count}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {count === 0 ? "No pending requests" : `Pending request${count !== 1 ? "s" : ""} need admin action`}
          </p>
        </div>
      )}
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-between"
        onClick={() => navigate("/admin/requests")}
      >
        <span>View all requests</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </Card>
  );
}
