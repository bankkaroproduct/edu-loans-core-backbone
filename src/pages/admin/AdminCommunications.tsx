import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { MessageComposer } from "@/components/admin/communications/MessageComposer";
import { CommunicationLogTable } from "@/components/admin/communications/CommunicationLogTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { MessageSquare, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { CommunicationLog } from "@/lib/communications/types";

export default function AdminCommunications() {
  const [recentLogs, setRecentLogs] = useState<CommunicationLog[]>([]);
  const [providerStatus, setProviderStatus] = useState({ resend: false, twilio: false });

  const loadLogs = async () => {
    const { data } = await supabase
      .from("communication_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    setRecentLogs((data ?? []) as CommunicationLog[]);
  };

  useEffect(() => {
    loadLogs();
    // Provider availability via env injected by Lovable
    setProviderStatus({
      resend: Boolean(import.meta.env.VITE_LOVABLE_CONNECTOR_RESEND_CONNECTED ?? true),
      twilio: Boolean(import.meta.env.VITE_LOVABLE_CONNECTOR_TWILIO_CONNECTED ?? true),
    });
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Communications Test Panel"
        description="Send demo emails and WhatsApp messages. Mock mode is the default — nothing is actually sent."
        icon={MessageSquare}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-4">Compose & Send</h3>
          <MessageComposer providerStatus={providerStatus} onSent={() => loadLogs()} />
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Recent Activity</h3>
            <Button asChild size="sm" variant="ghost">
              <Link to="/admin/communications/logs">
                View all <ExternalLink className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </div>
          <CommunicationLogTable logs={recentLogs} />
        </Card>
      </div>
    </div>
  );
}
