import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  open: boolean;
  leadId: string | null;
  leadDisplayId: string | null;
  studentName: string;
  isDraft: boolean;
  onClose: () => void;
  /**
   * When true, all post-save navigation buttons route to the admin
   * surfaces (/admin/leads/<id>, /admin/leads, /admin/leads/new, /admin)
   * instead of the partner ones. This ensures admins land back on the
   * admin Lead Detail page after editing — which freshly fetches and
   * therefore reflects the just-saved values.
   */
  isAdminContext?: boolean;
}

export function LeadSuccessDialog({ open, leadId, leadDisplayId, studentName, isDraft, onClose, isAdminContext = false }: Props) {
  const navigate = useNavigate();

  const detailPath = (id: string) => (isAdminContext ? `/admin/leads/${id}` : `/leads/${id}`);
  const listPath = isAdminContext ? "/admin/leads" : "/leads";
  const newLeadPath = isAdminContext ? "/admin/leads/new" : "/leads/new";
  const dashboardPath = isAdminContext ? "/admin" : "/";

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
            {leadDisplayId ? (
              <p className="text-xs font-mono text-muted-foreground">Lead ID: {leadDisplayId}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Lead ID will be assigned shortly</p>
            )}
            <p className="text-sm">
              {isDraft
                ? "You can complete and submit this lead later from the Leads page."
                : "The lead is now in the review pipeline. You'll be notified of any updates."}
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {leadId && (
            <Button
              className="w-full"
              onClick={() => {
                const path = detailPath(leadId);
                if (isAdminContext) {
                  // Hard reload guarantees fresh fetch of just-saved values
                  // on the admin Lead Detail surface, regardless of any
                  // stale in-memory cache or router state.
                  window.location.href = path;
                } else {
                  navigate(path);
                }
              }}
            >
              Open Lead Detail
            </Button>
          )}
          <Button className="w-full" variant={leadId ? "outline" : "default"} onClick={() => navigate(listPath)}>
            View Submitted Leads
          </Button>
          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1" onClick={() => navigate(newLeadPath)}>Add Another Lead</Button>
            <Button variant="outline" className="flex-1" onClick={() => navigate(dashboardPath)}>Dashboard</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
