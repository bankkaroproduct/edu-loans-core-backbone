import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import type { Tables } from "@/integrations/supabase/types";
import { usePartnerContext } from "@/hooks/usePartnerContext";

import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardFilters, defaultFilters, type DashboardFilterValues } from "@/components/dashboard/DashboardFilters";
import { KPICards, type KPIData } from "@/components/dashboard/KPICards";
import { PipelineSnapshot } from "@/components/dashboard/PipelineSnapshot";
import { PriorityAlerts, type AlertItem } from "@/components/dashboard/PriorityAlerts";
import { RecentLeads } from "@/components/dashboard/RecentLeads";
import { DocumentSnapshot, type DocSummary } from "@/components/dashboard/DocumentSnapshot";
import { BulkUploadSnapshot } from "@/components/dashboard/BulkUploadSnapshot";
import { PayoutSnapshot, type PayoutSummary } from "@/components/dashboard/PayoutSnapshot";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { ActivityFeed, type ActivityItem } from "@/components/dashboard/ActivityFeed";
import { SystemHelp } from "@/components/dashboard/SystemHelp";

type Lead = Tables<"student_leads">;
type Batch = Tables<"bulk_upload_batches">;
type PayoutRecord = Tables<"partner_payout_records">;
type DocReq = Tables<"lead_document_requirements">;
type StageHistory = Tables<"lead_stage_history">;
type Note = Tables<"lead_notes">;

export default function Dashboard() {
  const { appUser } = useAuth();
  const { agentUserId } = useRoleAccess();
  const { effectivePartnerId } = usePartnerContext();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [payoutRecords, setPayoutRecords] = useState<PayoutRecord[]>([]);
  const [docReqs, setDocReqs] = useState<DocReq[]>([]);
  const [stageHistory, setStageHistory] = useState<StageHistory[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [filters, setFilters] = useState<DashboardFilterValues>(defaultFilters);

  useEffect(() => {
    const fetchData = async () => {
      // Build role-aware lead query
      let leadsQ = supabase.from("student_leads").select("*").eq("is_archived", false).order("updated_at", { ascending: false }).limit(500);
      if (effectivePartnerId) leadsQ = leadsQ.eq("partner_id", effectivePartnerId);
      if (agentUserId) leadsQ = leadsQ.eq("partner_user_id", agentUserId);

      // Build role-aware batch query
      let batchQ = supabase.from("bulk_upload_batches").select("*").order("uploaded_at", { ascending: false }).limit(20);
      if (effectivePartnerId) batchQ = batchQ.eq("partner_id", effectivePartnerId);
      if (agentUserId) batchQ = batchQ.eq("uploaded_by", agentUserId);

      const [leadsRes, batchRes, payoutRes, docReqRes, historyRes, notesRes, partnerRes] = await Promise.all([
        leadsQ,
        batchQ,
        effectivePartnerId
          ? supabase.from("partner_payout_records").select("*").eq("partner_id", effectivePartnerId).order("created_at", { ascending: false }).limit(100)
          : supabase.from("partner_payout_records").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("lead_document_requirements").select("*").limit(500),
        supabase.from("lead_stage_history").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("lead_notes").select("*").order("created_at", { ascending: false }).limit(30),
        effectivePartnerId
          ? supabase.from("partner_organizations").select("display_name").eq("id", effectivePartnerId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const fetchedLeads = leadsRes.data ?? [];
      setLeads(fetchedLeads);
      setBatches(batchRes.data ?? []);

      // For agent role, filter related records to only accessible leads
      const accessibleLeadIds = new Set(fetchedLeads.map((l) => l.id));

      if (agentUserId) {
        setPayoutRecords((payoutRes.data ?? []).filter((p) => accessibleLeadIds.has(p.lead_id)));
        setDocReqs((docReqRes.data ?? []).filter((d) => accessibleLeadIds.has(d.lead_id)));
        setStageHistory((historyRes.data ?? []).filter((h) => accessibleLeadIds.has(h.lead_id)));
        setNotes((notesRes.data ?? []).filter((n) => accessibleLeadIds.has(n.lead_id)));
      } else {
        if (payoutRes.data) setPayoutRecords(payoutRes.data);
        if (docReqRes.data) setDocReqs(docReqRes.data);
        if (historyRes.data) setStageHistory(historyRes.data);
        if (notesRes.data) setNotes(notesRes.data);
      }

      if (partnerRes.data && "display_name" in partnerRes.data) {
        setPartnerName(partnerRes.data.display_name);
      }
      setLoading(false);
    };
    fetchData();
  }, [effectivePartnerId, agentUserId]);

  const destinations = useMemo(() => [...new Set(leads.map((l) => l.intended_study_country))].sort(), [leads]);
  const intakes = useMemo(() => {
    const set = new Set(leads.map((l) => `${l.intake_term} ${l.intake_year}`));
    return [...set].sort();
  }, [leads]);

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (filters.dateFrom && l.created_at < filters.dateFrom) return false;
      if (filters.dateTo && l.created_at > filters.dateTo + "T23:59:59") return false;
      if (filters.stage && filters.stage !== "all" && l.current_stage !== filters.stage) return false;
      if (filters.status && filters.status !== "all" && l.current_status !== filters.status) return false;
      if (filters.destination && filters.destination !== "all" && l.intended_study_country !== filters.destination) return false;
      if (filters.intake && filters.intake !== "all" && `${l.intake_term} ${l.intake_year}` !== filters.intake) return false;
      return true;
    });
  }, [leads, filters]);

  const kpiData = useMemo<KPIData>(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const reviewStages = ["under_initial_review", "documents_under_review", "bre_evaluated"];
    const pendingPayout = payoutRecords.filter((p) => p.payout_status === "pending" || p.payout_status === "triggered");
    const paidPayout = payoutRecords.filter((p) => p.payout_status === "paid");
    const docsNeedingAction = docReqs.filter((d) => ["not_uploaded", "reupload_needed"].includes(d.status));
    const needsAttention = filteredLeads.filter((l) =>
      l.current_stage === "on_hold" || l.current_stage === "documents_pending" ||
      l.current_status === "reupload_needed" || l.current_status === "pending_info"
    );

    return {
      totalLeads: filteredLeads.length,
      leadsThisMonth: filteredLeads.filter((l) => l.created_at >= monthStart).length,
      underReview: filteredLeads.filter((l) => reviewStages.includes(l.current_stage)).length,
      documentsPending: docsNeedingAction.length,
      sentToLender: filteredLeads.filter((l) => ["sent_to_lender", "login_submitted"].includes(l.current_stage)).length,
      sanctionReceived: filteredLeads.filter((l) => l.current_stage === "sanction_received").length,
      disbursed: filteredLeads.filter((l) => l.current_stage === "disbursed").length,
      rejectedDropped: filteredLeads.filter((l) => ["rejected", "dropped"].includes(l.current_stage)).length,
      bulkBatchesThisMonth: batches.filter((b) => b.uploaded_at >= monthStart).length,
      pendingPayout: pendingPayout.reduce((s, p) => s + (p.payout_amount ?? 0), 0),
      paidPayout: paidPayout.reduce((s, p) => s + (p.payout_amount ?? 0), 0),
      needsAttention: needsAttention.length,
    };
  }, [filteredLeads, batches, payoutRecords, docReqs]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredLeads.forEach((l) => { counts[l.current_stage] = (counts[l.current_stage] ?? 0) + 1; });
    return counts;
  }, [filteredLeads]);

  const alerts = useMemo<AlertItem[]>(() => {
    const items: AlertItem[] = [];
    const now = Date.now();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

    leads.filter((l) => l.current_stage === "on_hold").forEach((l) => {
      items.push({ id: `hold-${l.id}`, leadId: l.lead_id, studentName: l.student_full_name ?? l.student_first_name, reason: "Lead is on hold — may need clarification", category: "on_hold", updatedAt: l.updated_at, entityId: l.id });
    });
    leads.filter((l) => l.current_stage === "documents_pending").forEach((l) => {
      items.push({ id: `docs-${l.id}`, leadId: l.lead_id, studentName: l.student_full_name ?? l.student_first_name, reason: "Documents pending — upload required", category: "docs_pending", updatedAt: l.updated_at, entityId: l.id });
    });
    leads.filter((l) => l.current_status === "reupload_needed").forEach((l) => {
      items.push({ id: `reup-${l.id}`, leadId: l.lead_id, studentName: l.student_full_name ?? l.student_first_name, reason: "Document reupload needed", category: "reupload", updatedAt: l.updated_at, entityId: l.id });
    });
    const earlyStages = ["draft", "submitted", "under_initial_review"];
    leads.filter((l) => earlyStages.includes(l.current_stage) && now - new Date(l.updated_at).getTime() > SEVEN_DAYS).forEach((l) => {
      items.push({ id: `stuck-${l.id}`, leadId: l.lead_id, studentName: l.student_full_name ?? l.student_first_name, reason: `Stuck in ${l.current_stage.replace(/_/g, " ")} for over 7 days`, category: "stuck", updatedAt: l.updated_at, entityId: l.id });
    });
    leads.filter((l) => !l.student_email && !l.loan_amount_required).forEach((l) => {
      items.push({ id: `missing-${l.id}`, leadId: l.lead_id, studentName: l.student_full_name ?? l.student_first_name, reason: "Missing mandatory fields (email, loan amount)", category: "attention", updatedAt: l.updated_at, entityId: l.id });
    });
    batches.filter((b) => b.failed_rows > 0).forEach((b) => {
      items.push({ id: `batch-${b.id}`, leadId: b.batch_id, studentName: b.file_name, reason: `${b.failed_rows} of ${b.total_rows} rows failed`, category: "upload_error", updatedAt: b.uploaded_at, entityId: b.id });
    });
    payoutRecords.filter((p) => p.payout_status === "on_hold").forEach((p) => {
      items.push({ id: `payout-${p.id}`, leadId: p.lead_id.slice(0, 8), studentName: "Payout Record", reason: "Payout on hold — clarification needed", category: "payout_clarification", updatedAt: p.updated_at, entityId: p.lead_id });
    });
    notes.filter((n) => n.note_type === "partner_visible" || n.note_type === "system").slice(0, 5).forEach((n) => {
      const lead = leads.find((l) => l.id === n.lead_id);
      if (lead) {
        items.push({ id: `remark-${n.id}`, leadId: lead.lead_id, studentName: lead.student_full_name ?? lead.student_first_name, reason: n.note_text.length > 60 ? n.note_text.slice(0, 60) + "…" : n.note_text, category: "admin_remark", updatedAt: n.created_at, entityId: lead.id });
      }
    });

    return items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [leads, batches, payoutRecords, notes]);

  const docSummary = useMemo<DocSummary>(() => ({
    pending: docReqs.filter((d) => d.status === "not_uploaded").length,
    underReview: docReqs.filter((d) => d.status === "under_review").length,
    verified: docReqs.filter((d) => d.status === "verified").length,
    rejected: docReqs.filter((d) => d.status === "rejected").length,
    reuploadNeeded: docReqs.filter((d) => d.status === "reupload_needed").length,
  }), [docReqs]);

  const payoutSummary = useMemo<PayoutSummary>(() => {
    const sum = (statuses: string[]) =>
      payoutRecords.filter((p) => statuses.includes(p.payout_status)).reduce((s, p) => s + (p.payout_amount ?? 0), 0);
    return {
      totalAccrued: payoutRecords.reduce((s, p) => s + (p.payout_amount ?? 0), 0),
      pending: sum(["pending", "triggered"]),
      approved: sum(["approved"]),
      paid: sum(["paid"]),
      recentRecords: payoutRecords.slice(0, 5).map((p) => ({
        id: p.id, leadId: p.lead_id.slice(0, 8) + "…", amount: p.payout_amount, status: p.payout_status, updatedAt: p.updated_at,
      })),
    };
  }, [payoutRecords]);

  const activityItems = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];
    stageHistory.slice(0, 20).forEach((h) => {
      const lead = leads.find((l) => l.id === h.lead_id);
      const stageLabel = h.new_stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      items.push({
        id: `stage-${h.id}`, label: "Stage Changed", leadId: lead?.lead_id ?? null,
        description: `${h.previous_stage ? h.previous_stage.replace(/_/g, " ") : "—"} → ${stageLabel}`,
        timestamp: h.created_at, actor: h.changed_by_role ? h.changed_by_role.replace(/_/g, " ") : "System",
        category: "stage", entityId: lead?.id ?? null,
      });
    });
    notes.filter((n) => n.note_type !== "internal").slice(0, 10).forEach((n) => {
      const lead = leads.find((l) => l.id === n.lead_id);
      items.push({
        id: `note-${n.id}`, label: "Note Added", leadId: lead?.lead_id ?? null,
        description: n.note_text.length > 80 ? n.note_text.slice(0, 80) + "…" : n.note_text,
        timestamp: n.created_at, actor: n.note_type === "system" ? "System" : "Partner",
        category: "note", entityId: lead?.id ?? null,
      });
    });
    batches.slice(0, 5).forEach((b) => {
      items.push({
        id: `bulk-${b.id}`, label: "Bulk Upload", leadId: b.batch_id,
        description: `${b.file_name} — ${b.success_rows} success, ${b.failed_rows} failed`,
        timestamp: b.uploaded_at, actor: "Partner",
        category: "bulk", entityId: null,
      });
    });
    payoutRecords.filter((p) => p.payout_status !== "pending").slice(0, 5).forEach((p) => {
      items.push({
        id: `payout-${p.id}`, label: "Payout Updated", leadId: p.lead_id.slice(0, 8) + "…",
        description: `Status: ${p.payout_status.replace(/_/g, " ")} — ₹${(p.payout_amount ?? 0).toLocaleString("en-IN")}`,
        timestamp: p.updated_at, actor: "System",
        category: "payout", entityId: null,
      });
    });

    return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 20);
  }, [stageHistory, leads, notes, batches, payoutRecords]);

  // KPI click handler
  const handleKPIClick = (key: string) => {
    const routes: Record<string, string> = {
      totalLeads: "/leads",
      leadsThisMonth: "/leads",
      underReview: "/leads?stage=under_initial_review,documents_under_review,bre_evaluated",
      documentsPending: "/leads?stage=documents_pending",
      sentToLender: "/leads?stage=sent_to_lender,login_submitted",
      sanctionReceived: "/leads?stage=sanction_received",
      disbursed: "/leads?stage=disbursed",
      rejectedDropped: "/leads?stage=rejected,dropped",
      bulkBatchesThisMonth: "/bulk-upload",
      pendingPayout: "/payouts?status=pending",
      paidPayout: "/payouts?status=paid",
      needsAttention: "/leads?attention=true",
    };
    const route = routes[key];
    if (route) navigate(route);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <DashboardHeader appUser={appUser} partnerName={partnerName} />

      <DashboardFilters
        filters={filters}
        onChange={setFilters}
        destinations={destinations}
        intakes={intakes}
      />

      <KPICards data={kpiData} loading={loading} onCardClick={handleKPIClick} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PipelineSnapshot stageCounts={stageCounts} loading={loading} />
        </div>
        <PriorityAlerts alerts={alerts} loading={loading} />
      </div>

      <RecentLeads leads={filteredLeads.slice(0, 10)} loading={loading} />

      <div className="grid gap-6 md:grid-cols-2">
        <DocumentSnapshot data={docSummary} loading={loading} />
        <BulkUploadSnapshot batches={batches} loading={loading} />
      </div>

      <PayoutSnapshot data={payoutSummary} loading={loading} />

      <div className="grid gap-6 md:grid-cols-2">
        <ActivityFeed items={activityItems} loading={loading} />
        <QuickActions />
      </div>

      <SystemHelp />
    </div>
  );
}
