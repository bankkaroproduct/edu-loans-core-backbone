import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceVersionLabel: string;
  onConfirm: (changeSummary: string) => void;
  scope: "scoring" | "lender";
}

/**
 * Rollback always CLONES into a brand-new version.
 * Historical rows are never mutated. The new version is created INACTIVE —
 * activation is a separate explicit step.
 */
export function RollbackDialog({ open, onOpenChange, sourceVersionLabel, onConfirm, scope }: Props) {
  const [summary, setSummary] = useState("");

  const handleConfirm = () => {
    onConfirm(summary || `Rollback from ${sourceVersionLabel}`);
    setSummary("");
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setSummary(""); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Roll back from {sourceVersionLabel}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will <strong>clone</strong> {sourceVersionLabel} into a brand-new {scope === "scoring" ? "scoring config" : "lender rule"} version.
            The new version will be created <strong>inactive</strong>.
            You will need to explicitly activate it as a separate step.
            {sourceVersionLabel} itself will not be modified.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Change summary (optional)</Label>
          <Input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder={`Rollback from ${sourceVersionLabel}`}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>Clone as new version</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
