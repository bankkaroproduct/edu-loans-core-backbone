import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { StageBadge, StatusBadge, formatStageLabel } from "@/components/dashboard/StageBadge";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Copy, Edit, FileText, Play, Pencil } from "lucide-react";
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
  backTo?: string;
  backLabel?: string;
  hideActions?: boolean;
  hasPendingEditRequest?: boolean;
  appliedEditCount?: number;
  onRequestEdit?: () => void;
}

export function LeadDetailHeader({ lead, submittedByName, isDraft, backTo = "/leads", backLabel = "Back to Submitted Leads", hideActions = false, hasPendingEditRequest = false, appliedEditCount = 0, onRequestEdit }: Props) {
  const navigate = useNavigate();
  const { isAdmin } = useRoleAccess();
  const isTerminal = TERMINAL_STAGES.includes(lead.current_stage);
  const needsAttention = ATTENTION_STAGES.includes(lead.current_stage) || ATTENTION_STATUSES.includes(lead.current_status) || lead.duplicate_flag;
  const editLimitReached = appliedEditCount >= 10;

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
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground break-words leading-tight">
              {lead.student_full_name ?? `${lead.student_first_name} ${lead.student_last_name ?? ""}`.trim()}
            </h1>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
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
          </div>

          <div className="flex items-center gap-x-2 gap-y-1.5 flex-wrap">
            {/* State group */}
            <StageBadge stage={lead.current_stage} />
            <StatusBadge status={lead.current_status} />
            {needsAttention && (
              <Badge variant="destructive" className="text-xs">Needs Attention</Badge>
            )}
            {lead.duplicate_flag && (
              <Badge variant="outline" className="text-xs border-orange-300 text-orange-700 bg-orange-50">Duplicate</Badge>
            )}
            {/* Separator between state and provenance groups */}
            <span aria-hidden className="hidden sm:inline-block w-px h-4 bg-border mx-1" />
            {/* Provenance group */}
            <Badge variant="secondary" className="text-xs">{getOriginLabel(lead)}</Badge>
          </div>

          {/* Single compact metadata line: Submitted · Updated · by Name */}
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
        </div>

        {!hideActions && (
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {isDraft ? (
              <Button size="sm" onClick={() => navigate(`/leads/new?draft=${lead.id}`)}>
                <Play className="h-4 w-4 mr-1" /> Resume Draft
              </Button>
            ) : isAdmin ? (
              <Button variant="outline" size="sm" onClick={() => navigate(`/leads/new?edit=${lead.id}`)}>
                <Edit className="h-4 w-4 mr-1" /> Edit Lead
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                {!isDraft && (
                  <span
                    className="text-[11px] text-muted-foreground tabular-nums"
                    title="Approved edits applied to this lead"
                  >
                    Edits used: {appliedEditCount}/10
                  </span>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onRequestEdit}
                        disabled={isTerminal || hasPendingEditRequest || editLimitReached || !onRequestEdit}
                      >
                        <Pencil className="h-4 w-4 mr-1" /> Request Edit
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {(isTerminal || hasPendingEditRequest || editLimitReached) && (
                    <TooltipContent>
                      {editLimitReached
                        ? "This lead has reached the maximum approved edit limit (10/10). Please contact admin for further changes."
                        : hasPendingEditRequest
                        ? "An edit request is already pending admin review."
                        : `Lead is in terminal stage (${lead.current_stage}) and cannot be edited.`}
                    </TooltipContent>
                  )}
                </Tooltip>
              </div>
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
