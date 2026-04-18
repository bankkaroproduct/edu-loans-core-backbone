// Business source of truth for admin lead transitions.
// lifecycle_stage_master / lifecycle_status_master are used only for labels & ordering.

import type { Database } from "@/integrations/supabase/types";

export type LeadStage = Database["public"]["Enums"]["lead_stage_enum"];
export type LeadStatus = Database["public"]["Enums"]["lead_status_enum"];

export const TERMINAL_STAGES: LeadStage[] = ["disbursed", "rejected", "dropped"];

export const ALLOWED_TRANSITIONS: Record<LeadStage, LeadStage[]> = {
  draft: [], // partner-owned, admin cannot transition
  submitted: ["under_initial_review", "on_hold", "rejected", "dropped"],
  under_initial_review: ["documents_pending", "bre_evaluated", "on_hold", "rejected", "dropped"],
  documents_pending: ["documents_under_review", "on_hold", "rejected", "dropped"],
  documents_under_review: ["bre_evaluated", "documents_pending", "on_hold", "rejected", "dropped"],
  bre_evaluated: ["sent_to_lender", "on_hold", "rejected", "dropped"],
  sent_to_lender: ["login_submitted", "credit_query", "on_hold", "rejected", "dropped"],
  login_submitted: ["credit_query", "sanction_received", "on_hold", "rejected", "dropped"],
  credit_query: ["sanction_received", "sent_to_lender", "rejected", "dropped", "on_hold"],
  sanction_received: ["disbursed", "rejected", "dropped", "on_hold"],
  on_hold: [
    "submitted",
    "under_initial_review",
    "documents_pending",
    "documents_under_review",
    "bre_evaluated",
    "sent_to_lender",
    "login_submitted",
    "credit_query",
    "sanction_received",
  ],
  disbursed: [],
  rejected: [],
  dropped: [],
};

// Hardcoded default status when entering a stage. Source of truth.
export const DEFAULT_STATUS_FOR_STAGE: Record<LeadStage, LeadStatus> = {
  draft: "new",
  submitted: "awaiting_verification", // explicitly per business rule, NOT 'new'
  under_initial_review: "in_progress",
  documents_pending: "pending_info",
  documents_under_review: "awaiting_verification",
  bre_evaluated: "completed",
  sent_to_lender: "in_progress",
  login_submitted: "in_progress",
  credit_query: "query_raised",
  sanction_received: "approved",
  disbursed: "completed",
  rejected: "declined",
  dropped: "withdrawn",
  on_hold: "on_hold",
};

export const REASON_REQUIRED_STAGES: LeadStage[] = [
  "on_hold",
  "rejected",
  "dropped",
  "documents_pending",
];

export const REASON_REQUIRED_STATUSES: LeadStatus[] = [
  "pending_info",
  "reupload_needed",
  "declined",
  "query_raised",
  "on_hold",
];

export function getAllowedNextStages(current: LeadStage): LeadStage[] {
  return ALLOWED_TRANSITIONS[current] ?? [];
}

export function isTerminal(stage: LeadStage): boolean {
  return TERMINAL_STAGES.includes(stage);
}

export function stageRequiresReason(stage: LeadStage): boolean {
  return REASON_REQUIRED_STAGES.includes(stage);
}

export function statusRequiresReason(status: LeadStatus): boolean {
  return REASON_REQUIRED_STATUSES.includes(status);
}

export function getDefaultStatusFor(stage: LeadStage): LeadStatus {
  return DEFAULT_STATUS_FOR_STAGE[stage];
}
