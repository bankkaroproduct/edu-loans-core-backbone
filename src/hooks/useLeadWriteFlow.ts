import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { serializeDbError, type DebugStepResult, type LeadCreateStep, type SerializedDbError } from "@/lib/leadCreateDebug";

type AppUser = Tables<"users">;

type DownstreamStep = Exclude<LeadCreateStep, "main lead insert" | "lead_id_fetch">;

export interface CreateDownstreamRecordsResult {
  ok: boolean;
  failedStep: DownstreamStep | null;
  error: SerializedDbError | null;
  steps: Record<DownstreamStep, DebugStepResult>;
}

/**
 * Creates downstream records after lead insert:
 * - lead_stage_history (initial entry)
 * - audit_logs (lead_created / draft_saved / duplicate_override)
 * - lead_notes (partner remark if provided)
 */
export async function createDownstreamRecords(params: {
  leadId: string;
  appUser: AppUser;
  stage: string;
  status: string;
  isDraft: boolean;
  hasDuplicateOverride: boolean;
  partnerRemark?: string;
}): Promise<CreateDownstreamRecordsResult> {
  const { leadId, appUser, stage, status, isDraft, hasDuplicateOverride, partnerRemark } = params;
  let failedStep: DownstreamStep | null = null;
  let failedError: SerializedDbError | null = null;

  // 1. Stage history — initial entry
  const historyResult = await supabase.from("lead_stage_history").insert({
    lead_id: leadId,
    new_stage: stage as any,
    new_status: status as any,
    previous_stage: null,
    previous_status: null,
    changed_by_user_id: appUser.id,
    changed_by_role: appUser.role,
    change_reason: isDraft ? "Draft saved by partner" : "Lead submitted by partner",
    partner_visible_note: isDraft ? "Lead saved as draft" : "Lead submitted for review",
  });
  const historyError = serializeDbError(historyResult.error);
  if (historyError && !failedStep) {
    failedStep = "lead_stage_history";
    failedError = historyError;
  }
  if (historyResult.error) console.error("[LeadWriteFlow] stage history insert failed:", historyResult.error.message, historyResult.error.details, historyResult.error.hint);

  // 2. Audit log
  const auditResult = await supabase.from("audit_logs").insert({
    actor_user_id: appUser.id,
    actor_role: appUser.role,
    entity_type: "student_lead",
    entity_id: leadId,
    action_type: isDraft ? "draft_saved" : hasDuplicateOverride ? "lead_created_duplicate_override" : "lead_created",
    new_value: { stage, status } as any,
    meta: { source: "partner_portal" } as any,
  });
  const auditError = serializeDbError(auditResult.error);
  if (auditError && !failedStep) {
    failedStep = "audit_logs";
    failedError = auditError;
  }
  if (auditResult.error) console.error("[LeadWriteFlow] audit log insert failed:", auditResult.error.message, auditResult.error.details, auditResult.error.hint);

  // 3. Partner remark note
  let noteResult: { data: unknown; error: SerializedDbError | null; skipped?: boolean } = {
    data: null,
    error: null,
    skipped: true,
  };

  if (partnerRemark?.trim()) {
    const insertNoteResult = await supabase.from("lead_notes").insert({
      lead_id: leadId,
      note_type: "partner_visible",
      note_text: partnerRemark.trim(),
      created_by: appUser.id,
    });
    const noteError = serializeDbError(insertNoteResult.error);
    noteResult = { data: insertNoteResult.data ?? null, error: noteError, skipped: false };

    if (noteError && !failedStep) {
      failedStep = "lead_notes";
      failedError = noteError;
    }
    if (insertNoteResult.error) console.error("[LeadWriteFlow] note insert failed:", insertNoteResult.error.message, insertNoteResult.error.details, insertNoteResult.error.hint);
  }

  return {
    ok: !failedStep,
    failedStep,
    error: failedError,
    steps: {
      lead_stage_history: {
        ok: !historyError,
        response: {
          data: historyResult.data ?? null,
          error: historyError,
        },
      },
      audit_logs: {
        ok: !auditError,
        response: {
          data: auditResult.data ?? null,
          error: auditError,
        },
      },
      lead_notes: {
        ok: !noteResult.error,
        skipped: noteResult.skipped,
        response: {
          data: noteResult.data,
          error: noteResult.error,
        },
      },
    },
  };
}

/**
 * Fetches the generated lead_id (human-readable) after insert.
 */
export async function fetchLeadDisplayId(leadId: string): Promise<{ displayId: string | null; error: SerializedDbError | null }> {
  const { data, error } = await supabase
    .from("student_leads")
    .select("lead_id")
    .eq("id", leadId)
    .single();

  return {
    displayId: data?.lead_id ?? null,
    error: serializeDbError(error),
  };
}
