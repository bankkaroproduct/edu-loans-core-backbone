import { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/integrations/supabase/types";
import { usePartnerContext } from "@/hooks/usePartnerContext";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { PayoutSummaryCards, type PayoutMetrics } from "@/components/payouts/PayoutSummaryCards";
import { PayoutFilters } from "@/components/payouts/PayoutFilters";
import { PayoutRecordsTable, type PayoutRecordRow, type SortField, type SortDir } from "@/components/payouts/PayoutRecordsTable";
import { PayoutStatusLegend } from "@/components/payouts/PayoutStatusLegend";
import { PayoutEmptyState } from "@/components/payouts/PayoutEmptyState";

type PayoutRecord = Tables<"partner_payout_records">;
type PayoutRule = Tables<"partner_payout_rules">;

const fmt = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function Payouts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { effectivePartnerId } = usePartnerContext();
  const { agentUserId } = useRoleAccess();

  const [records, setRecords] = useState<PayoutRecord[]>([]);
  const [leadMap, setLeadMap] = useState<Record<string, { lead_id: string | null; student_full_name: string | null; current_stage: string; partner_user_id: string | null }>>({});
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [ruleMap, setRuleMap] = useState<Record<string, PayoutRule>>({});
  const [rules, setRules] = useState<PayoutRule[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters synced with URL
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "all");
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") ?? "");
  const [dateFrom, setDateFrom] = useState(searchParams.get("from") ?? "");
  const [dateTo, setDateTo] = useState(searchParams.get("to") ?? "");
  const leadFilter = searchParams.get("lead");

  // Sort
  const [sortField, setSortField] = useState<SortField>("updated_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Sync filters to URL
  useEffect(() => {
    const p: Record<string, string> = {};
    if (statusFilter !== "all") p.status = statusFilter;
    if (searchTerm) p.search = searchTerm;
    if (dateFrom) p.from = dateFrom;
    if (dateTo) p.to = dateTo;
    if (leadFilter) p.lead = leadFilter;
    setSearchParams(p, { replace: true });
  }, [statusFilter, searchTerm, dateFrom, dateTo]);

  // Load data
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let recQ = supabase.from("partner_payout_records").select("*").order("updated_at", { ascending: false }).limit(500);
      if (effectivePartnerId) recQ = recQ.eq("partner_id", effectivePartnerId);

      let ruleQ = supabase.from("partner_payout_rules").select("*").eq("active_flag", true).order("created_at", { ascending: false });
      if (effectivePartnerId) ruleQ = ruleQ.eq("partner_id", effectivePartnerId);

      const [recRes, ruleRes] = await Promise.all([recQ, ruleQ]);
      const recs = recRes.data ?? [];
      const rls = ruleRes.data ?? [];

      setRecords(recs);
      setRules(rls);

      // Build rule map
      const rm: Record<string, PayoutRule> = {};
      rls.forEach((r) => { rm[r.id] = r; });
      setRuleMap(rm);

      // Fetch linked leads
      const leadIds = [...new Set(recs.map((r) => r.lead_id))];
      if (leadIds.length > 0) {
        // Agent scoping: if agent, they can only see leads they submitted — RLS handles this
        const { data: leads } = await supabase
          .from("student_leads")
          .select("id, lead_id, student_full_name, current_stage")
          .in("id", leadIds);
        const lm: typeof leadMap = {};
        (leads ?? []).forEach((l) => { lm[l.id] = l; });
        setLeadMap(lm);

        // If agent, filter records to only leads they can see (RLS already does this, but belt-and-suspenders)
        if (agentUserId) {
          const visibleLeadIds = new Set(Object.keys(lm));
          setRecords(recs.filter((r) => visibleLeadIds.has(r.lead_id)));
        }
      }

      setLoading(false);
    };
    load();
  }, [effectivePartnerId, agentUserId]);

  // Compute metrics
  const metrics: PayoutMetrics = useMemo(() => {
    const m: PayoutMetrics = { totalAccrued: 0, pending: 0, approved: 0, paid: 0, reversed: 0, contributingLeads: 0 };
    const leadSet = new Set<string>();
    records.forEach((r) => {
      const amt = r.payout_amount ? Number(r.payout_amount) : 0;
      if (r.payout_status !== "cancelled") m.totalAccrued += amt;
      if (r.payout_status === "pending" || r.payout_status === "triggered") m.pending += amt;
      if (r.payout_status === "approved") m.approved += amt;
      if (r.payout_status === "paid") m.paid += amt;
      if (r.payout_status === "reversed") { m.reversed += amt; m.totalAccrued -= amt * 2; }
      leadSet.add(r.lead_id);
    });
    m.contributingLeads = leadSet.size;
    return m;
  }, [records]);

  // Build enriched rows
  const enrichedRows: PayoutRecordRow[] = useMemo(() => {
    return records.map((r) => {
      const lead = leadMap[r.lead_id];
      const rule = r.payout_rule_id ? ruleMap[r.payout_rule_id] : null;
      return {
        id: r.id,
        lead_id: r.lead_id,
        lead_display_id: lead?.lead_id ?? null,
        student_name: lead?.student_full_name ?? null,
        trigger_stage: rule?.payout_trigger_stage ?? null,
        payout_basis: rule?.payout_basis ?? null,
        payout_amount: r.payout_amount ? Number(r.payout_amount) : null,
        payout_status: r.payout_status,
        payout_triggered_at: r.payout_triggered_at,
        payout_approved_at: r.payout_approved_at,
        payout_paid_at: r.payout_paid_at,
        remarks: r.remarks,
        updated_at: r.updated_at,
      };
    });
  }, [records, leadMap, ruleMap]);

  // Filter
  const filteredRows = useMemo(() => {
    let rows = enrichedRows;
    if (statusFilter !== "all") {
      if (statusFilter === "reversed") {
        rows = rows.filter((r) => r.payout_status === "reversed" || r.payout_status === "cancelled");
      } else {
        rows = rows.filter((r) => r.payout_status === statusFilter);
      }
    }
    if (leadFilter) rows = rows.filter((r) => r.lead_id === leadFilter);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter((r) =>
        (r.lead_display_id?.toLowerCase().includes(q)) ||
        (r.student_name?.toLowerCase().includes(q)) ||
        (r.lead_id.toLowerCase().includes(q))
      );
    }
    if (dateFrom) {
      const d = new Date(dateFrom);
      rows = rows.filter((r) => new Date(r.updated_at) >= d);
    }
    if (dateTo) {
      const d = new Date(dateTo);
      d.setDate(d.getDate() + 1);
      rows = rows.filter((r) => new Date(r.updated_at) < d);
    }
    return rows;
  }, [enrichedRows, statusFilter, searchTerm, dateFrom, dateTo, leadFilter]);

  // Sort
  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows];
    sorted.sort((a, b) => {
      let cmp = 0;
      if (sortField === "updated_at") cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      else if (sortField === "payout_amount") cmp = (a.payout_amount ?? 0) - (b.payout_amount ?? 0);
      else if (sortField === "payout_status") cmp = a.payout_status.localeCompare(b.payout_status);
      return sortDir === "desc" ? -cmp : cmp;
    });
    return sorted;
  }, [filteredRows, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const handleCardFilter = (status: string | null) => {
    if (status === null) setStatusFilter("all");
    else if (status === "pending") setStatusFilter("pending");
    else setStatusFilter(status);
  };

  const hasActiveFilters = statusFilter !== "all" || !!searchTerm || !!dateFrom || !!dateTo || !!leadFilter;

  const clearAll = () => {
    setStatusFilter("all");
    setSearchTerm("");
    setDateFrom("");
    setDateTo("");
    setSearchParams({}, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Payouts & Earnings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track partner earnings and payout status by lead milestone. Pending payouts move to paid once eligible milestones are reached and settlement is completed.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[90px]" />)}
          </div>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      ) : (
        <Tabs defaultValue="records">
          <TabsList>
            <TabsTrigger value="records">Payout Records</TabsTrigger>
            <TabsTrigger value="rules">Payout Rules</TabsTrigger>
          </TabsList>

          <TabsContent value="records" className="space-y-4 mt-4">
            <PayoutSummaryCards
              metrics={metrics}
              onFilterStatus={handleCardFilter}
              activeStatus={statusFilter === "all" ? null : statusFilter}
            />

            <PayoutFilters
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              dateFrom={dateFrom}
              onDateFromChange={setDateFrom}
              dateTo={dateTo}
              onDateToChange={setDateTo}
              onClearAll={clearAll}
              hasActiveFilters={hasActiveFilters}
            />

            <PayoutStatusLegend />

            <Card>
              <CardContent className="p-0">
                {sortedRows.length === 0 ? (
                  <PayoutEmptyState hasFilters={hasActiveFilters} onClearFilters={clearAll} />
                ) : (
                  <PayoutRecordsTable
                    records={sortedRows}
                    sortField={sortField}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                )}
              </CardContent>
            </Card>

            {sortedRows.length > 0 && (
              <p className="text-xs text-muted-foreground text-right">
                Showing {sortedRows.length} of {records.length} records
              </p>
            )}
          </TabsContent>

          <TabsContent value="rules">
            <Card>
              <CardHeader><CardTitle className="text-lg">Active Payout Rules</CardTitle></CardHeader>
              <CardContent>
                {rules.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No active payout rules configured.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Basis</TableHead>
                        <TableHead>Amount / %</TableHead>
                        <TableHead>Trigger Stage</TableHead>
                        <TableHead>Effective From</TableHead>
                        <TableHead>Effective To</TableHead>
                        <TableHead>Clawback</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rules.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{fmt(r.payout_basis)}</TableCell>
                          <TableCell>
                            {r.payout_amount ? `₹${Number(r.payout_amount).toLocaleString("en-IN")}` : ""}
                            {r.payout_percent ? ` ${r.payout_percent}%` : ""}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">{fmt(r.payout_trigger_stage)}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">{r.effective_from}</TableCell>
                          <TableCell className="text-sm">{r.effective_to ?? "Ongoing"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{r.clawback_rule ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
