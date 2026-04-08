import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  open: boolean;
  leadId: string | null;
  studentName: string;
  isDraft: boolean;
  onClose: () => void;
}

export function LeadSuccessDialog({ open, leadId, studentName, isDraft, onClose }: Props) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2">
            <CheckCircle className="h-12 w-12 text-green-500" />
          </div>
          <DialogTitle className="text-center">
            {isDraft ? "Draft Saved" : "Lead Submitted Successfully"}
          </DialogTitle>
          <DialogDescription className="text-center space-y-1">
            <p><strong>{studentName}</strong></p>
            {leadId && <p className="text-xs text-muted-foreground">Lead ID will be assigned shortly</p>}
            <p className="text-sm">
              {isDraft
                ? "You can complete and submit this lead later from the Leads page."
                : "The lead is now in the review pipeline. You'll be notified of any updates."}
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button className="w-full" onClick={() => navigate("/leads")}>View Submitted Leads</Button>
          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1" onClick={() => navigate("/leads/new")}>Add Another Lead</Button>
            <Button variant="outline" className="flex-1" onClick={() => navigate("/")}>Dashboard</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
