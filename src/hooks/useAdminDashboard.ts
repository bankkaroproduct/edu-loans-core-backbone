import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type StageEnum = Database["public"]["Enums"]["lead_stage_enum"];
type StatusEnum = Database["public"]["Enums"]["lead_status_enum"];

export interface AdminMetrics {
  totalLeads: number;
  pendingAdminActions: number;
  requestsPendingApproval: number;
  documentsPendingReview: number;
  sentToLender: number;
  sanctionReceived: number;
  disbursed: number;
  activePartners: number;
}

export interface PipelineStage {
  stage_key: StageEnum;
  stage_label: string;
  sort_order: number;
  is_terminal: boolean;
  count: number;
}

export interface AdminLeadRow {
  id: string;
  lead_id: string | null;
  student_full_name: string | null;
  student_first_name: string;
  student_last_name: string | null;
  source_type: string;
  current_stage: StageEnum;
  current_status: StatusEnum;
  updated_at: string;
  created_at: string;
  partner_id: string;
  partner_display_name: string | null;
}

export interface AdminAlert {
  id: string;
  category: "missing_info" | "docs_not_started" | "stale";
  lead_uuid: string;
  lead_id: string | null;
  student_name: string;
  stage: StageEnum;
  status: StatusEnum;
  reason: string;
  updated_at: string;
}

export interface LeadQueueFilters {
  source: "all" | "partner" | "student_direct";
  stage: "all" | StageEnum;
  sortBy: "updated_at" | "created_at";
  sortDir: "asc" | "desc";
}

export const defaultQueueFilters: LeadQueueFilters = {
  source: "all",
  stage: "all",
  sortBy: "created_at",
  sortDir: "desc",
};

interface SectionState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

const STALE_HOURS = 48;
// Stages where the lead is the partner/student's responsibility to fix (not admin's)
// We exclude these from "stale" alerts.
const STALE_EXCLUDED_STAGES: StageEnum[] = ["draft", "disbursed", "rejected", "dropped", "on_hold"];
const STALE_EXCLUDED_STATUSES: StatusEnum[] = ["pending_info", "query_raised", "reupload_needed"];

// Stages where these fields are required. Drafts excluded.
const REQUIRED_INFO_STAGES: StageEnum[] = ["submitted", "under_initial_review", "documents_under_review"];
const PENDING_REVIEW_STATUSES: StatusEnum[] = ["new", "awaiting_verification", "query_raised", "pending_info", "in_progress"];

export function useAdminDashboard() {
  const [filters, setFilters] = useState<LeadQueueFilters>(defaultQueueFilters);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  const [metrics, setMetrics] = useState<SectionState<AdminMetrics | null>>({
    data: null, loading: true, error: null,
  });
  const [pipeline, setPipeline] = useState<SectionState<PipelineStage[]>>({
    data: [], loading: true, error: null,
  });
  const [queue, setQueue] = useState<SectionState<AdminLeadRow[]>>({
    data: [], loading: true, error: null,
  });
  const [alerts, setAlerts] = useState<SectionState<AdminAlert[]>>({
    data: [], loading: true, error: null,
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Metrics: 8 ops-meaningful counts (head:true, no rows fetched) ----
  const fetchMetrics = useCallback(async () => {
    setMetrics((s) => ({ ...s, loading: true, error: null }));
    try {
      const leadsBase = () => supabase.from("student_leads").select("*", { count: "exact", head: true }).eq("is_archived", false);
      const [
        total, pendingReq, docsToVerify, sentLender, sanction, disb, activePart,
      ] = await Promise.all([
        leadsBase(),
        supabase.from("lead_edit_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("lead_documents").select("*", { count: "exact", head: true }).eq("is_latest", true).eq("verification_status", "uploaded"),
        leadsBase().eq("current_stage", "sent_to_lender"),
        leadsBase().eq("current_stage", "sanction_received"),
        leadsBase().eq("current_stage", "disbursed"),
        supabase.from("partner_organizations").select("*", { count: "exact", head: true }).eq("status", "active").eq("is_archived", false),
      ]);
      const errs = [total.error, pendingReq.error, docsToVerify.error, sentLender.error, sanction.error, disb.error, activePart.error].filter(Boolean);
      if (errs.length) throw errs[0];

      const requestsPendingApproval = pendingReq.count ?? 0;
      const documentsPendingReview = docsToVerify.count ?? 0;

      setMetrics({
        loading: false,
        error: null,
        data: {
          totalLeads: total.count ?? 0,
          pendingAdminActions: requestsPendingApproval + documentsPendingReview,
          requestsPendingApproval,
          documentsPendingReview,
          sentToLender: sentLender.count ?? 0,
          sanctionReceived: sanction.count ?? 0,
          disbursed: disb.count ?? 0,
          activePartners: activePart.count ?? 0,
        },
      });
    } catch (e: any) {
      setMetrics({ data: null, loading: false, error: e?.message ?? "Failed to load metrics" });
    }
  }, []);

  // ---- Pipeline (master table + grouped count) ----
  const fetchPipeline = useCallback(async () => {
    setPipeline((s) => ({ ...s, loading: true, error: null }));
    try {
      const [stagesRes, leadsRes] = await Promise.all([
        supabase.from("lifecycle_stage_master")
          .select("stage_key, stage_label, sort_order, is_terminal")
          .eq("active_flag", true)
          .order("sort_order"),
        // Lightweight: only fetch the stage column, no other fields
        supabase.from("student_leads").select("current_stage").eq("is_archived", false),
      ]);
      if (stagesRes.error) throw stagesRes.error;
      if (leadsRes.error) throw leadsRes.error;

      const counts: Record<string, number> = {};
      (leadsRes.data ?? []).forEach((l) => {
        counts[l.current_stage] = (counts[l.current_stage] ?? 0) + 1;
      });

      const merged: PipelineStage[] = (stagesRes.data ?? []).map((s) => ({
        stage_key: s.stage_key,
        stage_label: s.stage_label,
        sort_order: s.sort_order,
        is_terminal: s.is_terminal,
        count: counts[s.stage_key] ?? 0,
      }));

      setPipeline({ data: merged, loading: false, error: null });
    } catch (e: any) {
      setPipeline({ data: [], loading: false, error: e?.message ?? "Failed to load pipeline" });
    }
  }, []);

  // ---- Lead queue (paged, filtered, sorted) ----
  const fetchQueue = useCallback(async (f: LeadQueueFilters) => {
    setQueue((s) => ({ ...s, loading: true, error: null }));
    try {
      let q = supabase.from("student_leads")
        .select("id, lead_id, student_full_name, student_first_name, student_last_name, source_type, current_stage, current_status, updated_at, created_at, partner_id")
        .eq("is_archived", false)
        .order(f.sortBy, { ascending: f.sortDir === "asc" })
        .range(0, 9);
      if (f.source !== "all") q = q.eq("source_type", f.source);
      if (f.stage !== "all") q = q.eq("current_stage", f.stage);

      const leadsRes = await q;
      if (leadsRes.error) throw leadsRes.error;
      const leads = leadsRes.data ?? [];

      // Resolve partner names in a single follow-up query
      const partnerIds = [...new Set(leads.map((l) => l.partner_id).filter(Boolean))];
      let partnerMap: Record<string, string> = {};
      if (partnerIds.length) {
        const partnersRes = await supabase.from("partner_organizations")
          .select("id, display_name")
          .in("id", partnerIds);
        if (!partnersRes.error) {
          (partnersRes.data ?? []).forEach((p) => { partnerMap[p.id] = p.display_name; });
        }
      }

      const rows: AdminLeadRow[] = leads.map((l) => ({
        ...l,
        partner_display_name: partnerMap[l.partner_id] ?? null,
      }));

      setQueue({ data: rows, loading: false, error: null });
    } catch (e: any) {
      setQueue({ data: [], loading: false, error: e?.message ?? "Failed to load lead queue" });
    }
  }, []);

  // ---- Alerts (3 stage-aware queries, capped) ----
  const fetchAlerts = useCallback(async () => {
    setAlerts((s) => ({ ...s, loading: true, error: null }));
    try {
      const staleCutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString();

      const [missingRes, docsPendingRes, staleRes] = await Promise.all([
        // Missing info: only when lead is past draft and in early stages
        supabase.from("student_leads")
          .select("id, lead_id, student_full_name, student_first_name, student_last_name, current_stage, current_status, updated_at, student_email, loan_amount_required, university_name_raw, university_id")
          .eq("is_archived", false)
          .in("current_stage", REQUIRED_INFO_STAGES)
          .or("student_email.is.null,loan_amount_required.is.null")
          .order("updated_at", { ascending: false })
          .limit(15),
        // Docs pending stage but no lead_document_requirements rows
        supabase.from("student_leads")
          .select("id, lead_id, student_full_name, student_first_name, student_last_name, current_stage, current_status, updated_at")
          .eq("is_archived", false)
          .eq("current_stage", "documents_pending")
          .order("updated_at", { ascending: false })
          .limit(15),
        // Stale: not in terminal/draft, not blocked-on-partner status, not updated in 48h
        supabase.from("student_leads")
          .select("id, lead_id, student_full_name, student_first_name, student_last_name, current_stage, current_status, updated_at")
          .eq("is_archived", false)
          .not("current_stage", "in", `(${STALE_EXCLUDED_STAGES.join(",")})`)
          .not("current_status", "in", `(${STALE_EXCLUDED_STATUSES.join(",")})`)
          .lt("updated_at", staleCutoff)
          .order("updated_at", { ascending: true })
          .limit(10),
      ]);

      if (missingRes.error) throw missingRes.error;
      if (docsPendingRes.error) throw docsPendingRes.error;
      if (staleRes.error) throw staleRes.error;

      const items: AdminAlert[] = [];
      const nameOf = (l: any) => l.student_full_name ?? `${l.student_first_name}${l.student_last_name ? " " + l.student_last_name : ""}`;

      (missingRes.data ?? []).forEach((l) => {
        const missing: string[] = [];
        if (!l.student_email) missing.push("email");
        if (!l.loan_amount_required) missing.push("loan amount");
        if (!l.university_name_raw && !l.university_id) missing.push("university");
        if (missing.length === 0) return;
        items.push({
          id: `miss-${l.id}`, category: "missing_info",
          lead_uuid: l.id, lead_id: l.lead_id, student_name: nameOf(l),
          stage: l.current_stage, status: l.current_status,
          reason: `Missing: ${missing.join(", ")}`,
          updated_at: l.updated_at,
        });
      });

      // For docs_not_started, check which leads in documents_pending have zero requirements
      const docsPendingLeads = docsPendingRes.data ?? [];
      if (docsPendingLeads.length) {
        const reqRes = await supabase.from("lead_document_requirements")
          .select("lead_id")
          .in("lead_id", docsPendingLeads.map((l) => l.id));
        const withReqs = new Set((reqRes.data ?? []).map((r) => r.lead_id));
        docsPendingLeads.filter((l) => !withReqs.has(l.id)).slice(0, 10).forEach((l) => {
          items.push({
            id: `docs-${l.id}`, category: "docs_not_started",
            lead_uuid: l.id, lead_id: l.lead_id, student_name: nameOf(l),
            stage: l.current_stage, status: l.current_status,
            reason: "In documents_pending stage but no document requirements assigned",
            updated_at: l.updated_at,
          });
        });
      }

      (staleRes.data ?? []).forEach((l) => {
        const ageHrs = Math.floor((Date.now() - new Date(l.updated_at).getTime()) / (60 * 60 * 1000));
        items.push({
          id: `stale-${l.id}`, category: "stale",
          lead_uuid: l.id, lead_id: l.lead_id, student_name: nameOf(l),
          stage: l.current_stage, status: l.current_status,
          reason: `No update for ${ageHrs}h (>${STALE_HOURS}h threshold)`,
          updated_at: l.updated_at,
        });
      });

      setAlerts({ data: items, loading: false, error: null });
    } catch (e: any) {
      setAlerts({ data: [], loading: false, error: e?.message ?? "Failed to load alerts" });
    }
  }, []);

  const refreshAll = useCallback(() => {
    setLastRefreshedAt(new Date());
    fetchMetrics();
    fetchPipeline();
    fetchQueue(filters);
    fetchAlerts();
  }, [fetchMetrics, fetchPipeline, fetchQueue, fetchAlerts, filters]);

  // Initial load + filter changes for the queue only
  useEffect(() => { fetchQueue(filters); }, [filters, fetchQueue]);

  useEffect(() => {
    fetchMetrics();
    fetchPipeline();
    fetchAlerts();
  }, [fetchMetrics, fetchPipeline, fetchAlerts]);

  // Refresh on tab focus
  useEffect(() => {
    const onFocus = () => refreshAll();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshAll]);

  // Realtime subscription with debounce
  useEffect(() => {
    const channel = supabase
      .channel("admin-dashboard-leads")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "student_leads" },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            setLastRefreshedAt(new Date());
            fetchMetrics();
            fetchPipeline();
            fetchQueue(filters);
            fetchAlerts();
          }, 500);
        }
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [fetchMetrics, fetchPipeline, fetchQueue, fetchAlerts, filters]);

  return {
    metrics, pipeline, queue, alerts,
    filters, setFilters,
    lastRefreshedAt, refreshAll,
  };
}
