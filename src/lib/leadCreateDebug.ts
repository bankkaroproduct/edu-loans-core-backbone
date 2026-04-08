import type { PostgrestError } from "@supabase/supabase-js";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

type AppUser = Tables<"users">;

export type LeadCreatePayload = TablesInsert<"student_leads">;
export type LeadCreateStep = "main lead insert" | "lead_stage_history" | "audit_logs" | "lead_notes" | "lead_id_fetch";

export interface SerializedDbError {
  message: string;
  details: string | null;
  hint: string | null;
  code: string | null;
}

export interface DebugStepResult {
  ok: boolean;
  skipped?: boolean;
  response: {
    data: unknown;
    error: SerializedDbError | null;
  };
}

export interface LeadCreateDebugState {
  authUserId: string | null;
  appUserId: string | null;
  resolvedRole: AppUser["role"] | null;
  resolvedPartnerId: string | null;
  effectivePartnerId: string | null;
  effectiveSubmittingUserId: string | null;
  payload: LeadCreatePayload;
  mainInsertResponse?: {
    data: unknown;
    error: SerializedDbError | null;
  };
  downstream?: Partial<Record<Exclude<LeadCreateStep, "main lead insert" | "lead_id_fetch">, DebugStepResult>>;
  displayIdResponse?: {
    displayId: string | null;
    error: SerializedDbError | null;
  };
  failedStep?: LeadCreateStep | null;
  error?: SerializedDbError | null;
}

export function serializeDbError(error: PostgrestError | Error | null | undefined): SerializedDbError | null {
  if (!error) return null;

  return {
    message: error.message,
    details: "details" in error ? error.details ?? null : null,
    hint: "hint" in error ? error.hint ?? null : null,
    code: "code" in error ? error.code ?? null : null,
  };
}

export function buildLeadCreateDebugState(params: {
  authUserId: string | null;
  appUser: AppUser | null;
  effectivePartnerId: string | null;
  effectiveSubmittingUserId: string | null;
  payload: LeadCreatePayload;
}): LeadCreateDebugState {
  const { authUserId, appUser, effectivePartnerId, effectiveSubmittingUserId, payload } = params;

  return {
    authUserId,
    appUserId: appUser?.id ?? null,
    resolvedRole: appUser?.role ?? null,
    resolvedPartnerId: appUser?.partner_id ?? null,
    effectivePartnerId,
    effectiveSubmittingUserId,
    payload,
  };
}

export function formatLeadCreateError(debug: Pick<LeadCreateDebugState, "failedStep" | "error">): string {
  if (!debug.failedStep || !debug.error) return "Lead creation failed for an unknown reason.";

  const parts = [`${debug.failedStep} failed: ${debug.error.message}`];
  if (debug.error.details) parts.push(debug.error.details);
  if (debug.error.hint) parts.push(`Hint: ${debug.error.hint}`);
  if (debug.error.code) parts.push(`Code: ${debug.error.code}`);
  return parts.join(" • ");
}

export function prettyDebugJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}