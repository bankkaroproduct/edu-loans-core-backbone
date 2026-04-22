import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (name: string) => Promise<void>;
}

export function SaveScenarioDialog({ open, onOpenChange, onConfirm }: Props) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onConfirm(name.trim());
      setName("");
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save simulation scenario</DialogTitle>
          <DialogDescription>
            Persists the profile input, the full result, and snapshots of the scoring config and lender rules used.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="scenario_name" className="text-xs">Scenario name (optional)</Label>
          <Input
            id="scenario_name"
            value={name}
            maxLength={80}
            placeholder="e.g. Strong STEM US, ₹50L"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={saving}>{saving ? "Saving…" : "Save scenario"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
