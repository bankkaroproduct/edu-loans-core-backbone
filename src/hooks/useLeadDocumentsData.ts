import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type LeadDocRow = Tables<"student_leads">;

export type LeadDocRequirement = Tables<"lead_document_requirements"> & {
  document_master?: {
    document_name: string;
    document_category: string | null;
    document_code?: string | null;
    applicable_for?: string | null;
    display_name?: string | null;
    sort_order?: number | null;
  } | null;
};

export type LeadDocFile = Tables<"lead_documents"> & {
  document_master?: { document_name: string } | null;
};

interface State {
  loading: boolean;
  notFound: boolean;
  lead: LeadDocRow | null;
  requirements: LeadDocRequirement[];
  documents: LeadDocFile[];
}

const initial: State = {
  loading: true,
  notFound: false,
  lead: null,
  requirements: [],
  documents: [],
};

/**
 * Single source of truth for a lead's documents UI.
 * Used by both AdminLeadDetail (embedded review panel) and the full LeadDocuments page
 * so they cannot drift out of sync.
 */
export function useLeadDocumentsData(leadId: string | undefined) {
  const [state, setState] = useState<State>(initial);

  const refresh = useCallback(async () => {
    if (!leadId) return;
    setState((s) => ({ ...s, loading: true }));

    const leadRes = await supabase.from("student_leads").select("*").eq("id", leadId).maybeSingle();
    if (!leadRes.data) {
      setState({ ...initial, loading: false, notFound: true });
      return;
    }

    const [reqRes, docRes] = await Promise.all([
      supabase
        .from("lead_document_requirements")
        .select("*, document_master(document_name, document_category, document_code, applicable_for, display_name, sort_order)")
        .eq("lead_id", leadId)
        .order("created_at"),
      supabase
        .from("lead_documents")
        .select("*, document_master(document_name)")
        .eq("lead_id", leadId)
        .order("uploaded_at", { ascending: false }),
    ]);

    // Sort requirements by document_master.sort_order so both Partner and Admin
    // portals render the canonical 19-item checklist order. Falls back to a
    // large sentinel for legacy rows that pre-date the column.
    const sortedReqs = [...((reqRes.data ?? []) as LeadDocRequirement[])].sort((a, b) => {
      const ao = a.document_master?.sort_order ?? 9999;
      const bo = b.document_master?.sort_order ?? 9999;
      return ao - bo;
    });

    setState({
      loading: false,
      notFound: false,
      lead: leadRes.data,
      requirements: sortedReqs,
      documents: (docRes.data ?? []) as LeadDocFile[],
    });
  }, [leadId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, refresh };
}
