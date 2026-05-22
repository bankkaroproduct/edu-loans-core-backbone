import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { CommunicationLogTable } from "@/components/admin/communications/CommunicationLogTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/EmptyState";
import { useAdminLeadScope } from "@/hooks/useAdminLeadScope";
import type { CommunicationLog } from "@/lib/communications/types";

export default function AdminCommunicationLogs() {
  const { ready, isSuperAdmin, scopedPartnerIds, hasNoScope } = useAdminLeadScope();
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [channel, setChannel] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [mode, setMode] = useState<string>("all");

  useEffect(() => {
    if (!ready) return;
    if (hasNoScope) {
      setLogs([]);
      return;
    }
    let cancelled = false;
    (async () => {
      // For non-super admins, first resolve the lead ids belonging to their
      // assigned partners (incl. PTR-DIRECT), then filter logs by those leads.
      // Logs with `lead_id IS NULL` (system sends) stay super-admin-only.
      let leadIds: string[] | null = null;
      if (!isSuperAdmin) {
        const { data: leadRows } = await supabase
          .from("student_leads")
          .select("id")
          .in("partner_id", scopedPartnerIds);
        leadIds = (leadRows ?? []).map((r) => r.id);
        if (leadIds.length === 0) {
          if (!cancelled) setLogs([]);
          return;
        }
      }

      let q = supabase
        .from("communication_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (leadIds) q = q.in("lead_id", leadIds);
      const { data } = await q;
      if (!cancelled) setLogs((data ?? []) as CommunicationLog[]);
    })();
    return () => { cancelled = true; };
  }, [ready, isSuperAdmin, scopedPartnerIds, hasNoScope]);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (channel !== "all" && l.channel !== channel) return false;
      if (status !== "all" && l.send_status !== status) return false;
      if (mode !== "all" && l.mode_used !== mode) return false;
      return true;
    });
  }, [logs, channel, status, mode]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Communication Logs"
        description="Audit trail of every send attempt — admin only."
        count={filtered.length}
      />

      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div>
            <Label className="text-xs">Channel</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="simulated">Simulated</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Mode</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="mock">Mock</SelectItem>
                <SelectItem value="demo_live">Demo Live</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {hasNoScope ? (
          <EmptyState
            title="No partners assigned"
            description="No partners assigned to your account. Contact a super admin to get partners assigned."
          />
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-3">{filtered.length} entries</p>
            <CommunicationLogTable logs={filtered} />
          </>
        )}
      </Card>
    </div>
  );
}
