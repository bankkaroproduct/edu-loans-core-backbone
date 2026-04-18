import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Edit, FileText, Info, Play } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"student_leads">;

const GUIDANCE_MAP: Record<string, string> = {
  draft: "This lead is saved as a draft. Resume it to complete and submit.",
  pending_info: "Add missing details to move this lead forward.",
  documents_pending: "Documents are pending from your side. Upload required documents.",
  reupload_needed: "Re-upload the rejected document to continue review.",
  awaiting_verification: "This lead is under verification. No action required right now.",
  on_hold: "This lead is on hold pending clarification.",
  query_raised: "A query has been raised. Please provide clarification.",
  in_progress: "This lead is being processed. You'll be notified of updates.",
  new: "This lead has been received and will be reviewed shortly.",
  verified: "Lead details verified. Processing continues.",
  under_assessment: "Lead is under assessment. No action required.",
  approved: "This lead has been approved!",
  conditionally_approved: "Lead is conditionally approved. Final steps pending.",
  completed: "Processing for this lead is complete.",
  declined: "This lead was declined.",
  withdrawn: "This lead has been withdrawn.",
};

interface Props {
  lead: Lead;
}

export function LeadActionPanel({ lead }: Props) {
  const navigate = useNavigate();
  const isDraft = lead.current_stage === "draft";
  const guidance = isDraft
    ? GUIDANCE_MAP.draft
    : GUIDANCE_MAP[lead.current_status] ?? "Monitor this lead for updates.";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ArrowRight className="h-4 w-4 text-primary" /> Next Steps
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">{guidance}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {isDraft && (
            <Button size="sm" onClick={() => navigate(`/leads/new?draft=${lead.id}`)}>
              <Play className="h-4 w-4 mr-1" /> Resume Draft
            </Button>
          )}
          {!isDraft && lead.current_stage === "submitted" && (
            <Button size="sm" variant="outline" onClick={() => navigate(`/leads/new?edit=${lead.id}`)}>
              <Edit className="h-4 w-4 mr-1" /> Edit Lead
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => navigate(`/leads/${lead.id}/documents`)}>
            <FileText className="h-4 w-4 mr-1" /> Manage Documents
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate("/leads")}>
            Back to Leads
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
