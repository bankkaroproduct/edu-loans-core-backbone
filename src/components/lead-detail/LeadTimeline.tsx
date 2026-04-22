import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatStageLabel, StageBadge, StatusBadge } from "@/components/dashboard/StageBadge";
import { Badge } from "@/components/ui/badge";
import { Clock, ArrowRight, ShieldAlert } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type History = Tables<"lead_stage_history">;
type Note = Tables<"lead_notes">;
type AuditLog = Tables<"audit_logs">;

type EventType = "stage_change" | "note" | "system" | "authenticity_change" | "audit";

interface TimelineEvent {
  id: string;
  type: EventType;
  timestamp: string;
  actor: string;
  description: string;
  prevStage?: string | null;
  newStage?: string | null;
  prevStatus?: string | null;
  newStatus?: string | null;
  noteType?: string;
  noteText?: string;
  // Authenticity / generic audit
  oldAuthenticity?: string | null;
  newAuthenticity?: string | null;
  reason?: string | null;
}

function buildTimeline(history: History[], notes: Note[], audits: AuditLog[], actorNameMap: Record<string, string>): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const h of history) {
    const actorName = h.changed_by_user_id ? actorNameMap[h.changed_by_user_id] : null;
    const role = h.changed_by_role ? formatStageLabel(h.changed_by_role) : "System";
    events.push({
      id: `h-${h.id}`,
      type: "stage_change",
      timestamp: h.created_at,
      actor: actorName ? `${actorName} (${role})` : role,
      description: h.partner_visible_note || h.change_reason || "",
      prevStage: h.previous_stage,
      newStage: h.new_stage,
      prevStatus: h.previous_status,
      newStatus: h.new_status,
    });
  }

  for (const n of notes) {
    const actorName = n.created_by ? actorNameMap[n.created_by] : null;
    events.push({
      id: `n-${n.id}`,
      type: n.note_type === "system" ? "system" : "note",
      timestamp: n.created_at,
      actor: n.note_type === "system" ? "System" : (actorName || (n.note_type === "internal" ? "Admin" : "Partner")),
      description: "",
      noteType: n.note_type,
      noteText: n.note_text,
    });
  }

  for (const a of audits) {
    // Only surface the human-relevant audit actions in the timeline. Stage/status
    // changes are already represented via lead_stage_history, so skip those to
    // avoid duplicate rows.
    if (a.action_type === "stage_changed" || a.action_type === "status_changed") continue;

    const actorName = a.actor_user_id ? actorNameMap[a.actor_user_id] : null;
    const role = a.actor_role ? formatStageLabel(a.actor_role) : "System";
    const actor = actorName ? `${actorName} (${role})` : role;

    if (a.action_type === "lead_authenticity_changed") {
      const oldVal = (a.old_value as { lead_authenticity?: string } | null)?.lead_authenticity ?? null;
      const newVal = (a.new_value as { lead_authenticity?: string } | null)?.lead_authenticity ?? null;
      const reason = (a.meta as { reason?: string } | null)?.reason ?? null;
      events.push({
        id: `a-${a.id}`,
        type: "authenticity_change",
        timestamp: a.created_at,
        actor,
        description: reason || "",
        oldAuthenticity: oldVal,
        newAuthenticity: newVal,
        reason,
      });
      continue;
    }

    // Generic catch-all for other audited actions (e.g., document_verified, edit_request_applied)
    events.push({
      id: `a-${a.id}`,
      type: "audit",
      timestamp: a.created_at,
      actor,
      description: humanizeAuditAction(a.action_type, a.meta),
    });
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return events;
}

function humanizeAuditAction(action: string, meta: unknown): string {
  const map: Record<string, string> = {
    document_verified: "Document verified",
    document_rejected: "Document rejected",
    document_reupload_requested: "Re-upload requested",
    internal_note_added: "Internal note added",
    partner_note_added: "Partner-visible note added",
    edit_request_created: "Edit request submitted",
    edit_request_created_review_only: "Review-only request submitted",
    edit_request_applied: "Edit request approved & applied",
    edit_request_rejected: "Edit request rejected",
    edit_request_acknowledged: "Edit request acknowledged",
  };
  const base = map[action] ?? action.replace(/_/g, " ");
  const reason = (meta as { reason?: string; remark?: string } | null)?.reason ?? (meta as { remark?: string } | null)?.remark;
  return reason ? `${base} — ${reason}` : base;
}

interface Props {
  history: History[];
  notes: Note[];
  audits?: AuditLog[];
  actorNames?: Record<string, string>;
}

export function LeadTimeline({ history, notes, audits = [], actorNames = {} }: Props) {
  const events = buildTimeline(history, notes, audits, actorNames);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" /> Lifecycle Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No lifecycle events recorded yet.</p>
        ) : (
          <div className="space-y-0">
            {events.map((evt, idx) => {
              const isAuth = evt.type === "authenticity_change";
              return (
                <div key={evt.id} className="relative pl-6 pb-6 last:pb-0">
                  {idx < events.length - 1 && (
                    <div className="absolute left-[7px] top-3 w-0.5 h-full bg-border" />
                  )}
                  <div className={`absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full border-2 bg-background ${isAuth ? "border-amber-500" : "border-primary"}`} />

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant={evt.noteType === "internal" || isAuth ? "secondary" : "outline"}
                        className={`text-[10px] ${isAuth ? "bg-amber-100 text-amber-800 border-amber-200" : ""}`}
                      >
                        {isAuth && <ShieldAlert className="h-3 w-3 mr-1 inline" />}
                        {evt.type === "stage_change"
                          ? "Stage Change"
                          : evt.type === "system"
                            ? "System"
                            : evt.type === "authenticity_change"
                              ? "Authenticity Changed"
                              : evt.type === "audit"
                                ? "Audit"
                                : evt.noteType === "internal"
                                  ? "Internal Note"
                                  : evt.noteType === "partner_visible"
                                    ? "Partner Note"
                                    : "Note"}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{evt.actor}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(evt.timestamp).toLocaleString()}
                      </span>
                    </div>

                    {evt.type === "stage_change" && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {evt.prevStage && <StageBadge stage={evt.prevStage} className="text-[10px]" />}
                        {evt.prevStage && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                        {evt.newStage && <StageBadge stage={evt.newStage} className="text-[10px]" />}
                        {evt.newStatus && <StatusBadge status={evt.newStatus} className="text-[10px]" />}
                      </div>
                    )}

                    {isAuth && (
                      <div className="flex items-center gap-1.5 flex-wrap text-xs">
                        <Badge variant="outline" className="text-[10px] capitalize">{evt.oldAuthenticity ?? "unverified"}</Badge>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <Badge variant="outline" className="text-[10px] capitalize bg-amber-50 border-amber-200 text-amber-800">{evt.newAuthenticity ?? "—"}</Badge>
                      </div>
                    )}

                    {evt.description && !isAuth && (
                      <p className="text-sm text-muted-foreground">{evt.description}</p>
                    )}

                    {isAuth && evt.reason && (
                      <p className="text-sm rounded p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
                        Reason: {evt.reason}
                      </p>
                    )}

                    {evt.noteText && (
                      <p className={`text-sm rounded p-2 ${
                        evt.noteType === "internal"
                          ? "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900"
                          : "bg-muted/50"
                      }`}>{evt.noteText}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
