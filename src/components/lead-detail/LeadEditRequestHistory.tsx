import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, History } from "lucide-react";
import { getFieldLabel } from "@/lib/editRequestFields";
import type { Tables } from "@/integrations/supabase/types";

type EditRequest = Tables<"lead_edit_requests">;

interface Props {
  requests: EditRequest[];
}

const STATUS_VARIANT: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-amber-100 text-amber-900 border-amber-300" },
  applied: { label: "Applied", cls: "bg-emerald-100 text-emerald-900 border-emerald-300" },
  rejected: { label: "Rejected", cls: "bg-destructive/10 text-destructive border-destructive/30" },
  cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground border-border" },
  approved: { label: "Approved", cls: "bg-emerald-100 text-emerald-900 border-emerald-300" },
};

function fmtVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

export function LeadEditRequestHistory({ requests }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (requests.length === 0) return null;

  const toggle = (id: string) => {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <History className="h-4 w-4" /> Edit Request History
          <Badge variant="outline" className="ml-1 text-xs">{requests.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {requests.map((r) => {
          const isOpen = expanded.has(r.id);
          const status = STATUS_VARIANT[r.status] ?? STATUS_VARIANT.pending;
          const changes = (r.requested_changes ?? {}) as Record<string, unknown>;
          const applied = (r.applied_changes ?? {}) as Record<string, unknown>;
          const keys = Object.keys(changes);
          return (
            <div key={r.id} className="border rounded-md">
              <button
                onClick={() => toggle(r.id)}
                className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-muted/40 transition-colors"
              >
                {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <span className="text-xs font-medium">{keys.length} field{keys.length !== 1 ? "s" : ""}</span>
                <Badge variant="outline" className={`text-[10px] ${status.cls}`}>{status.label}</Badge>
                <span className="text-xs text-muted-foreground ml-auto">{new Date(r.created_at).toLocaleString()}</span>
              </button>
              {isOpen && (
                <div className="px-3 pb-3 pt-1 space-y-2 text-xs border-t">
                  {r.partner_reason && (
                    <div>
                      <span className="text-muted-foreground">Reason: </span>
                      <span>{r.partner_reason}</span>
                    </div>
                  )}
                  <div className="space-y-1">
                    {keys.map((k) => {
                      const wasApplied = r.status === "applied" && k in applied;
                      return (
                        <div key={k} className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                          <span className="text-muted-foreground truncate">{getFieldLabel(k)}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className={wasApplied ? "text-emerald-700 font-medium" : r.status === "rejected" ? "line-through text-muted-foreground" : ""}>
                            {fmtVal(changes[k])}
                            {r.status === "applied" && !wasApplied && <span className="ml-1 text-[10px] text-muted-foreground">(not applied)</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {r.admin_decision_note && (
                    <div className="pt-1 border-t">
                      <span className="text-muted-foreground">Admin note: </span>
                      <span>{r.admin_decision_note}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
