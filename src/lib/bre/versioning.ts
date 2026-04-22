// BRE versioning operations.
//
// Every mutation here is two things at once:
//   1. A row insert / RPC call against the BRE tables.
//   2. An audit_logs row written explicitly with useful metadata.
//
// Audit is NOT implicit. Each function writes its own audit row before returning.
//
// Rollback is non-destructive: it CLONES the source row's JSON into a brand-new
// version (next version_number, is_active=false). Admin must then explicitly
// activate the new version as a separate step. Historical rows are never mutated.

import { supabase } from "@/integrations/supabase/client";
import type { BreScoringConfig, BreLenderRule } from "./types";
import type { Json } from "@/integrations/supabase/types";

// ---------- helpers ----------

async function getActorContext(): Promise<{ id: string | null; role: string | null }> {
  const { data: auth } = await supabase.auth.getUser();
  const authId = auth.user?.id;
  if (!authId) return { id: null, role: null };
  const { data } = await supabase
    .from("users")
    .select("id, role")
    .eq("auth_user_id", authId)
    .maybeSingle();
  return { id: data?.id ?? null, role: data?.role ?? null };
}

async function nextScoringConfigVersion(): Promise<number> {
  const { data, error } = await supabase
    .from("bre_scoring_configs")
    .select("version_number")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.version_number ?? 0) + 1;
}

async function nextLenderRuleVersion(lenderId: string): Promise<number> {
  const { data, error } = await supabase
    .from("bre_lender_rules")
    .select("version_number")
    .eq("lender_id", lenderId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.version_number ?? 0) + 1;
}

async function writeAudit(params: {
  entity_type: string;
  entity_id: string;
  action_type: string;
  meta?: Record<string, unknown>;
  old_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
}): Promise<void> {
  const actor = await getActorContext();
  await supabase.from("audit_logs").insert({
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    action_type: params.action_type,
    actor_user_id: actor.id,
    // actor_role typed as enum; we cast through any since it can be admin / super_admin
    actor_role: actor.role as never,
    meta: (params.meta ?? null) as Json,
    old_value: (params.old_value ?? null) as Json,
    new_value: (params.new_value ?? null) as Json,
  });
}

// ---------- scoring config ----------

export interface CreateScoringResult {
  id: string;
  version_number: number;
}

export async function createNewScoringConfigVersion(
  cfg: Omit<BreScoringConfig, "id" | "version_number" | "is_active">,
  changeSummary: string,
): Promise<CreateScoringResult> {
  const actor = await getActorContext();
  const version = await nextScoringConfigVersion();

  const { data, error } = await supabase
    .from("bre_scoring_configs")
    .insert({
      version_number: version,
      is_active: false,
      bucket_threshold: cfg.bucket_threshold,
      student_params: cfg.student_params as unknown as Json,
      university_params: cfg.university_params as unknown as Json,
      coapplicant_params: cfg.coapplicant_params as unknown as Json,
      overall_band_mapping: cfg.overall_band_mapping as unknown as Json,
      change_summary: changeSummary,
      created_by: actor.id,
    })
    .select("id, version_number")
    .single();

  if (error) throw error;

  await writeAudit({
    entity_type: "bre_scoring_config",
    entity_id: data.id,
    action_type: "bre_config_created",
    meta: { version_number: data.version_number, change_summary: changeSummary },
  });

  return { id: data.id, version_number: data.version_number };
}

export async function activateScoringConfigVersion(versionId: string): Promise<{
  activated_id: string;
  activated_version: number;
  deactivated_id: string | null;
  deactivated_version: number | null;
}> {
  const { data, error } = await supabase.rpc("bre_activate_scoring_config", { _id: versionId });
  if (error) throw error;
  // RPC handles audit internally
  return data as never;
}

export async function rollbackScoringConfigToVersion(
  sourceId: string,
  changeSummary: string,
): Promise<CreateScoringResult> {
  const { data: source, error: srcErr } = await supabase
    .from("bre_scoring_configs")
    .select("version_number, bucket_threshold, student_params, university_params, coapplicant_params, overall_band_mapping")
    .eq("id", sourceId)
    .single();
  if (srcErr) throw srcErr;

  const actor = await getActorContext();
  const version = await nextScoringConfigVersion();
  const summary = changeSummary || `Rollback from v${source.version_number}`;

  const { data, error } = await supabase
    .from("bre_scoring_configs")
    .insert({
      version_number: version,
      is_active: false,
      bucket_threshold: source.bucket_threshold,
      student_params: source.student_params,
      university_params: source.university_params,
      coapplicant_params: source.coapplicant_params,
      overall_band_mapping: source.overall_band_mapping,
      change_summary: summary,
      created_by: actor.id,
    })
    .select("id, version_number")
    .single();

  if (error) throw error;

  await writeAudit({
    entity_type: "bre_scoring_config",
    entity_id: data.id,
    action_type: "bre_config_rolled_back",
    meta: {
      source_version: source.version_number,
      source_id: sourceId,
      new_version: data.version_number,
      change_summary: summary,
    },
  });

  return { id: data.id, version_number: data.version_number };
}

// ---------- lender rules ----------

export interface CreateLenderRuleResult {
  id: string;
  version_number: number;
}

export async function createNewLenderRuleVersion(
  lenderId: string,
  rule: Omit<BreLenderRule, "id" | "version_number" | "is_active" | "lender_id">,
  changeSummary: string,
): Promise<CreateLenderRuleResult> {
  const actor = await getActorContext();
  const version = await nextLenderRuleVersion(lenderId);

  const { data, error } = await supabase
    .from("bre_lender_rules")
    .insert({
      lender_id: lenderId,
      version_number: version,
      is_active: false,
      basic_info: rule.basic_info as unknown as Json,
      commercials: rule.commercials as unknown as Json,
      hard_thresholds: rule.hard_thresholds as unknown as Json,
      loan_caps: rule.loan_caps as unknown as Json,
      collateral_ltv: rule.collateral_ltv as unknown as Json,
      coverage: rule.coverage as unknown as Json,
      policy: rule.policy as unknown as Json,
      change_summary: changeSummary,
      created_by: actor.id,
    })
    .select("id, version_number")
    .single();

  if (error) throw error;

  await writeAudit({
    entity_type: "bre_lender_rule",
    entity_id: data.id,
    action_type: "bre_lender_rule_created",
    meta: {
      lender_id: lenderId,
      version_number: data.version_number,
      change_summary: changeSummary,
    },
  });

  return { id: data.id, version_number: data.version_number };
}

export async function activateLenderRuleVersion(versionId: string): Promise<{
  lender_id: string;
  activated_id: string;
  activated_version: number;
  deactivated_id: string | null;
  deactivated_version: number | null;
}> {
  const { data, error } = await supabase.rpc("bre_activate_lender_rule", { _id: versionId });
  if (error) throw error;
  // RPC handles audit and lenders.bre_rule_id update internally
  return data as never;
}

export async function rollbackLenderRuleToVersion(
  sourceId: string,
  changeSummary: string,
): Promise<CreateLenderRuleResult> {
  const { data: source, error: srcErr } = await supabase
    .from("bre_lender_rules")
    .select("lender_id, version_number, basic_info, commercials, hard_thresholds, loan_caps, collateral_ltv, coverage, policy")
    .eq("id", sourceId)
    .single();
  if (srcErr) throw srcErr;

  const actor = await getActorContext();
  const version = await nextLenderRuleVersion(source.lender_id);
  const summary = changeSummary || `Rollback from v${source.version_number}`;

  const { data, error } = await supabase
    .from("bre_lender_rules")
    .insert({
      lender_id: source.lender_id,
      version_number: version,
      is_active: false,
      basic_info: source.basic_info,
      commercials: source.commercials,
      hard_thresholds: source.hard_thresholds,
      loan_caps: source.loan_caps,
      collateral_ltv: source.collateral_ltv,
      coverage: source.coverage,
      policy: source.policy,
      change_summary: summary,
      created_by: actor.id,
    })
    .select("id, version_number")
    .single();

  if (error) throw error;

  await writeAudit({
    entity_type: "bre_lender_rule",
    entity_id: data.id,
    action_type: "bre_lender_rule_rolled_back",
    meta: {
      lender_id: source.lender_id,
      source_version: source.version_number,
      source_id: sourceId,
      new_version: data.version_number,
      change_summary: summary,
    },
  });

  return { id: data.id, version_number: data.version_number };
}
