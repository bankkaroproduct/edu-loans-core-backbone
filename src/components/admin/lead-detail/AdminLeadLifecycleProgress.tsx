// Admin-only lifecycle progress (visual-only mirror of LeadLifecycleProgress).
// MIRROR: keep STAGE_ORDER / TERMINAL_STAGES / PARTNER_ACTION_MAP / STATUS_INFO_MAP
// in sync with src/components/lead-detail/LeadLifecycleProgress.tsx.
// No stage-order, terminal, or status-text logic is changed here.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatLabel } from "@/lib/labels";
import { Activity, AlertTriangle, CheckCircle, Info, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"student_leads">;

// MIRROR: keep in sync with LeadLifecycleProgress
const STAGE_ORDER = [
  "draft", "submitted", "under_initial_review", "documents_pending",
  "documents_under_review", "bre_evaluated", "sent_to_lender",
  "login_submitted", "credit_query", "sanction_received", "disbursed",
];

// MIRROR: keep in sync with LeadLifecycleProgress
const TERMINAL_STAGES = ["rejected", "dropped", "on_hold"];

// MIRROR: keep in sync with LeadLifecycleProgress
const PARTNER_ACTION_MAP: Record<string, string> = {
  pending_info: "Please provide the missing information to move this lead forward.",
  documents_pending: "Upload the required documents to continue processing.",
  reupload_needed: "Re-upload the rejected document with corrections.",
  query_raised: "A query has been raised. Please provide clarification.",
  on_hold: "This lead is on hold pending clarification from your side.",
};

// MIRROR: keep in sync with LeadLifecycleProgress
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

export function AdminLeadLifecycleProgress({ lead }: Props) {
  const currentIdx = STAGE_ORDER.indexOf(lead.current_stage);
  const isTerminal = TERMINAL_STAGES.includes(lead.current_stage);
  const partnerAction = PARTNER_ACTION_MAP[lead.current_status] ?? null;
  const statusInfo = STATUS_INFO_MAP[lead.current_status] ?? null;

  return (
    <Card className="rounded-xl border-border/60 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
            <Activity className="h-3.5 w-3.5 text-primary" />
          </span>
          Lead Lifecycle
        </CardTitle>
        <Badge variant="outline" className="text-[10px] font-medium bg-primary/5 border-primary/20 text-primary">
          {formatLabel(lead.current_stage)} · {formatLabel(lead.current_status)}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        {isTerminal && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <span className="text-sm font-medium text-destructive">
              Lead exited at: {formatLabel(lead.current_stage)}
            </span>
          </div>
        )}

        <div className="relative">
          <div className={cn("overflow-x-auto pb-2", isTerminal && "opacity-50")}>
            <div className="flex items-start min-w-max px-1">
              {STAGE_ORDER.map((stage, idx) => {
                const isPast = currentIdx >= 0 && idx < currentIdx;
                const isCurrent = idx === currentIdx;
                const isLast = idx === STAGE_ORDER.length - 1;
                return (
                  <div key={stage} className="flex items-start">
                    <div className="flex flex-col items-center w-20 shrink-0">
                      <div className="h-6 flex items-center justify-center">
                        <div
                          className={cn(
                            "rounded-full border-2 transition-all flex items-center justify-center",
                            isCurrent
                              ? "w-5 h-5 bg-primary border-primary ring-4 ring-primary/15"
                              : isPast
                              ? "w-4 h-4 bg-primary border-primary"
                              : "w-3.5 h-3.5 bg-card border-border",
                          )}
                        >
                          {isPast && <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3} />}
                          {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "text-[11px] mt-2 text-center leading-snug px-1 line-clamp-2 h-8",
                          isCurrent ? "font-semibold text-primary" : "text-muted-foreground",
                        )}
                      >
                        {formatLabel(stage)}
                      </span>
                    </div>
                    {!isLast && (
                      <div className="h-6 flex items-center w-8 shrink-0">
                        <div
                          className={cn(
                            "h-[2px] w-full rounded-full",
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
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card to-transparent"
          />
        </div>

        <div
          className={cn(
            "rounded-lg p-3.5 border",
            isTerminal
              ? "bg-destructive/5 border-destructive/20"
              : partnerAction
              ? "bg-amber-50/60 border-amber-200"
              : "bg-muted/40 border-border/60",
          )}
        >
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
                Current: {formatLabel(lead.current_stage)} · {formatLabel(lead.current_status)}
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
