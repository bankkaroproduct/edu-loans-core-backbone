// Business source of truth for admin lead transitions.
// lifecycle_stage_master / lifecycle_status_master are used only for labels & ordering.

import type { Database } from "@/integrations/supabase/types";

export type LeadStage = Database["public"]["Enums"]["lead_stage_enum"];
export type LeadStatus = Database["public"]["Enums"]["lead_status_enum"];

export const TERMINAL_STAGES: LeadStage[] = ["disbursed", "rejected", "dropped"];

// Operationally meaningful operational stages an admin can jump a lead to
// from any non-terminal source (skip-ahead allowed; reverse to draft/submitted is not).
// Reason / override guardrails for on_hold/rejected/dropped/documents_pending and
// for bre_evaluated / disbursed remain enforced at the dialog + RPC layer.
const OPERATIONAL_TARGETS: LeadStage[] = [
  "under_initial_review",
  "documents_pending",
  "documents_under_review",
  "bre_evaluated",
  "sent_to_lender",
  "login_submitted",
  "credit_query",
  "sanction_received",
  "disbursed",
  "on_hold",
  "rejected",
  "dropped",
];

function targetsFor(current: LeadStage): LeadStage[] {
  return OPERATIONAL_TARGETS.filter((t) => t !== current);
}

export const ALLOWED_TRANSITIONS: Record<LeadStage, LeadStage[]> = {
  draft: [], // partner-owned, admin cannot transition
  submitted: targetsFor("submitted"),
  under_initial_review: targetsFor("under_initial_review"),
  documents_pending: targetsFor("documents_pending"),
  documents_under_review: targetsFor("documents_under_review"),
  bre_evaluated: targetsFor("bre_evaluated"),
  sent_to_lender: targetsFor("sent_to_lender"),
  login_submitted: targetsFor("login_submitted"),
  credit_query: targetsFor("credit_query"),
  sanction_received: targetsFor("sanction_received"),
  on_hold: targetsFor("on_hold"),
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
