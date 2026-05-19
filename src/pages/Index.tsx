import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import type { Tables } from "@/integrations/supabase/types";
import { usePartnerContext } from "@/hooks/usePartnerContext";

import { HeroPerformanceStrip, type LoanMetric, type SecondaryLoanMetric } from "@/components/dashboard/HeroPerformanceStrip";
import { HeroDrillPanel } from "@/components/dashboard/HeroDrillPanel";
import type { CardKey, DrilldownData } from "@/lib/dashboardDrilldowns";
import type { KPIData } from "@/components/dashboard/KPICards";
import { YourLeads } from "@/components/dashboard/YourLeads";
type DocSummary = { pending: number; underReview: number; verified: number; rejected: number; reuploadNeeded: number; };
import { PayoutSnapshot, type PayoutSummary } from "@/components/dashboard/PayoutSnapshot";
import { SystemHelp } from "@/components/dashboard/SystemHelp";
import { OnboardingEmptyState } from "@/components/dashboard/OnboardingEmptyState";
import {
  DashboardDateFilterProvider,
  useDashboardDateFilter,
} from "@/components/dashboard/DashboardDateFilterContext";

type Lead = Tables<"student_leads">;
type Batch = Tables<"bulk_upload_batches">;
type PayoutRecord = Tables<"partner_payout_records">;
type DocReq = Tables<"lead_document_requirements">;
type StageHistory = Tables<"lead_stage_history">;
type Note = Tables<"lead_notes">;

export default function Dashboard() {
  return (
    <DashboardDateFilterProvider>
      <PartnerDashboardContent />
    </DashboardDateFilterProvider>
  );
}

function PartnerDashboardContent() {
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
  /** IDs of leads (within accessible scope) that have EVER reached sanction_received,
   *  including those subsequently disbursed. Cumulative; partner-scoped via the
   *  inner-join on student_leads.partner_id. */
  const [sanctionedEverIds, setSanctionedEverIds] = useState<Set<string>>(new Set());
  const [activeCard, setActiveCard] = useState<CardKey | null>(null);
  const [lenderNameById, setLenderNameById] = useState<Map<string, string>>(new Map());
  const [ruleLenderById, setRuleLenderById] = useState<Map<string, string | null>>(new Map());
  const [lockedLenderByLeadId, setLockedLenderByLeadId] = useState<Map<string, string>>(new Map());
  const [stageLabelByKey, setStageLabelByKey] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
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

      if (agentUserId || effectivePartnerId) {
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

      // Cumulative "ever sanctioned" — partner-scoped by intersecting with
      // accessibleLeadIds. Includes leads currently AT sanction_received AND
      // those that already moved on to disbursed. This is the only correct
      // way to ensure sanctioned_count >= disbursed_count.
      if (accessibleLeadIds.size > 0) {
        const { data: sanctRows } = await supabase
          .from("lead_stage_history")
          .select("lead_id")
          .eq("new_stage", "sanction_received")
          .in("lead_id", Array.from(accessibleLeadIds));
        setSanctionedEverIds(new Set((sanctRows ?? []).map((r) => r.lead_id)));
      } else {
        setSanctionedEverIds(new Set());
      }

      // === Drilldown support fetches ===
      // 1. Lenders master (RLS: any authenticated user can read).
      // 2. partner_payout_rules (RLS: partners scoped to own org; admin sees all — scope explicitly).
      // 3. lead_lender_matches with lock_status=true for accessible leads (intersected client-side).
      // 4. lifecycle_stage_master labels.
      let rulesQ = supabase.from("partner_payout_rules").select("id, lender_id");
      if (effectivePartnerId) rulesQ = rulesQ.eq("partner_id", effectivePartnerId);

      const [lendersRes, rulesRes, stagesRes, lockedRes] = await Promise.all([
        supabase.from("lenders").select("id, lender_name"),
        rulesQ,
        supabase.from("lifecycle_stage_master").select("stage_key, stage_label"),
        accessibleLeadIds.size > 0
          ? supabase
              .from("lead_lender_matches")
              .select("lead_id, lender_id, lock_status")
              .eq("lock_status", true)
              .in("lead_id", Array.from(accessibleLeadIds))
          : Promise.resolve({ data: [] as Array<{ lead_id: string; lender_id: string; lock_status: boolean }> }),
      ]);
      setLenderNameById(new Map((lendersRes.data ?? []).map((l) => [l.id, l.lender_name])));
      setRuleLenderById(new Map((rulesRes.data ?? []).map((r) => [r.id, r.lender_id])));
      setStageLabelByKey(new Map((stagesRes.data ?? []).map((s) => [s.stage_key, s.stage_label])));
      setLockedLenderByLeadId(new Map((lockedRes.data ?? []).map((m) => [m.lead_id, m.lender_id])));

      if (partnerRes.data && "display_name" in partnerRes.data) {
        setPartnerName(partnerRes.data.display_name);
      }
      setLoading(false);
    };
    fetchData();
  }, [effectivePartnerId, agentUserId]);

  // Slim KPI memo — only fields the HeroPerformanceStrip consumes
  // (paidPayout, pendingPayout, needsAttention). KPICards block was removed.
  const kpiData = useMemo<KPIData>(() => {
    // "Pending Payout" (top hero) = AMOUNT awaiting release: pending + triggered + approved-not-yet-paid.
    // We treat 'approved' as still-pending from the partner's POV (it's been
    // accrued but not released to them yet).
    const pendingPayoutRecs = payoutRecords.filter(
      (p) => p.payout_status === "pending" || p.payout_status === "triggered" || p.payout_status === "approved",
    );
    // "Total Earned" = COMMISSION ACCRUED across all non-reversed states.
    // Distinguishes accrued (earned) from released (paid). Without this,
    // disbursed leads with approved-but-unpaid commissions would silently
    // show ₹0 earned — exactly the bug reported.
    const earnedRecs = payoutRecords.filter(
      (p) => p.payout_status === "pending" || p.payout_status === "triggered" ||
             p.payout_status === "approved" || p.payout_status === "paid",
    );
    // "Needs Attention" — must reconcile EXACTLY with the Leads page
    // `?attention=true` filter (see src/pages/Leads.tsx:needsAttention).
    // ATTENTION_STAGES = on_hold, documents_pending, credit_query
    // ATTENTION_STATUSES = pending_info, reupload_needed, query_raised
    // PLUS duplicate_flag.
    const ATTENTION_STAGES = new Set(["on_hold", "documents_pending", "credit_query"]);
    const ATTENTION_STATUSES = new Set(["pending_info", "reupload_needed", "query_raised"]);
    const needsAttention = leads.filter(
      (l) =>
        ATTENTION_STAGES.has(l.current_stage) ||
        ATTENTION_STATUSES.has(l.current_status) ||
        l.duplicate_flag === true,
    );

    return {
      totalLeads: 0,
      leadsThisMonth: 0,
      underReview: 0,
      documentsPending: 0,
      sentToLender: 0,
      sanctionReceived: 0,
      disbursed: 0,
      rejectedDropped: 0,
      bulkBatchesThisMonth: 0,
      pendingPayout: pendingPayoutRecs.reduce((s, p) => s + (p.payout_amount ?? 0), 0),
      paidPayout: earnedRecs.reduce((s, p) => s + (p.payout_amount ?? 0), 0),
      needsAttention: needsAttention.length,
    };
  }, [leads, payoutRecords]);

  // Loan metrics for hero — independent of any UI filter, partner-scoped via RLS.
  // Active = strictly: in-pipeline submitted leads. Excludes drafts (not yet
  // submitted), terminal stages (disbursed/rejected/dropped), AND sanctioned
  // (shown separately in its own card).
  const loanMetrics = useMemo<LoanMetric[]>(() => {
    const excludedActive = new Set([
      "draft", "disbursed", "rejected", "dropped", "sanction_received",
    ]);
    const sumAmount = (rows: Lead[]) => rows.reduce((s, l) => s + (l.loan_amount_required ?? 0), 0);

    const active = leads.filter((l) => !excludedActive.has(l.current_stage));
    // Cumulative: leads currently AT sanction_received UNION leads that EVER
    // reached sanction_received (including those subsequently disbursed).
    // Guarantees sanctioned_count >= disbursed_count.
    const sanctioned = leads.filter(
      (l) => l.current_stage === "sanction_received" || sanctionedEverIds.has(l.id),
    );
    const disbursed = leads.filter((l) => l.current_stage === "disbursed");

    return [
      { key: "active", label: "Total Loan Active", count: active.length, amount: sumAmount(active) },
      { key: "sanctioned", label: "Total Loan Sanctioned", count: sanctioned.length, amount: sumAmount(sanctioned) },
      { key: "disbursed", label: "Total Disbursed", count: disbursed.length, amount: sumAmount(disbursed) },
    ];
  }, [leads, sanctionedEverIds]);

  // Secondary loan/payout metrics — visually de-emphasized supporting context.
  // Note: top-row "Pending Payout" shows AMOUNT; this row's "Pending Payout
  // Records" shows COUNT (same underlying record set, different aggregation).
  const secondaryLoanMetrics = useMemo<SecondaryLoanMetric[]>(() => {
    const sumAmount = (rows: Lead[]) => rows.reduce((s, l) => s + (l.loan_amount_required ?? 0), 0);
    const rejected = leads.filter((l) => ["rejected", "dropped"].includes(l.current_stage));

    const sumPayout = (statuses: string[]) =>
      payoutRecords
        .filter((p) => statuses.includes(p.payout_status))
        .reduce((s, p) => s + (p.payout_amount ?? 0), 0);
    const countPayout = (statuses: string[]) =>
      payoutRecords.filter((p) => statuses.includes(p.payout_status)).length;

    const pendingStatuses = ["pending", "triggered", "approved"];

    return [
      { key: "rejected", label: "Total Loan Rejected", count: rejected.length, amount: sumAmount(rejected) },
      { key: "payout_released", label: "Total Payout Released", count: countPayout(["paid"]), amount: sumPayout(["paid"]) },
      { key: "payout_pending", label: "Pending Payout Records", count: countPayout(pendingStatuses), amount: sumPayout(pendingStatuses) },
    ];
  }, [leads, payoutRecords]);

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
      reversed: sum(["reversed"]),
      recentRecords: payoutRecords.slice(0, 5).map((p) => ({
        id: p.id, leadId: p.lead_id, amount: p.payout_amount, status: p.payout_status, updatedAt: p.updated_at,
      })),
    };
  }, [payoutRecords]);

  const isFirstRun = !loading && leads.length === 0;

  const drilldownData: DrilldownData = useMemo(
    () => ({
      leads,
      payoutRecords,
      docReqs,
      sanctionedEverIds,
      lenderNameById,
      ruleLenderById,
      lockedLenderByLeadId,
      stageLabelByKey,
    }),
    [leads, payoutRecords, docReqs, sanctionedEverIds, lenderNameById, ruleLenderById, lockedLenderByLeadId, stageLabelByKey],
  );

  return (
    <div className="space-y-6 max-w-screen-2xl mx-auto">
      <HeroPerformanceStrip
        kpiData={kpiData}
        loanMetrics={loanMetrics}
        secondaryLoanMetrics={secondaryLoanMetrics}
        loading={loading}
        onCardClick={setActiveCard}
      />

      <HeroDrillPanel cardKey={activeCard} data={drilldownData} onClose={() => setActiveCard(null)} />

      <div className="space-y-6">
        {isFirstRun && <OnboardingEmptyState partnerName={partnerName} />}

        <YourLeads leads={leads} loading={loading} payouts={payoutRecords} />

        <PayoutSnapshot data={payoutSummary} loading={loading} />

        <SystemHelp />
      </div>
    </div>
  );
}
