// Thin RPC wrappers for admin operations.
// All mutations are atomic with audit logging on the server side.

import { supabase } from "@/integrations/supabase/client";
import type { LeadStage, LeadStatus } from "./leadTransitions";

export type AdminActionResult<T = unknown> =
  | { ok: true; data: T; error?: undefined }
  | { ok: false; data?: undefined; error: string };

function toErrorMessage(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message?: unknown }).message ?? "Unknown error");
  }
  return "Unknown error";
}

export async function changeLeadStage(params: {
  leadId: string;
  newStage: LeadStage;
  newStatus: LeadStatus;
  changeReason?: string | null;
  partnerVisibleNote?: string | null;
  internalNote?: string | null;
  override?: boolean;
}): Promise<AdminActionResult> {
  const { data, error } = await supabase.rpc("admin_change_lead_stage", {
    _lead_id: params.leadId,
    _new_stage: params.newStage,
    _new_status: params.newStatus,
    _change_reason: params.changeReason ?? null,
    _partner_visible_note: params.partnerVisibleNote ?? null,
    _internal_note: params.internalNote ?? null,
    _override: params.override ?? false,
  } as never);
  if (error) return { ok: false, error: toErrorMessage(error) };
  return { ok: true, data };
}

export async function changeLeadStatus(params: {
  leadId: string;
  newStatus: LeadStatus;
  changeReason?: string | null;
}): Promise<AdminActionResult> {
  const { data, error } = await supabase.rpc("admin_change_lead_status", {
    _lead_id: params.leadId,
    _new_status: params.newStatus,
    _change_reason: params.changeReason ?? null,
  } as never);
  if (error) return { ok: false, error: toErrorMessage(error) };
  return { ok: true, data };
}

export async function reviewDocument(params: {
  documentId: string;
  action: "verify" | "reject" | "reupload";
  remark?: string | null;
}): Promise<AdminActionResult> {
  const { data, error } = await supabase.rpc("admin_review_document", {
    _document_id: params.documentId,
    _action: params.action,
    _remark: params.remark ?? null,
  } as never);
  if (error) return { ok: false, error: toErrorMessage(error) };
  return { ok: true, data };
}

export async function addAdminLeadNote(params: {
  leadId: string;
  noteText: string;
  noteType: "internal" | "partner_visible";
}): Promise<AdminActionResult> {
  const { data, error } = await supabase.rpc("admin_add_lead_note", {
    _lead_id: params.leadId,
    _note_text: params.noteText,
    _note_type: params.noteType,
  } as never);
  if (error) return { ok: false, error: toErrorMessage(error) };
  return { ok: true, data };
}
