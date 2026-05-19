// Shared lifecycle stepper used by both Partner and Admin Lead Detail pages.
// Single source of truth — replaces former LeadLifecycleProgress (partner)
// and AdminLeadLifecycleProgress (admin) mirror components.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatLabel } from "@/lib/labels";
import { Activity, AlertTriangle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"student_leads">;

const STAGE_ORDER = [
  "draft", "submitted", "under_initial_review", "documents_pending",
  "documents_under_review", "bre_evaluated", "sent_to_lender",
  "login_submitted", "credit_query", "sanction_received", "disbursed",
];

const TERMINAL_STAGES = ["rejected", "dropped", "on_hold"];

interface Props {
  lead: Lead;
  headerRight?: React.ReactNode;
}

export function LeadLifecycleStepper({ lead, headerRight }: Props) {
  const currentIdx = STAGE_ORDER.indexOf(lead.current_stage);
  const isTerminal = TERMINAL_STAGES.includes(lead.current_stage);

  return (
    <Card className="rounded-xl border-border/60 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3 space-y-0">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
            <Activity className="h-3.5 w-3.5 text-primary" />
          </span>
          Lead Lifecycle
        </CardTitle>
        {headerRight ?? (
          <Badge
            variant="outline"
            className="text-[10px] font-medium bg-primary/5 border-primary/20 text-primary"
          >
            {formatLabel(lead.current_stage)} · {formatLabel(lead.current_status)}
          </Badge>
        )}
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
                    {/* Fixed-width column keeps dots aligned regardless of label wrap height */}
                    <div className="flex flex-col items-center w-20 shrink-0">
                      {/* Dot row — fixed height so connectors line up to dot center */}
                      <div className="h-6 flex items-center justify-center">
                        <div
                          className={cn(
                            "w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center",
                            isCurrent || isPast
                              ? "bg-primary border-primary"
                              : "bg-card border-border",
                          )}
                        >
                          {isPast && <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3} />}
                        </div>
                      </div>
                      {/* Label — wraps naturally, no clamp / no fixed height */}
                      <span
                        className={cn(
                          "text-[11px] mt-2 text-center leading-tight break-words px-1",
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
      </CardContent>
    </Card>
  );
}
