import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type EditRequest = Tables<"lead_edit_requests">;

interface Props {
  request: EditRequest | null;
}

export function LeadEditRequestBanner({ request }: Props) {
  if (!request) return null;

  if (request.status === "pending") {
    return (
      <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
        <Clock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="font-medium text-amber-900">
            Your Lead Edit Request has been sent to admin.
          </p>
          <p className="text-xs text-amber-800 mt-0.5">
            This will get updated once Admin approves your request. {Object.keys((request.requested_changes ?? {}) as Record<string, unknown>).length} field(s) requested.
          </p>
        </div>
        <Badge variant="outline" className="border-amber-400 text-amber-900 bg-amber-100">Pending</Badge>
      </div>
    );
  }

  if (request.status === "applied") {
    return (
      <div className="flex items-start gap-3 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="font-medium text-emerald-900">
            Last edit request approved and applied.
          </p>
          <p className="text-xs text-emerald-800 mt-0.5">
            {Object.keys((request.applied_changes ?? {}) as Record<string, unknown>).length} field(s) updated · {new Date(request.applied_at ?? request.decided_at ?? request.updated_at).toLocaleString()}
          </p>
        </div>
      </div>
    );
  }

  if (request.status === "rejected") {
    return (
      <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
        <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="font-medium text-destructive">Last edit request rejected.</p>
          {request.admin_decision_note && (
            <p className="text-xs text-muted-foreground mt-0.5">"{request.admin_decision_note}"</p>
          )}
        </div>
      </div>
    );
  }

  return null;
}
