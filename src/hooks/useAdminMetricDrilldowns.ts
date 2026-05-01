import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type StageEnum = Database["public"]["Enums"]["lead_stage_enum"];
type StatusEnum = Database["public"]["Enums"]["lead_status_enum"];

const ROW_LIMIT = 20;

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
  const [requests, setRequests] = useState<DrillState<PendingRequestRow[]>>(initial([]));
  const [documents, setDocuments] = useState<DrillState<PendingDocumentRow[]>>(initial([]));

  const fetchAll = useCallback(async () => {
    setRequests((s) => ({ ...s, loading: true, error: null }));
    setDocuments((s) => ({ ...s, loading: true, error: null }));

    // Pending edit requests
    try {
      const { data: reqs, error } = await supabase
        .from("lead_edit_requests")
        .select("id, lead_id, partner_id, partner_reason, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(ROW_LIMIT);
      if (error) throw error;

      const leadIds = [...new Set((reqs ?? []).map((r) => r.lead_id))];
      const partnerIds = [...new Set((reqs ?? []).map((r) => r.partner_id))];
      const [leadsRes, partnerMap] = await Promise.all([
        leadIds.length
          ? supabase
              .from("student_leads")
              .select("id, lead_id, student_full_name, student_first_name, student_last_name")
              .in("id", leadIds)
          : Promise.resolve({ data: [] as any[] }),
        resolvePartners(partnerIds),
      ]);
      const leadMap: Record<string, any> = {};
      (leadsRes.data ?? []).forEach((l: any) => { leadMap[l.id] = l; });

      const rows: PendingRequestRow[] = (reqs ?? []).map((r) => {
        const l = leadMap[r.lead_id] ?? {};
        return {
          id: r.id,
          lead_uuid: r.lead_id,
          lead_id: l.lead_id ?? null,
          student_name: studentName(l),
          partner_name: partnerMap[r.partner_id] ?? null,
          created_at: r.created_at,
          partner_reason: r.partner_reason,
        };
      });
      setRequests({ rows, loading: false, error: null });
    } catch (e: any) {
      setRequests({ rows: [], loading: false, error: e?.message ?? "Failed" });
    }

    // Documents to verify
    try {
      const { data: docs, error } = await supabase
        .from("lead_documents")
        .select("id, lead_id, file_name, uploaded_at, document_type_id")
        .eq("is_latest", true)
        .eq("verification_status", "uploaded")
        .order("uploaded_at", { ascending: false })
        .limit(ROW_LIMIT);
      if (error) throw error;

      const leadIds = [...new Set((docs ?? []).map((d) => d.lead_id))];
      const docTypeIds = [...new Set((docs ?? []).map((d) => d.document_type_id).filter(Boolean) as string[])];
      const [leadsRes, docTypesRes] = await Promise.all([
        leadIds.length
          ? supabase
              .from("student_leads")
              .select("id, lead_id, student_full_name, student_first_name, student_last_name, partner_id")
              .in("id", leadIds)
          : Promise.resolve({ data: [] as any[] }),
        docTypeIds.length
          ? supabase
              .from("document_master")
              .select("id, document_name, display_name")
              .in("id", docTypeIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const leadMap: Record<string, any> = {};
      (leadsRes.data ?? []).forEach((l: any) => { leadMap[l.id] = l; });
      const docTypeMap: Record<string, any> = {};
      (docTypesRes.data ?? []).forEach((d: any) => { docTypeMap[d.id] = d; });
      const partnerMap = await resolvePartners(
        Object.values(leadMap).map((l: any) => l.partner_id),
      );

      const rows: PendingDocumentRow[] = (docs ?? []).map((d) => {
        const l = leadMap[d.lead_id] ?? {};
        const dt = d.document_type_id ? docTypeMap[d.document_type_id] : null;
        return {
          id: d.id,
          lead_uuid: d.lead_id,
          lead_id: l.lead_id ?? null,
          student_name: studentName(l),
          partner_name: l.partner_id ? partnerMap[l.partner_id] ?? null : null,
          document_name: dt?.display_name ?? dt?.document_name ?? d.file_name,
          uploaded_at: d.uploaded_at,
        };
      });
      setDocuments({ rows, loading: false, error: null });
    } catch (e: any) {
      setDocuments({ rows: [], loading: false, error: e?.message ?? "Failed" });
    }
  }, []);

  useEffect(() => { if (open) fetchAll(); }, [open, fetchAll]);

  return { requests, documents, refetch: fetchAll };
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
