// Inline header content rendered inside the AppLayout top bar via HeaderSlotContext.
// Drops the standalone back button row and outer chrome from the legacy
// LeadDetailHeader — back navigation is now owned by AppLayout.
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { StageBadge, StatusBadge, formatStageLabel } from "@/components/dashboard/StageBadge";
import { Badge } from "@/components/ui/badge";
import { Copy, Edit, FileText, Play, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"student_leads">;
const TERMINAL_STAGES = ["disbursed", "rejected", "dropped"];
const ATTENTION_STAGES = ["documents_pending", "on_hold", "credit_query"];
const ATTENTION_STATUSES = ["pending_info", "reupload_needed", "query_raised"];

function getOriginLabel(lead: Lead) {
  if (lead.source_sub_type === "bulk_upload") return "Bulk Upload";
  if (lead.source_sub_type === "quick_lead") return "Quick Lead";
  if (lead.source_sub_type === "add_lead") return "Add Lead";
  return "Manual";
}

function formatRelative(dateStr: string): string {
  const then = new Date(dateStr).getTime();
  const now = Date.now();
  const diffSec = Math.round((now - then) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

interface Props {
  lead: Lead;
  submittedByName: string | null;
  isDraft: boolean;
  hasPendingEditRequest?: boolean;
  onRequestEdit?: () => void;
}

export function LeadDetailHeaderInline({
  lead,
  submittedByName,
  isDraft,
  hasPendingEditRequest = false,
  onRequestEdit,
}: Props) {
  const navigate = useNavigate();
  const { isAdmin } = useRoleAccess();
  const isTerminal = TERMINAL_STAGES.includes(lead.current_stage);
  const needsAttention =
    ATTENTION_STAGES.includes(lead.current_stage) ||
    ATTENTION_STATUSES.includes(lead.current_status) ||
    lead.duplicate_flag;

  const copyLeadId = () => {
    if (lead.lead_id) {
      navigator.clipboard.writeText(lead.lead_id);
      toast.success(`Lead ID ${lead.lead_id} copied`);
    }
  };

  const leadName =
    lead.student_full_name ?? `${lead.student_first_name} ${lead.student_last_name ?? ""}`.trim();

  return (
    <div className="flex-1 flex flex-col md:flex-row md:items-center gap-2 md:gap-3 min-w-0">
      {/* Row 1 on mobile / left cluster on md+: name + ID + badges */}
      <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
        <h1 className="text-base font-semibold text-foreground truncate leading-tight">{leadName}</h1>
        {lead.lead_id ? (
          <Badge
            variant="outline"
            className="group font-mono text-[11px] cursor-pointer hover:bg-muted transition-colors gap-1 py-0"
            onClick={copyLeadId}
            title="Copy Lead ID for support / escalations"
          >
            {lead.lead_id}
            <Copy className="h-3 w-3 opacity-60 group-hover:opacity-100 transition-opacity" />
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[11px] py-0">Draft</Badge>
        )}
        <StageBadge stage={lead.current_stage} />
        <StatusBadge status={lead.current_status} />
        
        {lead.duplicate_flag && (
          <Badge variant="outline" className="text-xs border-orange-300 text-orange-700 bg-orange-50">
            Duplicate
          </Badge>
        )}
        <Badge variant="secondary" className="text-xs">{getOriginLabel(lead)}</Badge>
      </div>

      {/* Row 2 on mobile / right cluster on md+: meta line + action buttons */}
      <div className="flex items-center gap-3 flex-wrap justify-end shrink-0">
        <div className="flex items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground flex-wrap">
          <span title={new Date(lead.created_at).toLocaleString()}>
            Submitted {formatShortDate(lead.created_at)}
          </span>
          <span aria-hidden>·</span>
          <span title={new Date(lead.updated_at).toLocaleString()}>
            Updated {formatRelative(lead.updated_at)}
          </span>
          {submittedByName && (
            <>
              <span aria-hidden>·</span>
              <span>by {submittedByName}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isDraft ? (
            <Button size="sm" onClick={() => navigate(`/leads/new?draft=${lead.id}`)}>
              <Play className="h-4 w-4 mr-1" /> Resume Draft
            </Button>
          ) : isAdmin ? (
            <Button variant="outline" size="sm" onClick={() => navigate(`/leads/new?edit=${lead.id}`)}>
              <Edit className="h-4 w-4 mr-1" /> Edit Lead
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRequestEdit}
                    disabled={isTerminal || hasPendingEditRequest || !onRequestEdit}
                  >
                    <Pencil className="h-4 w-4 mr-1" /> Request Edit
                  </Button>
                </span>
              </TooltipTrigger>
              {(isTerminal || hasPendingEditRequest) && (
                <TooltipContent>
                  {hasPendingEditRequest
                    ? "An edit request is already pending admin review."
                    : `Lead is in terminal stage (${formatStageLabel(lead.current_stage)}) and cannot be edited.`}
                </TooltipContent>
              )}
            </Tooltip>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate(`/leads/${lead.id}/documents`)}>
            <FileText className="h-4 w-4 mr-1" /> Documents
          </Button>
        </div>
      </div>
    </div>
  );
}
