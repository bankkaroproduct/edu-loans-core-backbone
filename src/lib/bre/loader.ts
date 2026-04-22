// Loaders that fetch the active BRE scoring config + active lender rules
// and cast their JSON columns to the typed engine shapes.
//
// Used exclusively by the simulation runner. No mutation, no caching beyond the
// caller's React state.

import { supabase } from "@/integrations/supabase/client";
import type {
  BreLenderRule,
  BreScoringConfig,
  ScoringParameter,
  OverallBandRow,
  LenderBasicInfo,
  LenderCommercials,
  LenderHardThresholds,
  LenderLoanCaps,
  LenderCollateralLtv,
  LenderCoverage,
  LenderPolicy,
} from "./types";

export interface LoadedActiveConfig {
  cfg: BreScoringConfig;
  rules: BreLenderRule[];
}

export async function loadActiveScoringConfig(): Promise<BreScoringConfig> {
  const { data, error } = await supabase
    .from("bre_scoring_configs")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No active BRE scoring config found");

  return {
    id: data.id,
    version_number: data.version_number,
    is_active: data.is_active,
    bucket_threshold: Number(data.bucket_threshold),
    student_params: (data.student_params as unknown as ScoringParameter[]) ?? [],
    university_params: (data.university_params as unknown as ScoringParameter[]) ?? [],
    coapplicant_params: (data.coapplicant_params as unknown as ScoringParameter[]) ?? [],
    overall_band_mapping: (data.overall_band_mapping as unknown as OverallBandRow[]) ?? [],
  };
}

export async function loadActiveLenderRules(): Promise<BreLenderRule[]> {
  const { data, error } = await supabase
    .from("bre_lender_rules")
    .select("*")
    .eq("is_active", true);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    lender_id: r.lender_id,
    version_number: r.version_number,
    is_active: r.is_active,
    basic_info: (r.basic_info as unknown as LenderBasicInfo) ?? {
      lender_name: "Unknown",
      lender_code: "",
      lender_type: null,
      active: true,
    },
    commercials: (r.commercials as unknown as LenderCommercials) ?? {
      payout_pct: null,
      payout_trigger_stage: null,
      processing_fee_pct: null,
      processing_fee_flat: null,
    },
    hard_thresholds: (r.hard_thresholds as unknown as LenderHardThresholds) ?? {
      min_coapplicant_income: null,
      min_age: null,
      max_age: null,
      min_cibil: null,
      max_dpd_months: null,
      min_itr_years: null,
      allowed_relationships: null,
    },
    loan_caps: (r.loan_caps as unknown as LenderLoanCaps) ?? {
      secured: { min: null, max: null },
      unsecured: { min: null, max: null },
    },
    collateral_ltv: (r.collateral_ltv as unknown as LenderCollateralLtv) ?? {
      fd_ltv_pct: null,
      residential_ltv_pct: null,
      commercial_ltv_pct: null,
    },
    coverage: (r.coverage as unknown as LenderCoverage) ?? {
      supported_countries: [],
      excluded_states: [],
      accepted_courses: [],
      university_tier_overrides: [],
    },
    policy: (r.policy as unknown as LenderPolicy) ?? {
      processing_time_days: null,
      roi_min: null,
      roi_max: null,
      tenure_min_years: null,
      tenure_max_years: null,
      moratorium_months: null,
      notes: null,
    },
  }));
}

export async function loadActive(): Promise<LoadedActiveConfig> {
  const [cfg, rules] = await Promise.all([loadActiveScoringConfig(), loadActiveLenderRules()]);
  return { cfg, rules };
}
