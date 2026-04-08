import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";

import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { KPICards, type KPIData } from "@/components/dashboard/KPICards";
import { PipelineSnapshot } from "@/components/dashboard/PipelineSnapshot";
import { PriorityAlerts, type AlertItem } from "@/components/dashboard/PriorityAlerts";
import { RecentLeads } from "@/components/dashboard/RecentLeads";
import { DocumentSnapshot, type DocSummary } from "@/components/dashboard/DocumentSnapshot";
import { BulkUploadSnapshot } from "@/components/dashboard/BulkUploadSnapshot";
import { PayoutSnapshot, type PayoutSummary } from "@/components/dashboard/PayoutSnapshot";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { ActivityFeed, type ActivityItem } from "@/components/dashboard/ActivityFeed";

type Lead = Tables<"student_leads">;
type Batch = Tables<"bulk_upload_batches">;
type PayoutRecord = Tables<"partner_payout_records">;
type DocReq = Tables<"lead_document_requirements">;
type StageHistory = Tables<"lead_stage_history">;

export default function Dashboard() {
  const { appUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [payoutRecords, setPayoutRecords] = useState<PayoutRecord[]>([]);
  const [docReqs, setDocReqs] = useState<DocReq[]>([]);
  const [stageHistory, setStageHistory] = useState<StageHistory[]>([]);
  const [partnerName, setPartnerName] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      // Fetch all data in parallel — RLS scopes automatically
      const [leadsRes, batchRes, payoutRes, docReqRes, historyRes, partnerRes] = await Promise.all([
        supabase.from("student_leads").select("*").eq("is_archived", false).order("updated_at", { ascending: false }).limit(200),
        supabase.from("bulk_upload_batches").select("*").order("uploaded_at", { ascending: false }).limit(10),
        supabase.from("partner_payout_records").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("lead_document_requirements").select("*").limit(500),
        supabase.from("lead_stage_history").select("*").order("created_at", { ascending: false }).limit(30),
        appUser?.partner_id
          ? supabase.from("partner_organizations").select("display_name").eq("id", appUser.partner_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      if (leadsRes.data) setLeads(leadsRes.data);
      if (batchRes.data) setBatches(batchRes.data);
      if (payoutRes.data) setPayoutRecords(payoutRes.data);
      if (docReqRes.data) setDocReqs(docReqRes.data);
      if (historyRes.data) setStageHistory(historyRes.data);
      if (partnerRes.data && "display_name" in partnerRes.data) {
        setPartnerName(partnerRes.data.display_name);
      }
      setLoading(false);
    };
    fetch();
  }, [appUser?.partner_id]);

  // KPI calculations
  const kpiData = useMemo<KPIData>(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const reviewStages = ["under_initial_review", "documents_under_review", "bre_evaluated"];
    const pendingPayout = payoutRecords.filter((p) => p.payout_status === "pending" || p.payout_status === "triggered");
    const paidPayout = payoutRecords.filter((p) => p.payout_status === "paid");

    const docsNeedingAction = docReqs.filter((d) =>
      ["not_uploaded", "reupload_needed"].includes(d.status)
    );

    const needsAttention = leads.filter((l) =>
      l.current_stage === "on_hold" ||
      l.current_stage === "documents_pending" ||
      l.current_status === "reupload_needed" ||
      l.current_status === "pending_info"
    );

    return {
      totalLeads: leads.length,
      leadsThisMonth: leads.filter((l) => l.created_at >= monthStart).length,
      underReview: leads.filter((l) => reviewStages.includes(l.current_stage)).length,
      documentsPending: docsNeedingAction.length,
      sentToLender: leads.filter((l) => ["sent_to_lender", "login_submitted"].includes(l.current_stage)).length,
      sanctionReceived: leads.filter((l) => l.current_stage === "sanction_received").length,
      disbursed: leads.filter((l) => l.current_stage === "disbursed").length,
      rejectedDropped: leads.filter((l) => ["rejected", "dropped"].includes(l.current_stage)).length,
      bulkBatchesThisMonth: batches.filter((b) => b.uploaded_at >= monthStart).length,
      pendingPayout: pendingPayout.reduce((s, p) => s + (p.payout_amount ?? 0), 0),
      paidPayout: paidPayout.reduce((s, p) => s + (p.payout_amount ?? 0), 0),
      needsAttention: needsAttention.length,
    };
  }, [leads, batches, payoutRecords, docReqs]);

  // Pipeline counts
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach((l) => {
      counts[l.current_stage] = (counts[l.current_stage] ?? 0) + 1;
    });
    return counts;
  }, [leads]);

  // Priority alerts
  const alerts = useMemo<AlertItem[]>(() => {
    const items: AlertItem[] = [];

    // Leads on hold
    leads.filter((l) => l.current_stage === "on_hold").forEach((l) => {
      items.push({
        id: `hold-${l.id}`,
        leadId: l.lead_id,
        studentName: l.student_full_name ?? l.student_first_name,
        reason: "Lead is on hold — may need clarification",
        category: "on_hold",
        updatedAt: l.updated_at,
        entityId: l.id,
      });
    });

    // Leads with documents pending
    leads.filter((l) => l.current_stage === "documents_pending").forEach((l) => {
      items.push({
        id: `docs-${l.id}`,
        leadId: l.lead_id,
        studentName: l.student_full_name ?? l.student_first_name,
        reason: "Documents pending — upload required",
        category: "docs_pending",
        updatedAt: l.updated_at,
        entityId: l.id,
      });
    });

    // Leads needing reupload
    leads.filter((l) => l.current_status === "reupload_needed").forEach((l) => {
      items.push({
        id: `reup-${l.id}`,
        leadId: l.lead_id,
        studentName: l.student_full_name ?? l.student_first_name,
        reason: "Document reupload needed",
        category: "reupload",
        updatedAt: l.updated_at,
        entityId: l.id,
      });
    });

    // Failed bulk uploads
    batches.filter((b) => b.failed_rows > 0).forEach((b) => {
      items.push({
        id: `batch-${b.id}`,
        leadId: b.batch_id,
        studentName: b.file_name,
        reason: `${b.failed_rows} of ${b.total_rows} rows failed`,
        category: "upload_error",
        updatedAt: b.uploaded_at,
        entityId: b.id,
      });
    });

    return items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [leads, batches]);

  // Document summary
  const docSummary = useMemo<DocSummary>(() => ({
    pending: docReqs.filter((d) => d.status === "not_uploaded").length,
    underReview: docReqs.filter((d) => d.status === "under_review").length,
    verified: docReqs.filter((d) => d.status === "verified").length,
    rejected: docReqs.filter((d) => d.status === "rejected").length,
    reuploadNeeded: docReqs.filter((d) => d.status === "reupload_needed").length,
  }), [docReqs]);

  // Payout summary
  const payoutSummary = useMemo<PayoutSummary>(() => {
    const sum = (statuses: string[]) =>
      payoutRecords.filter((p) => statuses.includes(p.payout_status)).reduce((s, p) => s + (p.payout_amount ?? 0), 0);

    return {
      totalAccrued: payoutRecords.reduce((s, p) => s + (p.payout_amount ?? 0), 0),
      pending: sum(["pending", "triggered"]),
      approved: sum(["approved"]),
      paid: sum(["paid"]),
      recentRecords: payoutRecords.slice(0, 5).map((p) => ({
        id: p.id,
        leadId: p.lead_id.slice(0, 8) + "…",
        amount: p.payout_amount,
        status: p.payout_status,
        updatedAt: p.updated_at,
      })),
    };
  }, [payoutRecords]);

  // Activity feed from stage history
  const activityItems = useMemo<ActivityItem[]>(() => {
    return stageHistory.slice(0, 15).map((h) => {
      const lead = leads.find((l) => l.id === h.lead_id);
      const stageLabel = h.new_stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      return {
        id: h.id,
        label: "Stage Changed",
        leadId: lead?.lead_id ?? null,
        description: `${h.previous_stage ? h.previous_stage.replace(/_/g, " ") : "—"} → ${stageLabel}`,
        timestamp: h.created_at,
        actor: h.changed_by_role ? h.changed_by_role.replace(/_/g, " ") : "System",
      };
    });
  }, [stageHistory, leads]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <DashboardHeader appUser={appUser} partnerName={partnerName} />
      <KPICards data={kpiData} loading={loading} />
      
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PipelineSnapshot stageCounts={stageCounts} loading={loading} />
        </div>
        <PriorityAlerts alerts={alerts} loading={loading} />
      </div>

      <RecentLeads leads={leads.slice(0, 10)} loading={loading} />

      <div className="grid gap-6 md:grid-cols-2">
        <DocumentSnapshot data={docSummary} loading={loading} />
        <BulkUploadSnapshot batches={batches} loading={loading} />
      </div>

      <PayoutSnapshot data={payoutSummary} loading={loading} />

      <div className="grid gap-6 md:grid-cols-2">
        <ActivityFeed items={activityItems} loading={loading} />
        <QuickActions />
      </div>
    </div>
  );
}
