import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, ClipboardList } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type EditRequest = Tables<"lead_edit_requests">;
type Lead = Pick<Tables<"student_leads">, "id" | "lead_id" | "student_full_name" | "student_first_name" | "student_last_name">;
type Partner = Pick<Tables<"partner_organizations">, "id" | "display_name">;

type Filter = "pending" | "applied" | "rejected" | "all";

const STATUS_CLS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900 border-amber-300",
  applied: "bg-emerald-100 text-emerald-900 border-emerald-300",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground border-border",
  approved: "bg-emerald-100 text-emerald-900 border-emerald-300",
};

export default function AdminEditRequests() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("pending");
  const [requests, setRequests] = useState<EditRequest[]>([]);
  const [leads, setLeads] = useState<Record<string, Lead>>({});
  const [partners, setPartners] = useState<Record<string, Partner>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("lead_edit_requests").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    const rows = data ?? [];
    setRequests(rows);

    const leadIds = Array.from(new Set(rows.map((r) => r.lead_id)));
    const partnerIds = Array.from(new Set(rows.map((r) => r.partner_id)));
    const [leadsRes, partnersRes] = await Promise.all([
      leadIds.length
        ? supabase.from("student_leads").select("id,lead_id,student_full_name,student_first_name,student_last_name").in("id", leadIds)
        : Promise.resolve({ data: [] as Lead[] } as never),
      partnerIds.length
        ? supabase.from("partner_organizations").select("id,display_name").in("id", partnerIds)
        : Promise.resolve({ data: [] as Partner[] } as never),
    ]);
    const leadMap: Record<string, Lead> = {};
    (leadsRes.data ?? []).forEach((l: Lead) => { leadMap[l.id] = l; });
    setLeads(leadMap);
    const partnerMap: Record<string, Partner> = {};
    (partnersRes.data ?? []).forEach((p: Partner) => { partnerMap[p.id] = p; });
    setPartners(partnerMap);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">Edit Requests</h1>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="applied">Applied</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">{requests.length} request{requests.length !== 1 ? "s" : ""}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No requests in this view.</p>
          ) : (
            <div className="border rounded-md divide-y">
              <div className="grid grid-cols-[1fr_1fr_80px_1fr_140px_60px] gap-3 px-3 py-2 text-[11px] font-medium uppercase text-muted-foreground tracking-wide">
                <span>Lead</span>
                <span>Partner</span>
                <span>Fields</span>
                <span>Reason</span>
                <span>Submitted</span>
                <span></span>
              </div>
              {requests.map((r) => {
                const lead = leads[r.lead_id];
                const partner = partners[r.partner_id];
                const changes = (r.requested_changes ?? {}) as Record<string, unknown>;
                const studentName = lead?.student_full_name ?? `${lead?.student_first_name ?? ""} ${lead?.student_last_name ?? ""}`.trim();
                return (
                  <div key={r.id} className="grid grid-cols-[1fr_1fr_80px_1fr_140px_60px] gap-3 px-3 py-2.5 text-xs items-center hover:bg-muted/30">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{studentName || "—"}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{lead?.lead_id ?? "—"}</p>
                    </div>
                    <span className="truncate">{partner?.display_name ?? "—"}</span>
                    <Badge variant="outline" className={STATUS_CLS[r.status]}>{Object.keys(changes).length} · {r.status}</Badge>
                    <span className="truncate text-muted-foreground" title={r.partner_reason ?? ""}>{r.partner_reason ?? "—"}</span>
                    <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                    <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/leads/${r.lead_id}`)} title="Open lead">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
