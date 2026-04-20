import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import type { Tables } from "@/integrations/supabase/types";
import { usePartnerContext } from "@/hooks/usePartnerContext";

import { HeroPerformanceStrip, type LoanMetric, type SecondaryLoanMetric } from "@/components/dashboard/HeroPerformanceStrip";
import type { KPIData } from "@/components/dashboard/KPICards";
import { YourLeads } from "@/components/dashboard/YourLeads";
import { DocumentSnapshot, type DocSummary } from "@/components/dashboard/DocumentSnapshot";
import { BulkUploadSnapshot } from "@/components/dashboard/BulkUploadSnapshot";
import { PayoutSnapshot, type PayoutSummary } from "@/components/dashboard/PayoutSnapshot";
import { SystemHelp } from "@/components/dashboard/SystemHelp";
import { OnboardingEmptyState } from "@/components/dashboard/OnboardingEmptyState";

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
    const pendingPayout = payoutRecords.filter((p) => p.payout_status === "pending" || p.payout_status === "triggered");
    const paidPayout = payoutRecords.filter((p) => p.payout_status === "paid");
    const needsAttention = leads.filter((l) =>
      l.current_stage === "on_hold" || l.current_stage === "documents_pending" ||
      l.current_status === "reupload_needed" || l.current_status === "pending_info"
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
      pendingPayout: pendingPayout.reduce((s, p) => s + (p.payout_amount ?? 0), 0),
      paidPayout: paidPayout.reduce((s, p) => s + (p.payout_amount ?? 0), 0),
      needsAttention: needsAttention.length,
    };
  }, [leads, payoutRecords]);

  // Loan metrics for hero — independent of any UI filter, partner-scoped via RLS.
  // Active = exclude draft, disbursed, rejected, dropped.
  const loanMetrics = useMemo<LoanMetric[]>(() => {
    const excludedActive = new Set(["draft", "disbursed", "rejected", "dropped"]);
    const sumAmount = (rows: Lead[]) => rows.reduce((s, l) => s + (l.loan_amount_required ?? 0), 0);

    const active = leads.filter((l) => !excludedActive.has(l.current_stage));
    const sanctioned = leads.filter((l) => l.current_stage === "sanction_received");
    const disbursed = leads.filter((l) => l.current_stage === "disbursed");

    return [
      { key: "active", label: "Total Loan Active", count: active.length, amount: sumAmount(active) },
      { key: "sanctioned", label: "Total Loan Sanctioned", count: sanctioned.length, amount: sumAmount(sanctioned) },
      { key: "disbursed", label: "Total Disbursed", count: disbursed.length, amount: sumAmount(disbursed) },
    ];
  }, [leads]);

  // Secondary loan metrics — visually de-emphasized supporting context
  const secondaryLoanMetrics = useMemo<SecondaryLoanMetric[]>(() => {
    const sumAmount = (rows: Lead[]) => rows.reduce((s, l) => s + (l.loan_amount_required ?? 0), 0);
    const rejected = leads.filter((l) => ["rejected", "dropped"].includes(l.current_stage));

    const sumPayout = (statuses: string[]) =>
      payoutRecords
        .filter((p) => statuses.includes(p.payout_status))
        .reduce((s, p) => s + (p.payout_amount ?? 0), 0);
    const countPayout = (statuses: string[]) =>
      payoutRecords.filter((p) => statuses.includes(p.payout_status)).length;

    return [
      { key: "rejected", label: "Total Loan Rejected", count: rejected.length, amount: sumAmount(rejected) },
      { key: "payout_released", label: "Total Payout Released", count: countPayout(["paid"]), amount: sumPayout(["paid"]) },
      { key: "payout_pending", label: "Pending Payout", count: countPayout(["pending", "triggered"]), amount: sumPayout(["pending", "triggered"]) },
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

  return (
    <div className="space-y-5 max-w-screen-2xl mx-auto">
      <HeroPerformanceStrip
        appUser={appUser}
        partnerName={partnerName}
        kpiData={kpiData}
        loanMetrics={loanMetrics}
        secondaryLoanMetrics={secondaryLoanMetrics}
        loading={loading}
      />

      <div className="space-y-5">
        {isFirstRun && <OnboardingEmptyState partnerName={partnerName} />}

        <YourLeads leads={leads} loading={loading} />

        <div className="grid gap-5 md:grid-cols-2">
          <DocumentSnapshot data={docSummary} loading={loading} />
          <BulkUploadSnapshot batches={batches} loading={loading} />
        </div>

        <PayoutSnapshot data={payoutSummary} loading={loading} />

        <SystemHelp />
      </div>
    </div>
  );
}
