import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { MessageSquare, Send, Loader2, Lock, Eye } from "lucide-react";
import { toast } from "sonner";
import { addAdminLeadNote } from "@/lib/adminActions";
import type { Tables } from "@/integrations/supabase/types";

type Note = Tables<"lead_notes">;

interface Props {
  leadId: string;
  notes: Note[];
  onNoteAdded: () => void;
}

export function AdminInternalNotes({ leadId, notes, onNoteAdded }: Props) {
  const [text, setText] = useState("");
  const [type, setType] = useState<"internal" | "partner_visible">("internal");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    const res = await addAdminLeadNote({
      leadId,
      noteText: text.trim(),
      noteType: type,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error("Could not add note", { description: res.error });
      return;
    }
    toast.success(type === "internal" ? "Internal note added" : "Partner-visible note added");
    setText("");
    onNoteAdded();
  };

  const labelFor = (t: string) =>
    t === "system" ? "System" : t === "internal" ? "Internal" : "Partner Note";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" /> Admin Notes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <RadioGroup
            value={type}
            onValueChange={(v) => setType(v as "internal" | "partner_visible")}
            className="flex gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem id="t-internal" value="internal" />
              <Label htmlFor="t-internal" className="text-xs flex items-center gap-1 cursor-pointer">
                <Lock className="h-3 w-3" /> Internal (admin only)
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem id="t-partner" value="partner_visible" />
              <Label htmlFor="t-partner" className="text-xs flex items-center gap-1 cursor-pointer">
                <Eye className="h-3 w-3" /> Partner-visible
              </Label>
            </div>
          </RadioGroup>
          <div className="flex gap-2">
            <Textarea
              placeholder={type === "internal" ? "Internal note (not visible to partner)..." : "Note visible to partner..."}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              className="flex-1"
            />
            <Button size="icon" onClick={submit} disabled={busy || !text.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <Separator />

        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">No notes yet.</p>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {notes.map((n) => (
              <div
                key={n.id}
                className={`border rounded-md p-3 ${
                  n.note_type === "internal" ? "border-amber-300 bg-amber-50/40 dark:bg-amber-950/10" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Badge
                    variant={n.note_type === "internal" ? "secondary" : "outline"}
                    className="text-[10px]"
                  >
                    {n.note_type === "internal" && <Lock className="h-2.5 w-2.5 mr-1" />}
                    {labelFor(n.note_type)}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(n.created_at).toLocaleString()}
                  </span>
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
