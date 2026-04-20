import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ClipboardCheck } from "lucide-react";
import { getFieldLabel } from "@/lib/editRequestFields";
import type { Tables } from "@/integrations/supabase/types";

type EditRequest = Tables<"lead_edit_requests">;

interface Props {
  leadId: string;
  onChanged: () => void;
}

function fmtVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

export function AdminEditRequestPanel({ leadId, onChanged }: Props) {
  const [request, setRequest] = useState<EditRequest | null>(null);
  const [lead, setLead] = useState<Record<string, unknown> | null>(null);
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [r, l] = await Promise.all([
      supabase.from("lead_edit_requests")
        .select("*")
        .eq("lead_id", leadId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("student_leads").select("*").eq("id", leadId).maybeSingle(),
    ]);
    setRequest(r.data ?? null);
    setLead((l.data ?? null) as Record<string, unknown> | null);
    if (r.data) {
      const initialChecks: Record<string, boolean> = {};
      Object.keys((r.data.requested_changes ?? {}) as Record<string, unknown>).forEach((k) => { initialChecks[k] = true; });
      setApproved(initialChecks);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [leadId]);

  if (!request) return null;

  const changes = (request.requested_changes ?? {}) as Record<string, unknown>;
  const fields = Object.keys(changes);
  const checkedCount = Object.values(approved).filter(Boolean).length;

  const handleApprove = async () => {
    const approvedFields = fields.filter((k) => approved[k]);
    if (approvedFields.length === 0) {
      toast.error("Select at least one field to approve, or use Reject.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("decide_edit_request", {
      _request_id: request.id,
      _action: "approve",
      _approved_fields: approvedFields as never,
      _decision_note: note.trim() || null,
    } as never);
    setBusy(false);
    if (error) {
      toast.error(error.message ?? "Failed to apply edit request");
      return;
    }
    toast.success(`Applied ${approvedFields.length} field(s) to lead.`);
    setNote("");
    onChanged();
    load();
  };

  const handleReject = async () => {
    if (note.trim().length < 10) {
      toast.error("Rejection requires a note of at least 10 characters.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("decide_edit_request", {
      _request_id: request.id,
      _action: "reject",
      _approved_fields: null as never,
      _decision_note: note.trim(),
    } as never);
    setBusy(false);
    if (error) {
      toast.error(error.message ?? "Failed to reject edit request");
      return;
    }
    toast.success("Edit request rejected.");
    setNote("");
    onChanged();
    load();
  };

  return (
    <Card className="border-amber-300">
      <CardHeader className="py-3 bg-amber-50/60 border-b border-amber-200">
        <CardTitle className="text-sm flex items-center gap-2 text-amber-900">
          <ClipboardCheck className="h-4 w-4 shrink-0" /> Pending Edit Request
          <Badge variant="outline" className="border-amber-400 text-amber-900 bg-amber-100 ml-1">{fields.length} field{fields.length !== 1 ? "s" : ""}</Badge>
          <span className="ml-auto text-xs font-normal text-muted-foreground">{new Date(request.created_at).toLocaleString()}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {request.partner_reason && (
          <div className="text-xs">
            <span className="text-muted-foreground">Partner reason: </span>
            <span>{request.partner_reason}</span>
          </div>
        )}
        <div className="border rounded-md divide-y overflow-x-auto">
          <div className="grid grid-cols-[24px_minmax(140px,1.2fr)_minmax(140px,1.4fr)_minmax(140px,1.4fr)] gap-2 px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide min-w-[560px]">
            <span></span>
            <span>Field</span>
            <span>Current</span>
            <span>Requested</span>
          </div>
          {fields.map((k) => (
            <label key={k} className="grid grid-cols-[24px_minmax(140px,1.2fr)_minmax(140px,1.4fr)_minmax(140px,1.4fr)] gap-2 px-3 py-2 text-xs items-center hover:bg-muted/30 cursor-pointer min-w-[560px]">
              <Checkbox
                checked={approved[k] ?? false}
                onCheckedChange={(v) => setApproved((s) => ({ ...s, [k]: Boolean(v) }))}
              />
              <span className="font-medium truncate">{getFieldLabel(k)}</span>
              <span className="text-muted-foreground truncate" title={fmtVal(lead?.[k])}>{fmtVal(lead?.[k])}</span>
              <span className="text-emerald-700 truncate" title={fmtVal(changes[k])}>{fmtVal(changes[k])}</span>
            </label>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Decision note (required for reject, optional for approve)</Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add context for the partner..."
            className="min-h-[60px] text-sm"
          />
        </div>

        <div className="flex items-center justify-between gap-3 pt-3 border-t">
          <span className="text-xs text-muted-foreground">{checkedCount} of {fields.length} field(s) selected</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleReject} disabled={busy}>
              Reject
            </Button>
            <Button size="sm" onClick={handleApprove} disabled={busy || checkedCount === 0}>
              Approve {checkedCount > 0 ? `(${checkedCount})` : ""}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
