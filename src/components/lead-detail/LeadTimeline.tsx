import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatStageLabel, StageBadge, StatusBadge } from "@/components/dashboard/StageBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, ArrowRight, ShieldAlert, Pencil } from "lucide-react";
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
  // For audit chips
  actionType?: string;
}

const AUDIT_VISIBLE_LIMIT = 8;

function buildEvents(history: History[], notes: Note[], audits: AuditLog[], actorNameMap: Record<string, string>): { major: TimelineEvent[]; auditChips: TimelineEvent[] } {
  const major: TimelineEvent[] = [];
  const auditChips: TimelineEvent[] = [];

  for (const h of history) {
    const actorName = h.changed_by_user_id ? actorNameMap[h.changed_by_user_id] : null;
    const role = h.changed_by_role ? formatStageLabel(h.changed_by_role) : "System";
    major.push({
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
    major.push({
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
    // Stage/status changes already represented via lead_stage_history; skip duplicates.
    if (a.action_type === "stage_changed" || a.action_type === "status_changed") continue;

    const actorName = a.actor_user_id ? actorNameMap[a.actor_user_id] : null;
    const role = a.actor_role ? formatStageLabel(a.actor_role) : "System";
    const actor = actorName ? `${actorName} (${role})` : role;

    if (a.action_type === "lead_authenticity_changed") {
      const oldVal = (a.old_value as { lead_authenticity?: string } | null)?.lead_authenticity ?? null;
      const newVal = (a.new_value as { lead_authenticity?: string } | null)?.lead_authenticity ?? null;
      const reason = (a.meta as { reason?: string } | null)?.reason ?? null;
      major.push({
        id: `a-${a.id}`,
        type: "authenticity_change",
        timestamp: a.created_at,
        actor,
        description: reason || "",
        oldAuthenticity: oldVal,
        newAuthenticity: newVal,
        reason,
        actionType: a.action_type,
      });
      continue;
    }

    // Granular audit (admin_direct_edit, document_*, edit_request_*, etc.) → compact chip.
    auditChips.push({
      id: `a-${a.id}`,
      type: "audit",
      timestamp: a.created_at,
      actor,
      description: humanizeAuditAction(a.action_type, a.meta),
      actionType: a.action_type,
    });
  }

  major.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  auditChips.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return { major, auditChips };
}

function humanizeAuditAction(action: string, meta: unknown): string {
  const map: Record<string, string> = {
    admin_direct_edit: "Admin direct edit",
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

function shortLabel(actionType: string | undefined, description: string): string {
  if (!actionType) return description;
  const map: Record<string, string> = {
    admin_direct_edit: "Direct edit",
    document_verified: "Doc verified",
    document_rejected: "Doc rejected",
    document_reupload_requested: "Re-upload",
    internal_note_added: "Internal note",
    partner_note_added: "Partner note",
    edit_request_created: "Edit req",
    edit_request_created_review_only: "Review req",
    edit_request_applied: "Edit applied",
    edit_request_rejected: "Edit rejected",
    edit_request_acknowledged: "Edit ack",
  };
  return map[actionType] ?? description;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
}

interface Props {
  history: History[];
  notes: Note[];
  audits?: AuditLog[];
  actorNames?: Record<string, string>;
}

export function LeadTimeline({ history, notes, audits = [], actorNames = {} }: Props) {
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const { major, auditChips } = buildEvents(history, notes, audits, actorNames);

  const visibleChips = auditChips.slice(0, AUDIT_VISIBLE_LIMIT);
  const hasMoreChips = auditChips.length > AUDIT_VISIBLE_LIMIT;

  const hasAnything = major.length > 0 || auditChips.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" /> Lifecycle Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasAnything ? (
          <p className="text-sm text-muted-foreground text-center py-6">No lifecycle events recorded yet.</p>
        ) : (
          <div className="space-y-5">
            {/* Compact audit chips (granular edits / doc actions / edit-requests) */}
            {auditChips.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                    Recent changes ({auditChips.length})
                  </p>
                  {hasMoreChips && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => setAuditDialogOpen(true)}
                    >
                      View all {auditChips.length} changes
                    </Button>
                  )}
                </div>
                <TooltipProvider delayDuration={200}>
                  <div className="flex flex-wrap gap-1.5">
                    {visibleChips.map((evt) => (
                      <Tooltip key={evt.id}>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="secondary"
                            className="text-[11px] font-normal gap-1 cursor-default px-2 py-0.5"
                          >
                            <Pencil className="h-2.5 w-2.5 opacity-70" />
                            <span>{shortLabel(evt.actionType, evt.description)}</span>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground">{relativeTime(evt.timestamp)}</span>
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="space-y-0.5 text-xs">
                            <p className="font-medium">{evt.description}</p>
                            <p className="text-muted-foreground">{evt.actor}</p>
                            <p className="text-muted-foreground">{new Date(evt.timestamp).toLocaleString()}</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </TooltipProvider>
              </div>
            )}

            {/* Major lifecycle events (stage, status, authenticity, notes) — keep rich vertical layout */}
            {major.length > 0 && (
              <div className="space-y-0">
                {major.map((evt, idx) => {
                  const isAuth = evt.type === "authenticity_change";
                  return (
                    <div key={evt.id} className="relative pl-6 pb-6 last:pb-0">
                      {idx < major.length - 1 && (
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
          </div>
        )}
      </CardContent>

      {/* Full audit history dialog */}
      <Dialog open={auditDialogOpen} onOpenChange={setAuditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>All changes ({auditChips.length})</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-3">
              {auditChips.map((evt) => (
                <div key={evt.id} className="rounded border bg-muted/30 p-3 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-[10px]">
                      {shortLabel(evt.actionType, evt.description)}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{evt.actor}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {new Date(evt.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{evt.description}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
