import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Mail, MessageCircle, Eye } from "lucide-react";
import { format } from "date-fns";
import type { CommunicationLog } from "@/lib/communications/types";

const STATUS_VARIANT: Record<string, string> = {
  simulated: "bg-blue-100 text-blue-900 border-blue-200",
  sent: "bg-emerald-100 text-emerald-900 border-emerald-200",
  failed: "bg-red-100 text-red-900 border-red-200",
};

export function CommunicationLogTable({ logs }: { logs: CommunicationLog[] }) {
  const [open, setOpen] = useState<CommunicationLog | null>(null);

  if (logs.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        No communication logs yet.
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">When</th>
              <th className="text-left px-3 py-2">Channel</th>
              <th className="text-left px-3 py-2">Template</th>
              <th className="text-left px-3 py-2">Recipient</th>
              <th className="text-left px-3 py-2">Mode</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t hover:bg-muted/20">
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {format(new Date(log.created_at), "dd MMM, HH:mm")}
                </td>
                <td className="px-3 py-2">
                  {log.channel === "email" ? (
                    <Mail className="h-3.5 w-3.5 inline mr-1" />
                  ) : (
                    <MessageCircle className="h-3.5 w-3.5 inline mr-1" />
                  )}
                  {log.channel}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{log.template_key}</td>
                <td className="px-3 py-2 text-xs">{log.recipient}</td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className="text-[10px]">
                    {log.mode_used}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${STATUS_VARIANT[log.send_status] ?? ""}`}
                  >
                    {log.send_status}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="ghost" onClick={() => setOpen(log)}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Communication Log</SheetTitle>
          </SheetHeader>
          {open && (
            <div className="space-y-4 mt-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Channel" value={open.channel} />
                <Field label="Provider" value={open.provider} />
                <Field label="Template" value={open.template_key} />
                <Field label="Recipient" value={open.recipient} />
                <Field label="Mode" value={open.mode_used} />
                <Field label="Status" value={open.send_status} />
                {open.provider_message_id && (
                  <Field label="Provider message id" value={open.provider_message_id} />
                )}
                <Field
                  label="When"
                  value={format(new Date(open.created_at), "dd MMM yyyy, HH:mm:ss")}
                />
              </div>
              {open.error_message && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-900">
                  <strong>Error:</strong> {open.error_message}
                </div>
              )}
              {open.payload_snapshot.subject && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    Subject
                  </p>
                  <p className="text-sm">{open.payload_snapshot.subject}</p>
                </div>
              )}
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Body</p>
                <pre className="text-xs whitespace-pre-wrap font-sans bg-muted/30 p-3 rounded">
                  {open.payload_snapshot.body}
                </pre>
              </div>
              {open.payload_snapshot.variables && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    Variables
                  </p>
                  <pre className="text-xs bg-muted/30 p-3 rounded">
                    {JSON.stringify(open.payload_snapshot.variables, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm break-all">{value}</p>
    </div>
  );
}
