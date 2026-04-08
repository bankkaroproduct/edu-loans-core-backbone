import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Tables } from "@/integrations/supabase/types";

type PayoutRecord = Tables<"partner_payout_records">;
type PayoutRule = Tables<"partner_payout_rules">;

const statusColors: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  triggered: "bg-primary/10 text-primary",
  approved: "bg-primary/15 text-primary",
  paid: "bg-primary/20 text-primary",
  reversed: "bg-destructive/10 text-destructive",
  on_hold: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

const fmt = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function Payouts() {
  const [searchParams] = useSearchParams();
  const statusParam = searchParams.get("status");
  const [records, setRecords] = useState<PayoutRecord[]>([]);
  const [rules, setRules] = useState<PayoutRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>(statusParam ?? "all");

  useEffect(() => {
    const load = async () => {
      const [r, ru] = await Promise.all([
        supabase.from("partner_payout_records").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("partner_payout_rules").select("*").eq("active_flag", true).order("created_at", { ascending: false }),
      ]);
      setRecords(r.data ?? []);
      setRules(ru.data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const filteredRecords = statusFilter === "all"
    ? records
    : records.filter((r) => r.payout_status === statusFilter);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Payouts</h1>

      <Tabs defaultValue="records">
        <TabsList>
          <TabsTrigger value="records">Payout Records</TabsTrigger>
          <TabsTrigger value="rules">Payout Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="records">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Payout Records</CardTitle>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="triggered">Triggered</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="reversed">Reversed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center py-8 text-muted-foreground">Loading...</p>
              ) : filteredRecords.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No payout records found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Triggered</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-sm">{r.lead_id.slice(0, 8)}...</TableCell>
                        <TableCell>{r.payout_amount ? `₹${Number(r.payout_amount).toLocaleString()}` : "—"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={statusColors[r.payout_status] ?? ""}>{fmt(r.payout_status)}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.payout_triggered_at ? new Date(r.payout_triggered_at).toLocaleDateString() : "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.payout_paid_at ? new Date(r.payout_paid_at).toLocaleDateString() : "—"}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">{r.remarks ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules">
          <Card>
            <CardHeader><CardTitle className="text-lg">Active Payout Rules</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center py-8 text-muted-foreground">Loading...</p>
              ) : rules.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No active payout rules</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Basis</TableHead>
                      <TableHead>Amount / %</TableHead>
                      <TableHead>Trigger Stage</TableHead>
                      <TableHead>Effective From</TableHead>
                      <TableHead>Effective To</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{fmt(r.payout_basis)}</TableCell>
                        <TableCell>
                          {r.payout_amount ? `₹${Number(r.payout_amount).toLocaleString()}` : ""}
                          {r.payout_percent ? `${r.payout_percent}%` : ""}
                        </TableCell>
                        <TableCell>{fmt(r.payout_trigger_stage)}</TableCell>
                        <TableCell className="text-sm">{r.effective_from}</TableCell>
                        <TableCell className="text-sm">{r.effective_to ?? "Ongoing"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
