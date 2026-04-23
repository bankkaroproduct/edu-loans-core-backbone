import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mail, MessageCircle, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { MessageComposer } from "./MessageComposer";
import { leadToVariables } from "@/lib/communications/render";
import type { CommChannel, CommunicationLog } from "@/lib/communications/types";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"student_leads">;

const STATUS_COLOR: Record<string, string> = {
  simulated: "bg-blue-100 text-blue-900",
  sent: "bg-emerald-100 text-emerald-900",
  failed: "bg-red-100 text-red-900",
};

export function LeadCommunicationPanel({ lead }: { lead: Lead }) {
  const [channel, setChannel] = useState<CommChannel | null>(null);
  const [recent, setRecent] = useState<CommunicationLog[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("communication_logs")
      .select("*")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .limit(5);
    setRecent((data ?? []) as CommunicationLog[]);
  };

  useEffect(() => {
    load();
  }, [lead.id]);

  const defaultRecipient =
    channel === "email" ? lead.student_email ?? "" : lead.student_phone ?? "";

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Communications</h3>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <Button size="sm" variant="outline" onClick={() => setChannel("email")}>
          <Mail className="h-3.5 w-3.5 mr-1" /> Send Email
        </Button>
        <Button size="sm" variant="outline" onClick={() => setChannel("whatsapp")}>
          <MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp
        </Button>
      </div>

      {recent.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Recent (5)</p>
          {recent.map((log) => (
            <div key={log.id} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
              <div className="flex items-center gap-1.5 min-w-0">
                {log.channel === "email" ? (
                  <Mail className="h-3 w-3 shrink-0" />
                ) : (
                  <MessageCircle className="h-3 w-3 shrink-0" />
                )}
                <span className="truncate font-mono text-[10px]">{log.template_key}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className={`text-[9px] h-4 px-1 ${STATUS_COLOR[log.send_status] ?? ""}`}>
                  {log.send_status}
                </Badge>
                <span className="text-muted-foreground text-[10px]">
                  {format(new Date(log.created_at), "dd MMM HH:mm")}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No messages sent yet for this lead.</p>
      )}

      <Dialog open={!!channel} onOpenChange={(v) => !v && setChannel(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Send {channel === "email" ? "Email" : "WhatsApp"} — {lead.lead_id}
            </DialogTitle>
          </DialogHeader>
          {channel && (
            <MessageComposer
              lockChannel={channel}
              defaultRecipient={defaultRecipient}
              defaultVariables={leadToVariables(lead)}
              leadId={lead.id}
              onSent={() => {
                load();
                setChannel(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
