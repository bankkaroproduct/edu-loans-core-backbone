import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type EditRequest = Tables<"lead_edit_requests">;

interface Props {
  request: EditRequest | null;
}

export function LeadEditRequestBanner({ request }: Props) {
  if (!request) return null;

  const reqChanges = (request.requested_changes ?? {}) as Record<string, unknown>;
  const appChanges = (request.applied_changes ?? {}) as Record<string, unknown>;
  const isReviewOnly = Object.keys(reqChanges).length === 0;
  const isAcknowledged = request.status === "applied" && Object.keys(appChanges).length === 0;

  if (request.status === "pending") {
    return (
      <div className="flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm min-h-[60px]">
        <Clock className="h-4 w-4 text-amber-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-amber-900 leading-tight">
            Your Lead Edit Request has been sent to admin.
          </p>
          <p className="text-xs text-amber-800 mt-0.5">
            {isReviewOnly
              ? "Review-only request — no field changes proposed. Awaiting admin acknowledgement."
              : `This will get updated once Admin approves your request. ${Object.keys(reqChanges).length} field(s) requested.`}
          </p>
        </div>
        <Badge variant="outline" className="border-amber-400 text-amber-900 bg-amber-100 self-center shrink-0">Pending</Badge>
      </div>
    );
  }

  if (request.status === "applied") {
    return (
      <div className="flex items-center gap-3 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm min-h-[60px]">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-emerald-900 leading-tight">
            {isAcknowledged ? "Admin acknowledged your request." : "Last edit request approved and applied."}
          </p>
          <p className="text-xs text-emerald-800 mt-0.5">
            {isAcknowledged
              ? `No fields were modified · ${new Date(request.applied_at ?? request.decided_at ?? request.updated_at).toLocaleString()}`
              : `${Object.keys(appChanges).length} field(s) updated · ${new Date(request.applied_at ?? request.decided_at ?? request.updated_at).toLocaleString()}`}
          </p>
        </div>
      </div>
    );
  }

  if (request.status === "rejected") {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm min-h-[60px]">
        <XCircle className="h-4 w-4 text-destructive shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-destructive leading-tight">Last edit request rejected.</p>
          {request.admin_decision_note && (
            <p className="text-xs text-muted-foreground mt-0.5">"{request.admin_decision_note}"</p>
          )}
        </div>
      </div>
    );
  }

  return null;
}
