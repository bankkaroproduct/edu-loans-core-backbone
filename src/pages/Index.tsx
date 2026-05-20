import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import type { Tables } from "@/integrations/supabase/types";
import { usePartnerContext } from "@/hooks/usePartnerContext";

import { DashboardFilterBar } from "@/components/dashboard/DashboardFilterBar";
import { DashboardStatsTable } from "@/components/dashboard/DashboardStatsTable";
import { YourLeads } from "@/components/dashboard/YourLeads";
import { PayoutSnapshot, type PayoutSummary } from "@/components/dashboard/PayoutSnapshot";
import { SystemHelp } from "@/components/dashboard/SystemHelp";
import { OnboardingEmptyState } from "@/components/dashboard/OnboardingEmptyState";
import {
  DashboardDateFilterProvider,
  useDashboardDateFilter,
} from "@/components/dashboard/DashboardDateFilterContext";

type Lead = Tables<"student_leads">;
type PayoutRecord = Tables<"partner_payout_records">;

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
  const dateCtx = useDashboardDateFilter();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [payoutRecords, setPayoutRecords] = useState<PayoutRecord[]>([]);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  /** IDs of leads (within accessible scope) that have EVER reached sanction_received,
   *  including those subsequently disbursed. Partner-scoped via the inner-join. */
  const [sanctionedEverIds, setSanctionedEverIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      let leadsQ = supabase.from("student_leads").select("*").eq("is_archived", false).order("updated_at", { ascending: false }).limit(500);
      if (effectivePartnerId) leadsQ = leadsQ.eq("partner_id", effectivePartnerId);
      if (agentUserId) leadsQ = leadsQ.eq("partner_user_id", agentUserId);

      const [leadsRes, payoutRes, partnerRes] = await Promise.all([
        leadsQ,
        effectivePartnerId
          ? supabase.from("partner_payout_records").select("*").eq("partner_id", effectivePartnerId).order("created_at", { ascending: false }).limit(100)
          : supabase.from("partner_payout_records").select("*").order("created_at", { ascending: false }).limit(100),
        effectivePartnerId
          ? supabase.from("partner_organizations").select("display_name").eq("id", effectivePartnerId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const fetchedLeads = leadsRes.data ?? [];
      setLeads(fetchedLeads);

      const accessibleLeadIds = new Set(fetchedLeads.map((l) => l.id));

      if (agentUserId || effectivePartnerId) {
        setPayoutRecords((payoutRes.data ?? []).filter((p) => accessibleLeadIds.has(p.lead_id)));
      } else if (payoutRes.data) {
        setPayoutRecords(payoutRes.data);
      }

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

      if (partnerRes.data && "display_name" in partnerRes.data) {
        setPartnerName(partnerRes.data.display_name);
      }
      setLoading(false);
    };
    fetchData();
  }, [effectivePartnerId, agentUserId]);

  // Date-filtered leads — drives both the stats table and (via shared context) YourLeads.
  const filteredLeads = useMemo(
    () => leads.filter((l) => dateCtx.isDateInRange(l.created_at, { updatedIso: l.updated_at })),
    [leads, dateCtx],
  );

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
    <div className="space-y-6 max-w-screen-2xl mx-auto">
      <DashboardFilterBar />

      <DashboardStatsTable
        leads={filteredLeads}
        sanctionedEverIds={sanctionedEverIds}
        loading={loading}
      />

      <div className="space-y-6">
        {isFirstRun && <OnboardingEmptyState partnerName={partnerName} />}

        <YourLeads leads={leads} loading={loading} payouts={payoutRecords} />

        <PayoutSnapshot data={payoutSummary} loading={loading} />

        <SystemHelp />
      </div>
    </div>
  );
}
