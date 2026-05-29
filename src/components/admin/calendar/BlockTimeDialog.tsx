import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useCreateCalendarEvent } from "@/hooks/useGoogleCalendar";
import { useToast } from "@/hooks/use-toast";

function defaultLocalIso(offsetMin: number) {
  const d = new Date(Date.now() + offsetMin * 60_000);
  d.setSeconds(0, 0);
  // YYYY-MM-DDTHH:mm for <input type="datetime-local">
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BlockTimeDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const create = useCreateCalendarEvent();
  const [summary, setSummary] = useState("Blocked");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState(() => defaultLocalIso(15));
  const [end, setEnd] = useState(() => defaultLocalIso(75));

  const submit = async () => {
    if (!summary.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      toast({ title: "Invalid date", variant: "destructive" });
      return;
    }
    if (endDate <= startDate) {
      toast({ title: "End must be after start", variant: "destructive" });
      return;
    }
    try {
      await create.mutateAsync({
        summary: summary.trim(),
        description: description.trim(),
        start_iso: startDate.toISOString(),
        end_iso: endDate.toISOString(),
      });
      toast({ title: "Time blocked on your calendar" });
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Could not create event",
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Block time</DialogTitle>
          <DialogDescription>
            Creates an event on your primary Google Calendar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="block-title">Title</Label>
            <Input
              id="block-title"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="block-start">Start</Label>
              <Input
                id="block-start"
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="block-end">End</Label>
              <Input
                id="block-end"
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="block-desc">Notes (optional)</Label>
            <Textarea
              id="block-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Block time
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
