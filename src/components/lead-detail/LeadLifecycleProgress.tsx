import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLabel } from "@/lib/labels";
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
      <CardContent className="space-y-5">
        {/* Terminal-stage banner — visual clarity that the linear journey ended */}
        {isTerminal && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <span className="text-sm font-medium text-destructive">
              Lead exited at: {formatStageLabel(lead.current_stage)}
            </span>
          </div>
        )}

        {/* Progress steps — uniform-width columns + flex connectors keep dots and labels symmetrical.
            Wrapped in a relative container with a right-edge fade to hint at horizontal scrollability. */}
        <div className="relative">
          <div className={cn("overflow-x-auto pb-3", isTerminal && "opacity-50")}>
            <div className="flex items-start min-w-max">
              {STAGE_ORDER.map((stage, idx) => {
                const isPast = currentIdx >= 0 && idx < currentIdx;
                const isCurrent = idx === currentIdx;
                const isLast = idx === STAGE_ORDER.length - 1;
                return (
                  <div key={stage} className="flex items-start">
                    {/* Step column: fixed width keeps every dot at the exact same horizontal cell */}
                    <div className="flex flex-col items-center w-16 shrink-0">
                      {/* Dot row — fixed height so connectors line up to the dot center */}
                      <div className="h-5 flex items-center justify-center">
                        <div
                          className={cn(
                            "rounded-full border-2 transition-colors",
                            isCurrent
                              ? "w-4 h-4 bg-primary border-primary ring-2 ring-primary/40 ring-offset-2 ring-offset-card"
                              : "w-3 h-3",
                            isPast && "bg-primary border-primary",
                            !isPast && !isCurrent && "bg-muted border-border",
                          )}
                        />
                      </div>
                      {/* Label box — uniform footprint regardless of label length */}
                      <span
                        className={cn(
                          "text-[11px] mt-2 text-center leading-snug px-1 line-clamp-2 h-8",
                          isCurrent
                            ? "font-semibold text-primary"
                            : "text-muted-foreground",
                        )}
                      >
                        {formatStageLabel(stage)}
                      </span>
                    </div>
                    {/* Connector — vertically aligned to dot center via matching h-5 row */}
                    {!isLast && (
                      <div className="h-5 flex items-center w-8 shrink-0">
                        <div
                          className={cn(
                            "h-0.5 w-full",
                            isPast ? "bg-primary" : "bg-border",
                          )}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {/* Right-edge scroll fade — pure visual hint, no behavior change */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card to-transparent"
          />
        </div>

        {/* Current state summary — duplicate badge chips removed; header above is canonical */}
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
            <div className="space-y-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Current: {formatStageLabel(lead.current_stage)} · {formatStageLabel(lead.current_status)}
              </p>
              {lead.status_reason && (
                <p className="text-sm text-foreground break-words">{lead.status_reason}</p>
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
