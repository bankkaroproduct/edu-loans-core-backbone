import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import type { DuplicateLead } from "@/hooks/useDuplicateCheck";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onClose: () => void;
  onContinue: () => void;
  duplicates: DuplicateLead[];
  submitting: boolean;
}

export function DuplicateWarningDialog({ open, onClose, onContinue, duplicates, submitting }: Props) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-destructive">Possible Duplicate Found</DialogTitle>
          <DialogDescription>
            Review the existing lead(s) below before creating another record. Creating duplicates may cause operational issues.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-60 overflow-y-auto">
          {duplicates.map((d) => (
            <div key={d.id} className="border rounded-md p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{d.student_full_name || "—"}</span>
                <Badge variant="outline" className="text-xs">{d.lead_id || d.id.slice(0, 8)}</Badge>
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>Phone: {d.student_phone} · Email: {d.student_email || "—"}</p>
                <p>Stage: {d.current_stage.replace(/_/g, " ")} · Status: {d.current_status.replace(/_/g, " ")}</p>
                <p>Intake: {d.intake_term} {d.intake_year} · Created: {format(new Date(d.created_at), "dd MMM yyyy")}</p>
              </div>
              <Button size="sm" variant="link" className="h-auto p-0 text-xs" onClick={() => navigate(`/leads/${d.id}`)}>
                View Existing Lead →
              </Button>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>Go Back & Edit</Button>
          <Button variant="destructive" disabled={submitting} onClick={onContinue}>
            {submitting ? "Creating..." : "Continue Anyway"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
