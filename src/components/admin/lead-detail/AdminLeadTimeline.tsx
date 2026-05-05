// Admin-only timeline (visual-only mirror of LeadTimeline). Same data inputs and
// same rendering of events; only chrome/spacing/typography differ.
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatStageLabel, StageBadge, StatusBadge } from "@/components/dashboard/StageBadge";
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
  oldAuthenticity?: string | null;
  newAuthenticity?: string | null;
  reason?: string | null;
  actionType?: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
}

const AUDIT_VISIBLE_LIMIT = 6;

function buildEvents(
  history: History[],
  notes: Note[],
  audits: AuditLog[],
  actorNameMap: Record<string, string>,
): { major: TimelineEvent[]; auditChips: TimelineEvent[] } {
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
      actor:
        n.note_type === "system"
          ? "System"
          : actorName || (n.note_type === "internal" ? "Admin" : "Partner"),
      description: "",
      noteType: n.note_type,
      noteText: n.note_text,
    });
  }

  for (const a of audits) {
    if (a.action_type === "stage_changed" || a.action_type === "status_changed") continue;

    const actorName = a.actor_user_id ? actorNameMap[a.actor_user_id] : null;
    const role = a.actor_role ? formatStageLabel(a.actor_role) : "System";
    const actor = actorName ? `${actorName} (${role})` : role;

    const oldVal = (a.old_value as Record<string, unknown> | null) ?? null;
    const newVal = (a.new_value as Record<string, unknown> | null) ?? null;
    const metaVal = (a.meta as Record<string, unknown> | null) ?? null;

    if (a.action_type === "lead_authenticity_changed") {
      const oldAuth = (oldVal as { lead_authenticity?: string } | null)?.lead_authenticity ?? null;
      const newAuth = (newVal as { lead_authenticity?: string } | null)?.lead_authenticity ?? null;
      const reason = (metaVal as { reason?: string } | null)?.reason ?? null;
      major.push({
        id: `a-${a.id}`,
        type: "authenticity_change",
        timestamp: a.created_at,
        actor,
        description: reason || "",
        oldAuthenticity: oldAuth,
        newAuthenticity: newAuth,
        reason,
        actionType: a.action_type,
        oldValue: oldVal,
        newValue: newVal,
        meta: metaVal,
      });
      continue;
    }

    auditChips.push({
      id: `a-${a.id}`,
      type: "audit",
      timestamp: a.created_at,
      actor,
      description: humanizeAuditAction(a.action_type, a.meta),
      actionType: a.action_type,
      oldValue: oldVal,
      newValue: newVal,
      meta: metaVal,
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
  const reason =
    (meta as { reason?: string; remark?: string } | null)?.reason ??
    (meta as { remark?: string } | null)?.remark;
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

// ---- Detail rendering helpers (display-only) ----
function formatFieldName(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isBlank(v: unknown): boolean {
  return v === null || v === undefined || v === "" ||
    (typeof v === "number" && Number.isNaN(v));
}

function formatValue(v: unknown): string {
  if (isBlank(v)) return "Not provided";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    const s = JSON.stringify(v);
    return s.length > 160 ? s.slice(0, 160) + "…" : s;
  } catch {
    return String(v);
  }
}

// Friendly labels for known nested keys inside test_scores JSON
const TEST_SCORES_NESTED_LABELS: Record<string, string> = {
  tenth_total: "10th Total Marks",
  twelfth_total: "12th Total Marks",
  graduation_total: "Graduation Total Marks / CGPA Scale",
  highest_qualification_total: "Highest Qualification Total Marks / CGPA Scale",
  highest_qualification_score: "Highest Qualification Score",
  raw_text: "Test Score Notes / Other Test Scores",
  ielts: "IELTS Score",
  toefl: "TOEFL Score",
  pte: "PTE Score",
  duolingo: "Duolingo Score",
  gre: "GRE Score",
  gmat: "GMAT Score",
  sat: "SAT Score",
};

// (KNOWN_NESTED_KEYS removed — unused)

function formatWorkExp(years: unknown, months: unknown): string {
  const yBlank = isBlank(years);
  const mBlank = isBlank(months);
  if (yBlank && mBlank) return "Not provided";
  const y = yBlank ? 0 : Number(years);
  const m = mBlank ? 0 : Number(months);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return "Not provided";
  if (y === 0 && m === 0) return "0 years";
  const parts: string[] = [];
  if (y > 0) parts.push(`${y} year${y === 1 ? "" : "s"}`);
  if (m > 0) parts.push(`${m} month${m === 1 ? "" : "s"}`);
  return parts.join(" ");
}

interface FieldDiff {
  field: string;
  oldVal: unknown;
  newVal: unknown;
  /** Optional pre-formatted display label (overrides formatFieldName) */
  label?: string;
  /** Optional pre-formatted display values (overrides formatValue) */
  oldDisplay?: string;
  newDisplay?: string;
}

function extractFieldDiffs(
  oldValue: Record<string, unknown> | null | undefined,
  newValue: Record<string, unknown> | null | undefined,
): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  const keys = new Set<string>([
    ...Object.keys(oldValue ?? {}),
    ...Object.keys(newValue ?? {}),
  ]);
  for (const k of keys) {
    const o = oldValue?.[k];
    const n = newValue?.[k];
    if (JSON.stringify(o) === JSON.stringify(n)) continue;

    // Expand test_scores JSONB into nested per-field diffs with friendly labels
    if (
      k === "test_scores" &&
      ((o && typeof o === "object") || (n && typeof n === "object"))
    ) {
      const oObj = (o && typeof o === "object" ? (o as Record<string, unknown>) : {}) ?? {};
      const nObj = (n && typeof n === "object" ? (n as Record<string, unknown>) : {}) ?? {};
      const nestedKeys = new Set<string>([...Object.keys(oObj), ...Object.keys(nObj)]);

      // Combined co-applicant work experience (years + months → single row)
      const hasWE =
        nestedKeys.has("coapplicant_work_experience_years") ||
        nestedKeys.has("coapplicant_work_experience_months");
      if (hasWE) {
        const oY = oObj.coapplicant_work_experience_years;
        const oM = oObj.coapplicant_work_experience_months;
        const nY = nObj.coapplicant_work_experience_years;
        const nM = nObj.coapplicant_work_experience_months;
        const oldDisplay = formatWorkExp(oY, oM);
        const newDisplay = formatWorkExp(nY, nM);
        if (oldDisplay !== newDisplay) {
          diffs.push({
            field: "coapplicant_work_experience",
            oldVal: { oY, oM },
            newVal: { nY, nM },
            label: "Co-applicant Work Experience",
            oldDisplay,
            newDisplay,
          });
        }
        nestedKeys.delete("coapplicant_work_experience_years");
        nestedKeys.delete("coapplicant_work_experience_months");
      }

      // Known nested fields → friendly label, formatted values
      const unknownEntries: { key: string; oldV: unknown; newV: unknown }[] = [];
      for (const nk of nestedKeys) {
        const oV = oObj[nk];
        const nV = nObj[nk];
        if (JSON.stringify(oV) === JSON.stringify(nV)) continue;
        const friendly = TEST_SCORES_NESTED_LABELS[nk];
        if (friendly) {
          diffs.push({
            field: `test_scores.${nk}`,
            oldVal: oV,
            newVal: nV,
            label: friendly,
            oldDisplay: formatValue(oV),
            newDisplay: formatValue(nV),
          });
        } else {
          unknownEntries.push({ key: nk, oldV: oV, newV: nV });
        }
      }

      // Unknown keys: keep as a single raw JSON fallback row under "Test Scores"
      if (unknownEntries.length > 0) {
        const oldUnknown: Record<string, unknown> = {};
        const newUnknown: Record<string, unknown> = {};
        for (const u of unknownEntries) {
          oldUnknown[u.key] = u.oldV;
          newUnknown[u.key] = u.newV;
        }
        diffs.push({
          field: "test_scores",
          oldVal: oldUnknown,
          newVal: newUnknown,
        });
      }
      continue;
    }

    diffs.push({ field: k, oldVal: o, newVal: n });
  }
  return diffs;
}

function extractMetaHighlights(meta: Record<string, unknown> | null | undefined): {
  documentLabel: string | null;
  fileLabel: string | null;
  versionLabel: string | null;
  reason: string | null;
} {
  if (!meta) return { documentLabel: null, fileLabel: null, versionLabel: null, reason: null };
  const m = meta as Record<string, unknown>;
  const documentLabel =
    (m.document_name as string | undefined) ??
    (m.document_type as string | undefined) ??
    (m.document_code as string | undefined) ??
    null;
  const fileLabel =
    (m.file_name as string | undefined) ??
    (m.original_file_name as string | undefined) ??
    (m.filename as string | undefined) ??
    null;
  const versionRaw = m.version ?? m.file_version;
  const versionLabel =
    versionRaw !== undefined && versionRaw !== null ? `v${String(versionRaw)}` : null;
  const reason =
    (m.reason as string | undefined) ??
    (m.remark as string | undefined) ??
    (m.note as string | undefined) ??
    null;
  return { documentLabel, fileLabel, versionLabel, reason };
}

function ChangeDetailCard({ evt }: { evt: TimelineEvent }) {
  const label = humanizeAuditAction(evt.actionType ?? "", evt.meta).split(" — ")[0];
  const diffs = extractFieldDiffs(evt.oldValue, evt.newValue);
  const { documentLabel, fileLabel, versionLabel, reason } = extractMetaHighlights(evt.meta);
  const hasRich = diffs.length > 0 || documentLabel || fileLabel || versionLabel || reason;

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="secondary" className="text-[10px]">
          {label}
        </Badge>
        <span className="text-[11px] text-muted-foreground">{evt.actor}</span>
        <span className="text-[11px] text-muted-foreground ml-auto">
          {new Date(evt.timestamp).toLocaleString()}
        </span>
      </div>

      {(documentLabel || fileLabel || versionLabel) && (
        <div className="text-xs text-foreground/90 break-words">
          <span className="text-muted-foreground">Document: </span>
          {[documentLabel, fileLabel, versionLabel].filter(Boolean).join(" · ")}
        </div>
      )}

      {diffs.length > 0 && (
        <div className="space-y-1">
          {diffs.map((d) => (
            <div
              key={d.field}
              className="text-xs grid grid-cols-[auto,1fr] gap-x-2 items-start break-words"
            >
              <span className="text-muted-foreground whitespace-nowrap">
                {d.label ?? formatFieldName(d.field)}:
              </span>
              <span className="break-words">
                <span className="line-through text-muted-foreground/80">
                  {d.oldDisplay ?? formatValue(d.oldVal)}
                </span>
                <ArrowRight className="h-3 w-3 inline mx-1 text-muted-foreground" />
                <span className="text-foreground">{d.newDisplay ?? formatValue(d.newVal)}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {reason && (
        <div className="text-xs rounded p-1.5 bg-muted/60 border border-border/60 break-words whitespace-pre-wrap">
          <span className="text-muted-foreground">Reason: </span>
          {reason}
        </div>
      )}

      {!hasRich && (
        <p className="text-xs text-muted-foreground break-words whitespace-pre-wrap">
          {evt.description}
        </p>
      )}
    </div>
  );
}

interface Props {
  history: History[];
  notes: Note[];
  audits?: AuditLog[];
  actorNames?: Record<string, string>;
}

export function AdminLeadTimeline({ history, notes, audits = [], actorNames = {} }: Props) {
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const { major, auditChips } = buildEvents(history, notes, audits, actorNames);

  const visibleChips = auditChips.slice(0, AUDIT_VISIBLE_LIMIT);
  const hasAnything = major.length > 0 || auditChips.length > 0;

  return (
    <Card className="rounded-xl border-border/60 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
            <Clock className="h-3.5 w-3.5 text-primary" />
          </span>
          Lifecycle Timeline
        </CardTitle>
        {major.length > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {major.length} {major.length === 1 ? "event" : "events"}
          </span>
        )}
      </CardHeader>
      <CardContent>
        {!hasAnything ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
            <Clock className="h-6 w-6 opacity-40" />
            <p className="text-sm">No lifecycle events recorded yet.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {auditChips.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-semibold">
                    Recent changes ({auditChips.length})
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => setAuditDialogOpen(true)}
                  >
                    View all {auditChips.length} {auditChips.length === 1 ? "change" : "changes"}
                  </Button>
                </div>
                <TooltipProvider delayDuration={200}>
                  <div className="flex flex-wrap gap-1.5">
                    {visibleChips.map((evt) => (
                      <Tooltip key={evt.id}>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="secondary"
                            className="text-[11px] font-normal gap-1 cursor-pointer px-2 py-0.5"
                            onClick={() => setAuditDialogOpen(true)}
                          >
                            <Pencil className="h-2.5 w-2.5 opacity-70" />
                            <span>{shortLabel(evt.actionType, evt.description)}</span>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground">{relativeTime(evt.timestamp)}</span>
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="space-y-0.5 text-xs">
                            <p className="font-medium break-words">{evt.description}</p>
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

            {major.length > 0 && (
              <div className="overflow-x-auto -mx-1 px-1 pb-1">
                <TooltipProvider delayDuration={200}>
                  <div className="relative flex items-start gap-3 pt-5 min-w-max">
                    {/* Single horizontal connector line behind dots */}
                    <div
                      aria-hidden
                      className="absolute left-3 right-3 top-[26px] h-px bg-border"
                    />
                    {major.map((evt) => {
                      const isAuth = evt.type === "authenticity_change";
                      const typeLabel =
                        evt.type === "stage_change"
                          ? "Stage Change"
                          : evt.type === "system"
                          ? "System"
                          : evt.type === "authenticity_change"
                          ? "Authenticity"
                          : evt.noteType === "internal"
                          ? "Internal Note"
                          : evt.noteType === "partner_visible"
                          ? "Partner Note"
                          : "Note";
                      const fullText =
                        evt.noteText ||
                        (isAuth ? evt.reason || "" : evt.description || "") ||
                        typeLabel;
                      return (
                        <div
                          key={evt.id}
                          className="relative flex flex-col items-center w-[280px] shrink-0"
                        >
                          {/* Dot */}
                          <span
                            className={`relative z-10 h-3 w-3 rounded-full border-2 bg-card ${
                              isAuth ? "border-amber-500" : "border-primary"
                            }`}
                          />
                          {/* Compact card */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={`mt-3 w-full rounded-md border bg-card p-2.5 min-w-0 cursor-default ${
                                  isAuth
                                    ? "border-l-2 border-l-amber-500 border-border/60"
                                    : "border-border/60"
                                }`}
                              >
                                <div className="space-y-1.5 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <Badge
                                      variant={evt.noteType === "internal" || isAuth ? "secondary" : "outline"}
                                      className={`text-[10px] ${
                                        isAuth ? "bg-amber-100 text-amber-800 border-amber-200" : ""
                                      }`}
                                    >
                                      {isAuth && <ShieldAlert className="h-3 w-3 mr-1 inline" />}
                                      {typeLabel}
                                    </Badge>
                                    <span
                                      className="text-[10px] text-muted-foreground ml-auto"
                                      title={new Date(evt.timestamp).toLocaleString()}
                                    >
                                      {relativeTime(evt.timestamp)}
                                    </span>
                                  </div>

                                  <p className="text-[11px] text-foreground/80 font-medium break-words">
                                    {evt.actor}
                                  </p>

                                  {evt.type === "stage_change" && (
                                    <div className="flex items-center gap-1 flex-wrap">
                                      {evt.prevStage && (
                                        <StageBadge stage={evt.prevStage} className="text-[10px]" />
                                      )}
                                      {evt.prevStage && (
                                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                      )}
                                      {evt.newStage && (
                                        <StageBadge stage={evt.newStage} className="text-[10px]" />
                                      )}
                                      {evt.newStatus && (
                                        <StatusBadge status={evt.newStatus} className="text-[10px]" />
                                      )}
                                    </div>
                                  )}

                                  {isAuth && (
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <Badge variant="outline" className="text-[10px] capitalize">
                                        {evt.oldAuthenticity ?? "unverified"}
                                      </Badge>
                                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] capitalize bg-amber-50 border-amber-200 text-amber-800"
                                      >
                                        {evt.newAuthenticity ?? "—"}
                                      </Badge>
                                    </div>
                                  )}

                                  {evt.description && !isAuth && (
                                    <p className="text-xs text-muted-foreground break-words line-clamp-4 whitespace-pre-wrap">
                                      {evt.description}
                                    </p>
                                  )}

                                  {isAuth && evt.reason && (
                                    <p className="text-xs rounded p-1.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 break-words line-clamp-4 whitespace-pre-wrap">
                                      Reason: {evt.reason}
                                    </p>
                                  )}

                                  {evt.noteText && (
                                    <p
                                      className={`text-xs rounded p-1.5 break-words line-clamp-4 whitespace-pre-wrap ${
                                        evt.noteType === "internal"
                                          ? "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900"
                                          : "bg-muted/50 border border-border/60"
                                      }`}
                                    >
                                      {evt.noteText}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-sm">
                              <div className="space-y-0.5 text-xs">
                                <p className="font-medium">{typeLabel}</p>
                                <p className="text-muted-foreground">{evt.actor}</p>
                                <p className="text-muted-foreground">
                                  {new Date(evt.timestamp).toLocaleString()}
                                </p>
                                {fullText && (
                                  <p className="whitespace-pre-wrap break-words">{fullText}</p>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      );
                    })}
                  </div>
                </TooltipProvider>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={auditDialogOpen} onOpenChange={setAuditDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>All changes ({auditChips.length})</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[75vh] pr-4">
            <div className="space-y-3">
              {auditChips.map((evt) => (
                <ChangeDetailCard key={evt.id} evt={evt} />
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
