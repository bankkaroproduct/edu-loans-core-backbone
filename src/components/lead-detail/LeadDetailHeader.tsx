import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { StageBadge, StatusBadge, formatStageLabel } from "@/components/dashboard/StageBadge";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Copy, Edit, FileText, Play } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"student_leads">;

const ATTENTION_STAGES = ["documents_pending", "on_hold", "credit_query"];
const ATTENTION_STATUSES = ["pending_info", "reupload_needed", "query_raised"];

function getOriginLabel(lead: Lead) {
  if (lead.source_sub_type === "bulk_upload") return "Bulk Upload";
  if (lead.source_sub_type === "quick_lead") return "Quick Lead";
  if (lead.source_sub_type === "add_lead") return "Add Lead";
  return "Manual";
}

interface Props {
  lead: Lead;
  submittedByName: string | null;
  isDraft: boolean;
  backTo?: string;
  backLabel?: string;
  hideActions?: boolean;
}

export function LeadDetailHeader({ lead, submittedByName, isDraft, backTo = "/leads", backLabel = "Back to Submitted Leads", hideActions = false }: Props) {
  const navigate = useNavigate();
  const needsAttention = ATTENTION_STAGES.includes(lead.current_stage) || ATTENTION_STATUSES.includes(lead.current_status) || lead.duplicate_flag;

  const copyLeadId = () => {
    if (lead.lead_id) {
      navigator.clipboard.writeText(lead.lead_id);
      toast.success(`Lead ID ${lead.lead_id} copied`);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(backTo)} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground">{backLabel}</span>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground break-words">
              {lead.student_full_name ?? `${lead.student_first_name} ${lead.student_last_name ?? ""}`.trim()}
            </h1>
            {lead.lead_id && (
              <Badge
                variant="outline"
                className="group font-mono text-xs cursor-pointer hover:bg-muted transition-colors gap-1"
                onClick={copyLeadId}
                title="Copy Lead ID for support / escalations"
              >
                {lead.lead_id}
                <Copy className="h-3 w-3 opacity-60 group-hover:opacity-100 transition-opacity" />
              </Badge>
            )}
            {!lead.lead_id && <Badge variant="outline" className="text-xs">Draft</Badge>}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <StageBadge stage={lead.current_stage} />
            <StatusBadge status={lead.current_status} />
            {needsAttention && (
              <Badge variant="destructive" className="text-xs">Needs Attention</Badge>
            )}
            {lead.duplicate_flag && (
              <Badge variant="outline" className="text-xs border-orange-300 text-orange-700 bg-orange-50">Duplicate</Badge>
            )}
            <Badge variant="secondary" className="text-xs">{getOriginLabel(lead)}</Badge>
          </div>

          {/* Compact timestamp row directly under status badges (Reading A) */}
          <div className="flex items-center gap-x-3 gap-y-1 text-xs text-muted-foreground flex-wrap">
            <span>Submitted on: {new Date(lead.created_at).toLocaleString()}</span>
            <span aria-hidden>·</span>
            <span>Updated: {new Date(lead.updated_at).toLocaleString()}</span>
          </div>

          {submittedByName && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              <span>Submitted by: {submittedByName}</span>
            </div>
          )}
        </div>

        {!hideActions && (
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {isDraft ? (
              <Button size="sm" onClick={() => navigate(`/leads/new?draft=${lead.id}`)}>
                <Play className="h-4 w-4 mr-1" /> Resume Draft
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => navigate(`/leads/new?edit=${lead.id}`)}>
                <Edit className="h-4 w-4 mr-1" /> Edit Lead
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate(`/leads/${lead.id}/documents`)}>
              <FileText className="h-4 w-4 mr-1" /> Documents
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
