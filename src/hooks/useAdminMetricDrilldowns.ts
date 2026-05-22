import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  ACTION_NEEDED_EXCLUDED_STAGES,
  REVIEW_DUE_SELECT_COLUMNS,
  countMissingMandatory,
  REVIEW_DUE_THRESHOLD,
} from "@/lib/adminActionNeeded";
import { useAdminLeadScope } from "@/hooks/useAdminLeadScope";

type StageEnum = Database["public"]["Enums"]["lead_stage_enum"];
type StatusEnum = Database["public"]["Enums"]["lead_status_enum"];

const ROW_LIMIT = 20;

export interface ReviewDueLeadRow {
  id: string;
  lead_uuid: string;
  lead_id: string | null;
  student_name: string;
  partner_name: string | null;
  current_stage: StageEnum;
  current_status: StatusEnum;
  missing_count: number;
  updated_at: string;
}

export interface FollowUpLeadRow {
  id: string;
  lead_uuid: string;
  lead_id: string | null;
  student_name: string;
  partner_name: string | null;
  current_stage: StageEnum;
  current_status: StatusEnum;
  updated_at: string;
}

export interface PendingRequestRow {
  id: string;
  lead_uuid: string;
  lead_id: string | null;
  student_name: string;
  partner_name: string | null;
  created_at: string;
  partner_reason: string | null;
}

export interface PendingDocumentRow {
  id: string;
  lead_uuid: string;
  lead_id: string | null;
  student_name: string;
  partner_name: string | null;
  document_name: string;
  uploaded_at: string;
}

export interface DisbursedLeadRow {
  id: string;
  lead_id: string | null;
  student_name: string;
  partner_name: string | null;
  current_status: StatusEnum;
  updated_at: string;
}

export interface ActivePartnerRow {
  id: string;
  display_name: string;
  partner_code: string;
  partner_type: string;
  status: string;
  onboarding_date: string | null;
  created_at: string;
  lead_count?: number;
}

export interface PipelineLeadRow {
  id: string;
  lead_id: string | null;
  student_name: string;
  partner_name: string | null;
  current_stage: StageEnum;
  current_status: StatusEnum;
  updated_at: string;
}

const studentName = (l: any) =>
  l.student_full_name ??
  `${l.student_first_name ?? ""}${l.student_last_name ? " " + l.student_last_name : ""}`.trim() ??
  "—";

async function resolvePartners(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return {};
  const { data } = await supabase
    .from("partner_organizations")
    .select("id, display_name")
    .in("id", unique);
  const map: Record<string, string> = {};
  (data ?? []).forEach((p) => { map[p.id] = p.display_name; });
  return map;
}

interface DrillState<T> {
  rows: T;
  loading: boolean;
  error: string | null;
}
const initial = <T,>(empty: T): DrillState<T> => ({ rows: empty, loading: false, error: null });

export function useActionNeededDrilldown(open: boolean) {
  const { ready, hasNoScope, applyPartnerScope } = useAdminLeadScope();
  const [reviewDue, setReviewDue] = useState<DrillState<ReviewDueLeadRow[]>>(initial([]));
  const [followUp, setFollowUp] = useState<DrillState<FollowUpLeadRow[]>>(initial([]));

  const fetchAll = useCallback(async () => {
    if (!ready) return;
    if (hasNoScope) {
      setReviewDue({ rows: [], loading: false, error: null });
      setFollowUp({ rows: [], loading: false, error: null });
      return;
    }
    setReviewDue((s) => ({ ...s, loading: true, error: null }));
    setFollowUp((s) => ({ ...s, loading: true, error: null }));

    const excludedClause = `(${ACTION_NEEDED_EXCLUDED_STAGES.join(",")})`;

    try {
      const { data, error } = await applyPartnerScope(
        supabase
          .from("student_leads")
          .select(REVIEW_DUE_SELECT_COLUMNS)
          .eq("is_archived", false)
          .not("current_stage", "in", excludedClause)
          .order("updated_at", { ascending: false })
      );
      if (error) throw error;

      const filtered = (data ?? [])
        .map((l: any) => ({ ...l, missing_count: countMissingMandatory(l) }))
        .filter((l: any) => l.missing_count > REVIEW_DUE_THRESHOLD)
        .slice(0, ROW_LIMIT);

      const partnerMap = await resolvePartners(filtered.map((l: any) => l.partner_id));
      const rows: ReviewDueLeadRow[] = filtered.map((l: any) => ({
        id: l.id, lead_uuid: l.id, lead_id: l.lead_id ?? null,
        student_name: studentName(l),
        partner_name: l.partner_id ? partnerMap[l.partner_id] ?? null : null,
        current_stage: l.current_stage, current_status: l.current_status,
        missing_count: l.missing_count, updated_at: l.updated_at,
      }));
      setReviewDue({ rows, loading: false, error: null });
    } catch (e: any) {
      setReviewDue({ rows: [], loading: false, error: e?.message ?? "Failed" });
    }

    try {
      const { data, error } = await applyPartnerScope(
        supabase
          .from("student_leads")
          .select("id, lead_id, student_full_name, student_first_name, student_last_name, partner_id, current_stage, current_status, updated_at")
          .eq("is_archived", false)
          .not("current_stage", "in", excludedClause)
          .order("updated_at", { ascending: true })
          .limit(ROW_LIMIT)
      );
      if (error) throw error;

      const partnerMap = await resolvePartners((data ?? []).map((l: any) => l.partner_id));
      const rows: FollowUpLeadRow[] = (data ?? []).map((l: any) => ({
        id: l.id, lead_uuid: l.id, lead_id: l.lead_id ?? null,
        student_name: studentName(l),
        partner_name: l.partner_id ? partnerMap[l.partner_id] ?? null : null,
        current_stage: l.current_stage, current_status: l.current_status,
        updated_at: l.updated_at,
      }));
      setFollowUp({ rows, loading: false, error: null });
    } catch (e: any) {
      setFollowUp({ rows: [], loading: false, error: e?.message ?? "Failed" });
    }
  }, [ready, hasNoScope, applyPartnerScope]);

  useEffect(() => { if (open) fetchAll(); }, [open, fetchAll]);

  return { reviewDue, followUp, refetch: fetchAll };
}

export function useActivePipelineDrilldown(open: boolean) {
  const [recent, setRecent] = useState<DrillState<PipelineLeadRow[]>>(initial([]));

  const fetchRecent = useCallback(async () => {
    setRecent((s) => ({ ...s, loading: true, error: null }));
    try {
      const { data, error } = await supabase
        .from("student_leads")
        .select("id, lead_id, student_full_name, student_first_name, student_last_name, partner_id, current_stage, current_status, updated_at")
        .eq("is_archived", false)
        .order("updated_at", { ascending: false })
        .limit(ROW_LIMIT);
      if (error) throw error;
      const partnerMap = await resolvePartners((data ?? []).map((l: any) => l.partner_id));
      const rows: PipelineLeadRow[] = (data ?? []).map((l: any) => ({
        id: l.id,
        lead_id: l.lead_id,
        student_name: studentName(l),
        partner_name: l.partner_id ? partnerMap[l.partner_id] ?? null : null,
        current_stage: l.current_stage,
        current_status: l.current_status,
        updated_at: l.updated_at,
      }));
      setRecent({ rows, loading: false, error: null });
    } catch (e: any) {
      setRecent({ rows: [], loading: false, error: e?.message ?? "Failed" });
    }
  }, []);

  useEffect(() => { if (open) fetchRecent(); }, [open, fetchRecent]);
  return { recent, refetch: fetchRecent };
}

export function useDisbursedDrilldown(open: boolean) {
  const [leads, setLeads] = useState<DrillState<DisbursedLeadRow[]>>(initial([]));

  const fetchLeads = useCallback(async () => {
    setLeads((s) => ({ ...s, loading: true, error: null }));
    try {
      const { data, error } = await supabase
        .from("student_leads")
        .select("id, lead_id, student_full_name, student_first_name, student_last_name, partner_id, current_status, updated_at")
        .eq("is_archived", false)
        .eq("current_stage", "disbursed")
        .order("updated_at", { ascending: false })
        .limit(ROW_LIMIT);
      if (error) throw error;
      const partnerMap = await resolvePartners((data ?? []).map((l: any) => l.partner_id));
      const rows: DisbursedLeadRow[] = (data ?? []).map((l: any) => ({
        id: l.id,
        lead_id: l.lead_id,
        student_name: studentName(l),
        partner_name: l.partner_id ? partnerMap[l.partner_id] ?? null : null,
        current_status: l.current_status,
        updated_at: l.updated_at,
      }));
      setLeads({ rows, loading: false, error: null });
    } catch (e: any) {
      setLeads({ rows: [], loading: false, error: e?.message ?? "Failed" });
    }
  }, []);

  useEffect(() => { if (open) fetchLeads(); }, [open, fetchLeads]);
  return { leads, refetch: fetchLeads };
}

export function useActivePartnersDrilldown(open: boolean) {
  const [partners, setPartners] = useState<DrillState<ActivePartnerRow[]>>(initial([]));

  const fetchPartners = useCallback(async () => {
    setPartners((s) => ({ ...s, loading: true, error: null }));
    try {
      const { data, error } = await supabase
        .from("partner_organizations")
        .select("id, display_name, partner_code, partner_type, status, onboarding_date, created_at")
        .eq("status", "active")
        .eq("is_archived", false)
        .order("display_name", { ascending: true })
        .limit(50);
      if (error) throw error;

      // Optional: lead count per partner (best-effort, single query)
      const ids = (data ?? []).map((p) => p.id);
      let leadCounts: Record<string, number> = {};
      if (ids.length) {
        const { data: leads } = await supabase
          .from("student_leads")
          .select("partner_id")
          .eq("is_archived", false)
          .in("partner_id", ids);
        (leads ?? []).forEach((l: any) => {
          leadCounts[l.partner_id] = (leadCounts[l.partner_id] ?? 0) + 1;
        });
      }

      const rows: ActivePartnerRow[] = (data ?? []).map((p: any) => ({
        ...p,
        lead_count: leadCounts[p.id] ?? 0,
      }));
      setPartners({ rows, loading: false, error: null });
    } catch (e: any) {
      setPartners({ rows: [], loading: false, error: e?.message ?? "Failed" });
    }
  }, []);

  useEffect(() => { if (open) fetchPartners(); }, [open, fetchPartners]);
  return { partners, refetch: fetchPartners };
}
