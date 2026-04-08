import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatStageLabel, StageBadge, StatusBadge } from "@/components/dashboard/StageBadge";
import { Badge } from "@/components/ui/badge";
import { Clock, ArrowRight } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type History = Tables<"lead_stage_history">;
type Note = Tables<"lead_notes">;

interface TimelineEvent {
  id: string;
  type: "stage_change" | "note" | "system";
  timestamp: string;
  actor: string;
  description: string;
  prevStage?: string | null;
  newStage?: string | null;
  prevStatus?: string | null;
  newStatus?: string | null;
  noteType?: string;
  noteText?: string;
}

function buildTimeline(history: History[], notes: Note[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const h of history) {
    events.push({
      id: `h-${h.id}`,
      type: "stage_change",
      timestamp: h.created_at,
      actor: h.changed_by_role ? formatStageLabel(h.changed_by_role) : "System",
      description: h.partner_visible_note || h.change_reason || "",
      prevStage: h.previous_stage,
      newStage: h.new_stage,
      prevStatus: h.previous_status,
      newStatus: h.new_status,
    });
  }

  for (const n of notes) {
    events.push({
      id: `n-${n.id}`,
      type: n.note_type === "system" ? "system" : "note",
      timestamp: n.created_at,
      actor: n.note_type === "system" ? "System" : "Partner",
      description: "",
      noteType: n.note_type,
      noteText: n.note_text,
    });
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return events;
}

interface Props {
  history: History[];
  notes: Note[];
}

export function LeadTimeline({ history, notes }: Props) {
  const events = buildTimeline(history, notes);

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
            {events.map((evt, idx) => (
              <div key={evt.id} className="relative pl-6 pb-6 last:pb-0">
                {idx < events.length - 1 && (
                  <div className="absolute left-[7px] top-3 w-0.5 h-full bg-border" />
                )}
                <div className="absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full border-2 border-primary bg-background" />

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">
                      {evt.type === "stage_change" ? "Stage Change" : evt.type === "system" ? "System" : "Note"}
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

                  {evt.description && (
                    <p className="text-sm text-muted-foreground">{evt.description}</p>
                  )}

                  {evt.noteText && (
                    <p className="text-sm bg-muted/50 rounded p-2">{evt.noteText}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
