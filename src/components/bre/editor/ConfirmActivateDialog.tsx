import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  newVersionLabel: string;
  currentActiveLabel: string | null;
  scope: "scoring" | "lender";
}

/** Confirms an activation. Always names the version that will be deactivated. */
export function ConfirmActivateDialog({ open, onOpenChange, onConfirm, newVersionLabel, currentActiveLabel, scope }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Activate {newVersionLabel}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will make <strong>{newVersionLabel}</strong> the active {scope === "scoring" ? "global scoring config" : "lender rule"}.
            {currentActiveLabel ? (
              <> It will deactivate <strong>{currentActiveLabel}</strong>.</>
            ) : (
              <> No version is currently active.</>
            )}
            {scope === "lender" && <> The lender's <code>bre_rule_id</code> pointer will be updated.</>}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Activate</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
