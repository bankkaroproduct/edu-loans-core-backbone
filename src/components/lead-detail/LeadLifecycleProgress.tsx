import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StageBadge, StatusBadge, formatStageLabel } from "@/components/dashboard/StageBadge";
import { Activity, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"student_leads">;

const STAGE_ORDER = [
  "draft", "submitted", "under_initial_review", "documents_pending",
  "documents_under_review", "bre_evaluated", "sent_to_lender",
  "login_submitted", "credit_query", "sanction_received", "disbursed",
];

const TERMINAL_STAGES = ["rejected", "dropped", "on_hold"];

const PARTNER_ACTION_MAP: Record<string, string> = {
  pending_info: "Please provide the missing information to move this lead forward.",
  documents_pending: "Upload the required documents to continue processing.",
  reupload_needed: "Re-upload the rejected document with corrections.",
  query_raised: "A query has been raised. Please provide clarification.",
  on_hold: "This lead is on hold pending clarification from your side.",
};

const STATUS_INFO_MAP: Record<string, string> = {
  new: "Lead received. Under initial review by the ops team.",
  in_progress: "Lead is being actively processed.",
  awaiting_verification: "Lead details are being verified. No action required.",
  verified: "Lead details have been verified successfully.",
  under_assessment: "Lead is under credit/eligibility assessment.",
  query_resolved: "Query has been resolved. Processing continues.",
  approved: "Lead has been approved.",
  conditionally_approved: "Lead is conditionally approved. Final steps pending.",
  completed: "Processing for this lead is complete.",
  declined: "This lead was declined. See status reason for details.",
  withdrawn: "This lead has been withdrawn.",
  not_applicable: "No specific status action applies.",
};

interface Props {
  lead: Lead;
}

export function LeadLifecycleProgress({ lead }: Props) {
  const currentIdx = STAGE_ORDER.indexOf(lead.current_stage);
  const isTerminal = TERMINAL_STAGES.includes(lead.current_stage);
  const partnerAction = PARTNER_ACTION_MAP[lead.current_status] ?? null;
  const statusInfo = STATUS_INFO_MAP[lead.current_status] ?? null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" /> Lifecycle Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress steps */}
        <div className="overflow-x-auto pb-2">
          <div className="flex items-center gap-0.5 min-w-max">
            {STAGE_ORDER.map((stage, idx) => {
              const isPast = currentIdx >= 0 && idx < currentIdx;
              const isCurrent = idx === currentIdx;
              return (
                <div key={stage} className="flex items-center">
                  <div className={cn(
                    "flex flex-col items-center",
                    isCurrent && "relative"
                  )}>
                    <div className={cn(
                      "w-3 h-3 rounded-full border-2 transition-colors",
                      isPast && "bg-primary border-primary",
                      isCurrent && "bg-primary border-primary ring-2 ring-primary/30",
                      !isPast && !isCurrent && "bg-muted border-border"
                    )} />
                    <span className={cn(
                      "text-[10px] mt-1 max-w-[60px] text-center leading-tight",
                      isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"
                    )}>
                      {formatStageLabel(stage)}
                    </span>
                  </div>
                  {idx < STAGE_ORDER.length - 1 && (
                    <div className={cn(
                      "w-6 h-0.5 mt-[-12px]",
                      isPast ? "bg-primary" : "bg-border"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Current state summary */}
        <div className={cn(
          "rounded-lg p-4 border",
          isTerminal ? "bg-destructive/5 border-destructive/20" :
          partnerAction ? "bg-amber-50 border-amber-200" :
          "bg-muted/50 border-border"
        )}>
          <div className="flex items-start gap-3">
            {partnerAction ? (
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            ) : isTerminal ? (
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            ) : lead.current_stage === "disbursed" ? (
              <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            ) : (
              <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <StageBadge stage={lead.current_stage} />
                <StatusBadge status={lead.current_status} />
              </div>
              {lead.status_reason && (
                <p className="text-sm text-foreground">{lead.status_reason}</p>
              )}
              {partnerAction && (
                <p className="text-sm text-amber-800 font-medium">{partnerAction}</p>
              )}
              {!partnerAction && statusInfo && (
                <p className="text-sm text-muted-foreground">{statusInfo}</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
