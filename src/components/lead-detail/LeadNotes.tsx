import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Note = Tables<"lead_notes">;

interface Props {
  leadId: string;
  notes: Note[];
  userId: string | null;
  onNoteAdded: () => void;
  /** When true, hides the composer regardless of userId. Default false. */
  readOnly?: boolean;
  /** "partner_visible" hides internal notes (default). "all" shows everything. */
  noteScope?: "partner_visible" | "all";
}

export function LeadNotes({ leadId, notes, userId, onNoteAdded, readOnly = false, noteScope = "partner_visible" }: Props) {
  const [newNote, setNewNote] = useState("");
  const [adding, setAdding] = useState(false);

  const addNote = async () => {
    if (!newNote.trim() || !userId) return;
    setAdding(true);
    const { error } = await supabase.from("lead_notes").insert({
      lead_id: leadId,
      note_text: newNote.trim(),
      note_type: "partner_visible",
      created_by: userId,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Note added");
      setNewNote("");
      onNoteAdded();
    }
    setAdding(false);
  };

  const visibleNotes = noteScope === "all"
    ? notes
    : notes.filter(n => n.note_type !== "internal");

  const showComposer = !readOnly && !!userId;

  const labelFor = (type: string) =>
    type === "system" ? "System" : type === "internal" ? "Internal" : type === "partner_visible" ? "Partner Note" : "Update";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" /> Notes & Updates
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {showComposer && (
          <>
            <div className="flex gap-2">
              <Textarea
                placeholder="Add a partner note..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="flex-1"
                rows={2}
              />
              <Button size="icon" onClick={addNote} disabled={adding || !newNote.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <Separator />
          </>
        )}

        {visibleNotes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {readOnly ? "No notes recorded for this lead yet." : "No notes yet. Add a note to keep track of updates."}
          </p>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {visibleNotes.map((n) => (
              <div key={n.id} className="border rounded-md p-3">
                <div className="flex items-center justify-between mb-1">
                  <Badge
                    variant={n.note_type === "internal" ? "secondary" : "outline"}
                    className="text-[10px]"
                  >
                    {labelFor(n.note_type)}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{n.note_text}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
