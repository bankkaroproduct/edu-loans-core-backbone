import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type AppUser = Tables<"users">;

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
}) {
  const { leadId, appUser, stage, status, isDraft, hasDuplicateOverride, partnerRemark } = params;

  // 1. Stage history — initial entry
  const { error: histErr } = await supabase.from("lead_stage_history").insert({
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
  if (histErr) console.error("[LeadWriteFlow] stage history insert failed:", histErr.message);

  // 2. Audit log
  const { error: auditErr } = await supabase.from("audit_logs").insert({
    actor_user_id: appUser.id,
    actor_role: appUser.role,
    entity_type: "student_lead",
    entity_id: leadId,
    action_type: isDraft ? "draft_saved" : hasDuplicateOverride ? "lead_created_duplicate_override" : "lead_created",
    new_value: { stage, status } as any,
    meta: { source: "partner_portal" } as any,
  });
  if (auditErr) console.error("[LeadWriteFlow] audit log insert failed:", auditErr.message);

  // 3. Partner remark note
  if (partnerRemark?.trim()) {
    const { error: noteErr } = await supabase.from("lead_notes").insert({
      lead_id: leadId,
      note_type: "partner_visible",
      note_text: partnerRemark.trim(),
      created_by: appUser.id,
    });
    if (noteErr) console.error("[LeadWriteFlow] note insert failed:", noteErr.message);
  }
}

/**
 * Fetches the generated lead_id (human-readable) after insert.
 */
export async function fetchLeadDisplayId(leadId: string): Promise<string | null> {
  const { data } = await supabase
    .from("student_leads")
    .select("lead_id")
    .eq("id", leadId)
    .single();
  return data?.lead_id ?? null;
}
