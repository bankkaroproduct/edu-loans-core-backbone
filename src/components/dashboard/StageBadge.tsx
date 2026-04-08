import { cn } from "@/lib/utils";

const stageColorMap: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-primary/10 text-primary border-primary/20",
  under_initial_review: "bg-amber-50 text-amber-700 border-amber-200",
  documents_pending: "bg-orange-50 text-orange-700 border-orange-200",
  documents_under_review: "bg-amber-50 text-amber-700 border-amber-200",
  bre_evaluated: "bg-blue-50 text-blue-700 border-blue-200",
  sent_to_lender: "bg-indigo-50 text-indigo-700 border-indigo-200",
  login_submitted: "bg-violet-50 text-violet-700 border-violet-200",
  credit_query: "bg-rose-50 text-rose-700 border-rose-200",
  sanction_received: "bg-emerald-50 text-emerald-700 border-emerald-200",
  disbursed: "bg-green-50 text-green-800 border-green-200",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  dropped: "bg-muted text-muted-foreground border-border",
  on_hold: "bg-yellow-50 text-yellow-700 border-yellow-200",
};

const statusColorMap: Record<string, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  pending_info: "bg-orange-50 text-orange-700 border-orange-200",
  reupload_needed: "bg-rose-50 text-rose-700 border-rose-200",
  awaiting_verification: "bg-amber-50 text-amber-700 border-amber-200",
  verified: "bg-green-50 text-green-800 border-green-200",
  under_assessment: "bg-indigo-50 text-indigo-700 border-indigo-200",
  query_raised: "bg-rose-50 text-rose-700 border-rose-200",
  query_resolved: "bg-blue-50 text-blue-700 border-blue-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  conditionally_approved: "bg-teal-50 text-teal-700 border-teal-200",
  declined: "bg-destructive/10 text-destructive border-destructive/20",
  withdrawn: "bg-muted text-muted-foreground border-border",
  on_hold: "bg-yellow-50 text-yellow-700 border-yellow-200",
  completed: "bg-green-50 text-green-800 border-green-200",
  not_applicable: "bg-muted text-muted-foreground border-border",
};

export function formatStageLabel(stage: string) {
  return stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StageBadge({ stage, className }: { stage: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        stageColorMap[stage] ?? "bg-muted text-muted-foreground",
        className
      )}
    >
      {formatStageLabel(stage)}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        statusColorMap[status] ?? "bg-muted text-muted-foreground",
        className
      )}
    >
      {formatStageLabel(status)}
    </span>
  );
}
