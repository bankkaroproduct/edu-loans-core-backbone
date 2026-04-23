import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { CommunicationLogTable } from "@/components/admin/communications/CommunicationLogTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { History } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { CommunicationLog } from "@/lib/communications/types";

export default function AdminCommunicationLogs() {
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [channel, setChannel] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [mode, setMode] = useState<string>("all");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("communication_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      setLogs((data ?? []) as CommunicationLog[]);
    })();
  }, []);

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
        icon={History}
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
        <p className="text-xs text-muted-foreground mb-3">{filtered.length} entries</p>
        <CommunicationLogTable logs={filtered} />
      </Card>
    </div>
  );
}
