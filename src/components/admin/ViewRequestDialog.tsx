import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { getFieldLabel } from "@/lib/editRequestFields";
import type { Tables } from "@/integrations/supabase/types";

type EditRequest = Tables<"lead_edit_requests">;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  request: EditRequest | null;
  studentName?: string;
  leadDisplayId?: string;
  partnerName?: string;
  onOpenLead?: () => void;
}

function fmtVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

const STATUS_CLS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900 border-amber-300",
  applied: "bg-emerald-100 text-emerald-900 border-emerald-300",
  acknowledged: "bg-slate-100 text-slate-800 border-slate-300",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

function deriveStatusLabel(r: EditRequest): { key: string; label: string } {
  if (r.status === "applied") {
    const applied = (r.applied_changes ?? {}) as Record<string, unknown>;
    if (Object.keys(applied).length === 0) return { key: "acknowledged", label: "Acknowledged" };
    return { key: "applied", label: "Applied" };
  }
  return { key: r.status, label: r.status.charAt(0).toUpperCase() + r.status.slice(1) };
}

export function ViewRequestDialog({ open, onOpenChange, request, studentName, leadDisplayId, partnerName, onOpenLead }: Props) {
  if (!request) return null;
  const changes = (request.requested_changes ?? {}) as Record<string, unknown>;
  const applied = (request.applied_changes ?? {}) as Record<string, unknown>;
  const fields = Object.keys(changes);
  const isReviewOnly = fields.length === 0;
  const statusInfo = deriveStatusLabel(request);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Request details
            <Badge variant="outline" className={STATUS_CLS[statusInfo.key] ?? ""}>{statusInfo.label}</Badge>
            {isReviewOnly && <Badge variant="outline" className="text-[10px]">Review only</Badge>}
          </DialogTitle>
          <DialogDescription className="font-mono text-[10px] uppercase tracking-wide pt-1">
            {request.id.slice(0, 8)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Lead</p>
              <p className="font-medium">{studentName || "—"}</p>
              <p className="text-[10px] font-mono text-muted-foreground">{leadDisplayId || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Partner</p>
              <p className="font-medium">{partnerName || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Submitted</p>
              <p>{new Date(request.created_at).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Decided</p>
              <p>{request.decided_at ? new Date(request.decided_at).toLocaleString() : "—"}</p>
            </div>
          </div>

          {request.partner_reason && (
            <div className="border rounded-md p-3 bg-muted/30">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Partner reason</p>
              <p className="text-sm">{request.partner_reason}</p>
            </div>
          )}

          {isReviewOnly ? (
            <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
              Review-only request — no field changes were proposed.
            </div>
          ) : (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Requested changes ({fields.length})</p>
              <div className="border rounded-md divide-y">
                {fields.map((k) => {
                  const wasApplied = k in applied;
                  return (
                    <div key={k} className="px-3 py-2 text-xs grid grid-cols-[1fr_1.4fr_24px] gap-2 items-center">
                      <span className="font-medium truncate">{getFieldLabel(k)}</span>
                      <span className="text-emerald-700 truncate" title={fmtVal(changes[k])}>{fmtVal(changes[k])}</span>
                      {wasApplied && <Badge variant="outline" className="h-4 px-1 text-[9px] bg-emerald-50 text-emerald-800 border-emerald-200">✓</Badge>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {request.admin_decision_note && (
            <div className="border rounded-md p-3 bg-muted/30">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Admin decision note</p>
              <p className="text-sm">{request.admin_decision_note}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
          {onOpenLead && (
            <Button size="sm" onClick={onOpenLead}>
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open lead
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
