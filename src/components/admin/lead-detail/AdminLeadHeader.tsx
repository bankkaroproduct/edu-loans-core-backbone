// Admin-only header. Mirrors the structure of LeadDetailHeader for the admin
// surface only — does not import or modify the shared partner-facing component.
// Logic-bearing children (StageBadge, StatusBadge) are reused unchanged.
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StageBadge, StatusBadge } from "@/components/dashboard/StageBadge";
import { ArrowLeft, Copy, Edit, FileText } from "lucide-react";
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
}

export function AdminLeadHeader({
  lead,
  submittedByName,
  isDraft,
  backTo = "/admin/leads",
  backLabel = "Back to Lead Queue",
}: Props) {
  const navigate = useNavigate();
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

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => navigate(backTo)}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {backLabel}
      </button>

      <div className="rounded-xl border border-border/60 bg-card px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[22px] font-semibold text-foreground leading-tight tracking-tight break-words">
                {lead.student_full_name ?? `${lead.student_first_name} ${lead.student_last_name ?? ""}`.trim()}
              </h1>
              {lead.lead_id ? (
                <button
                  type="button"
                  onClick={copyLeadId}
                  className="group inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-muted transition-colors"
                  title="Copy Lead ID"
                >
                  {lead.lead_id}
                  <Copy className="h-3 w-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                </button>
              ) : (
                <Badge variant="outline" className="text-[11px] py-0">Draft</Badge>
              )}
            </div>

            <div className="flex items-center gap-x-2 gap-y-1.5 flex-wrap">
              <StageBadge stage={lead.current_stage} />
              <StatusBadge status={lead.current_status} />
              {needsAttention && (
                <Badge variant="destructive" className="text-xs">Needs Attention</Badge>
              )}
              {lead.duplicate_flag && (
                <Badge variant="outline" className="text-xs border-orange-300 text-orange-700 bg-orange-50">
                  Duplicate
                </Badge>
              )}
              <span aria-hidden className="hidden sm:inline-block w-px h-4 bg-border mx-1" />
              <Badge variant="secondary" className="text-xs">{getOriginLabel(lead)}</Badge>
            </div>

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

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/admin/leads/${lead.id}/documents`)}
            >
              <FileText className="h-4 w-4 mr-1.5" /> Documents
            </Button>
            <Button size="sm" onClick={() => navigate(`/admin/leads/new?edit=${lead.id}`)}>
              <Edit className="h-4 w-4 mr-1.5" /> Edit Lead
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
