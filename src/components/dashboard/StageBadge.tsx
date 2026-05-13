import { cn } from "@/lib/utils";

/**
 * Semantic badge palette (PR 4 spec).
 * Stage/status keys are bucketed into 5 semantic tones:
 *   emerald  = positive outcome (Active / Sent / Approved / Disbursed / Verified / Completed)
 *   amber    = in-progress / awaiting (Pending / Submitted / Under review / In progress)
 *   red      = failed / rejected (Rejected / Declined / Failed)
 *   slate    = neutral / static (Draft / New / On Hold / Withdrawn / Dropped / N/A)
 *   blue     = demo / mock / simulated
 *   premiere = admin-only premiere highlight (consumers opt-in)
 */
const BADGE_BASE =
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border";

const TONE = {
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
  slate: "bg-slate-100 text-slate-700 border-slate-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  premiere: "bg-amber-100 text-amber-800 border-amber-300",
} as const;

export type BadgeTone = keyof typeof TONE;

/** Stage → semantic tone. Defaults to slate for unknown keys. */
const stageTone: Record<string, BadgeTone> = {
  // positive outcome
  sanction_received: "emerald",
  disbursed: "emerald",
  sent_to_lender: "emerald",
  // in-progress / awaiting
  submitted: "amber",
  under_initial_review: "amber",
  documents_pending: "amber",
  documents_under_review: "amber",
  bre_evaluated: "amber",
  login_submitted: "amber",
  credit_query: "amber",
  // failed
  rejected: "red",
  // neutral / static
  draft: "slate",
  dropped: "slate",
  on_hold: "slate",
};

/** Status → semantic tone. Defaults to slate for unknown keys. */
const statusTone: Record<string, BadgeTone> = {
  // positive
  approved: "emerald",
  conditionally_approved: "emerald",
  verified: "emerald",
  completed: "emerald",
  query_resolved: "emerald",
  // in-progress
  in_progress: "amber",
  pending_info: "amber",
  awaiting_verification: "amber",
  under_assessment: "amber",
  query_raised: "amber",
  reupload_needed: "amber",
  // failed
  declined: "red",
  // neutral
  new: "slate",
  withdrawn: "slate",
  on_hold: "slate",
  not_applicable: "slate",
};

export function formatStageLabel(stage: string) {
  if (stage === "active") return "Active";
  return stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StageBadge({ stage, className }: { stage: string; className?: string }) {
  const tone = stageTone[stage] ?? "slate";
  return (
    <span className={cn(BADGE_BASE, TONE[tone], className)}>
      {formatStageLabel(stage)}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = statusTone[status] ?? "slate";
  return (
    <span className={cn(BADGE_BASE, TONE[tone], className)}>
      {formatStageLabel(status)}
    </span>
  );
}

/**
 * Generic semantic badge for inline status pills outside the Stage/Status enums.
 * Use the tone that matches meaning, not visual variety.
 */
export function SemanticBadge({
  tone,
  children,
  className,
}: {
  tone: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn(BADGE_BASE, TONE[tone], className)}>{children}</span>;
}
