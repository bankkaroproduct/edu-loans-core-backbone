import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { EDITABLE_FIELDS, computeDiff, diffToChanges } from "@/lib/editRequestFields";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"student_leads">;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  onSubmitted: () => void;
}

const GROUPS = ["Contact", "Profile", "Address", "Study", "Academic", "Co-applicant", "Collateral"] as const;

export function LeadEditRequestDialog({ open, onOpenChange, lead, onSubmitted }: Props) {
  const initial = useMemo(() => {
    const o: Record<string, unknown> = {};
    for (const f of EDITABLE_FIELDS) {
      const raw = (lead as unknown as Record<string, unknown>)[f.key];
      o[f.key] = raw ?? "";
    }
    return o;
  }, [lead]);

  const [values, setValues] = useState<Record<string, unknown>>(initial);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const diff = useMemo(() => computeDiff(initial, values), [initial, values]);
  const diffCount = Object.keys(diff).length;
  const reasonValid = reason.trim().length >= 10;

  const setField = (key: string, val: unknown) => setValues((v) => ({ ...v, [key]: val }));

  const handleSubmit = async () => {
    if (diffCount === 0) {
      toast.error("No changes detected. Edit at least one field to submit a request.");
      return;
    }
    if (!reasonValid) {
      toast.error("Please provide a reason of at least 10 characters.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("submit_edit_request", {
      _lead_id: lead.id,
      _changes: diffToChanges(diff) as never,
      _reason: reason.trim(),
    } as never);
    setSubmitting(false);
    if (error) {
      toast.error(error.message ?? "Failed to submit edit request");
      return;
    }
    toast.success("Your Lead Edit Request has been sent to admin. This will get updated once Admin approves your request.");
    setReason("");
    onSubmitted();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Request Edit</DialogTitle>
          <DialogDescription>
            Edit the fields you want changed and submit. Admin will review and apply approved fields.
            Editing first/last name will auto-update Full Name unless you also edit it.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {GROUPS.map((g) => {
              const fields = EDITABLE_FIELDS.filter((f) => f.group === g);
              return (
                <div key={g} className="space-y-2.5">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{g}</div>
                  <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                    {fields.map((f) => {
                      const v = values[f.key];
                      const isChanged = diff[f.key] !== undefined;
                      return (
                        <div key={f.key} className="space-y-1.5">
                          <Label className="text-xs flex items-center gap-1.5">
                            {isChanged && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" aria-hidden />}
                            <span className="truncate">{f.label}</span>
                            {isChanged && <Badge variant="secondary" className="h-4 px-1 text-[10px] shrink-0">edited</Badge>}
                          </Label>
                          {f.type === "textarea" ? (
                            <Textarea
                              value={(v as string) ?? ""}
                              onChange={(e) => setField(f.key, e.target.value)}
                              className="min-h-[60px] text-sm"
                            />
                          ) : f.type === "boolean" ? (
                            <div className="flex items-center gap-2 h-9">
                              <Switch
                                checked={Boolean(v)}
                                onCheckedChange={(checked) => setField(f.key, checked)}
                              />
                              <span className="text-xs text-muted-foreground">{v ? "Yes" : "No"}</span>
                            </div>
                          ) : f.type === "select" && f.options ? (
                            <Select value={(v as string) ?? ""} onValueChange={(val) => setField(f.key, val)}>
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                {f.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                              value={(v as string | number) ?? ""}
                              onChange={(e) => setField(f.key, f.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
                              className="h-9 text-sm"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
          <Label className="text-xs">Reason for edit (min 10 characters) <span className="text-destructive">*</span></Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this edit needed? e.g. student updated their phone number"
            className="min-h-[60px] text-sm bg-background"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{diffCount === 0 ? "No changes detected." : `${diffCount} field${diffCount > 1 ? "s" : ""} will be requested.`}</span>
            <span>{reason.trim().length}/10</span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || diffCount === 0 || !reasonValid}>
            {submitting ? "Submitting..." : "Submit request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
