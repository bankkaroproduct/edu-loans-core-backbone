import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Settings2, ArrowRight, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StageBadge, StatusBadge, formatStageLabel } from "@/components/dashboard/StageBadge";
import {
  ALLOWED_TRANSITIONS,
  DEFAULT_STATUS_FOR_STAGE,
  isTerminal,
  stageRequiresReason,
  statusRequiresReason,
  type LeadStage,
  type LeadStatus,
} from "@/lib/leadTransitions";
import { changeLeadStage, changeLeadStatus } from "@/lib/adminActions";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"student_leads">;
type StatusMaster = Tables<"lifecycle_status_master">;

interface Props {
  lead: Lead;
  unverifiedRequiredCount: number;
  hasSanctionInHistory: boolean;
  onChanged: () => void;
}

export function AdminStageStatusPanel({ lead, unverifiedRequiredCount, hasSanctionInHistory, onChanged }: Props) {
  const [statusMaster, setStatusMaster] = useState<StatusMaster[]>([]);
  const [stageOpen, setStageOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  useEffect(() => {
    supabase
      .from("lifecycle_status_master")
      .select("*")
      .eq("active_flag", true)
      .order("sort_order")
      .then(({ data }) => setStatusMaster(data ?? []));
  }, []);

  const currentStage = lead.current_stage as LeadStage;
  const terminal = isTerminal(currentStage);
  const allowedNext = ALLOWED_TRANSITIONS[currentStage] ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" /> Stage & Status Control
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Stage:</span>
          <StageBadge stage={lead.current_stage} />
          <span className="text-xs text-muted-foreground ml-2">Status:</span>
          <StatusBadge status={lead.current_status} />
        </div>

        {terminal ? (
          <div className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
            Lead is in terminal stage. No further transitions allowed.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="default" onClick={() => setStageOpen(true)} disabled={allowedNext.length === 0}>
              Change Stage
            </Button>
            <Button size="sm" variant="outline" onClick={() => setStatusOpen(true)} disabled={statusMaster.length === 0}>
              Update Status
            </Button>
          </div>
        )}
      </CardContent>

      <ChangeStageDialog
        open={stageOpen}
        onOpenChange={setStageOpen}
        lead={lead}
        statusMaster={statusMaster}
        unverifiedRequiredCount={unverifiedRequiredCount}
        hasSanctionInHistory={hasSanctionInHistory}
        onSuccess={() => { setStageOpen(false); onChanged(); }}
      />

      <UpdateStatusDialog
        open={statusOpen}
        onOpenChange={setStatusOpen}
        lead={lead}
        statusMaster={statusMaster}
        onSuccess={() => { setStatusOpen(false); onChanged(); }}
      />
    </Card>
  );
}

// ---------------------------------------------------------------- Stage dialog

function ChangeStageDialog({
  open, onOpenChange, lead, statusMaster, unverifiedRequiredCount, hasSanctionInHistory, onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lead: Lead;
  statusMaster: StatusMaster[];
  unverifiedRequiredCount: number;
  hasSanctionInHistory: boolean;
  onSuccess: () => void;
}) {
  const currentStage = lead.current_stage as LeadStage;
  const allowed = ALLOWED_TRANSITIONS[currentStage] ?? [];

  const [newStage, setNewStage] = useState<LeadStage | "">("");
  const [newStatus, setNewStatus] = useState<LeadStatus | "">("");
  const [reason, setReason] = useState("");
  const [partnerNote, setPartnerNote] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [override, setOverride] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setNewStage(""); setNewStatus(""); setReason(""); setPartnerNote(""); setInternalNote(""); setOverride(false);
    }
  }, [open]);

  useEffect(() => {
    if (newStage) setNewStatus(DEFAULT_STATUS_FOR_STAGE[newStage]);
  }, [newStage]);

  const stageStatuses = useMemo(
    () => (newStage ? statusMaster.filter((s) => s.stage_key === newStage) : []),
    [newStage, statusMaster],
  );

  const reasonNeeded = newStage ? stageRequiresReason(newStage) : false;
  const breWarn = newStage === "bre_evaluated" && unverifiedRequiredCount > 0;
  const disbursedWarn = newStage === "disbursed" && !hasSanctionInHistory;
  const warning = breWarn || disbursedWarn;

  const canSubmit = newStage && newStatus
    && (!reasonNeeded || reason.trim().length >= 10)
    && (!warning || override)
    && !busy;

  const submit = async () => {
    if (!newStage || !newStatus) return;
    setBusy(true);
    const res = await changeLeadStage({
      leadId: lead.id,
      newStage: newStage as LeadStage,
      newStatus: newStatus as LeadStatus,
      changeReason: reason.trim() || null,
      partnerVisibleNote: partnerNote.trim() || null,
      internalNote: internalNote.trim() || null,
      override: warning && override,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error("Action failed — nothing was changed", { description: res.error });
      return;
    }
    toast.success(`Stage moved to ${formatStageLabel(newStage)}`);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Lead Stage</DialogTitle>
          <DialogDescription>
            Current: <strong>{formatStageLabel(currentStage)}</strong>. Pick the next stage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Next stage</Label>
            <Select value={newStage} onValueChange={(v) => setNewStage(v as LeadStage)}>
              <SelectTrigger><SelectValue placeholder="Select target stage" /></SelectTrigger>
              <SelectContent>
                {allowed.map((s) => (
                  <SelectItem key={s} value={s}>{formatStageLabel(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {newStage && (
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as LeadStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {stageStatuses.map((s) => (
                    <SelectItem key={s.id} value={s.status_key}>{s.status_label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {reasonNeeded && (
            <div>
              <Label className="text-xs">Reason <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder="At least 10 characters"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
              />
              {reason.length > 0 && reason.trim().length < 10 && (
                <p className="text-[10px] text-destructive mt-1">Minimum 10 characters required.</p>
              )}
            </div>
          )}

          {!reasonNeeded && (
            <div>
              <Label className="text-xs">Reason (optional)</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
            </div>
          )}

          <div>
            <Label className="text-xs">Partner-visible note (optional)</Label>
            <Textarea value={partnerNote} onChange={(e) => setPartnerNote(e.target.value)} rows={2} />
          </div>
          <div>
            <Label className="text-xs">Internal note (optional)</Label>
            <Textarea value={internalNote} onChange={(e) => setInternalNote(e.target.value)} rows={2} />
          </div>

          {warning && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs space-y-2">
              <div className="flex items-center gap-2 text-destructive font-medium">
                <AlertTriangle className="h-4 w-4" />
                {breWarn && `${unverifiedRequiredCount} required document(s) are not verified.`}
                {disbursedWarn && "No 'Sanction Received' stage found in history."}
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="override" checked={override} onCheckedChange={(c) => setOverride(Boolean(c))} />
                <label htmlFor="override" className="text-xs cursor-pointer">
                  I understand and want to override this guardrail (audit will record this).
                </label>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Apply
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Status dialog
//
// Cross-stage status updates: the dialog now lists every active status from
// `lifecycle_status_master`, prefixed with its stage label so admins can
// pick a meaningful state directly. If the chosen status belongs to the
// lead's current stage we call admin_change_lead_status; otherwise we call
// admin_change_lead_stage atomically (stage + status flip together).

function UpdateStatusDialog({
  open, onOpenChange, lead, statusMaster, onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lead: Lead;
  statusMaster: StatusMaster[];
  onSuccess: () => void;
}) {
  const [selectedRowId, setSelectedRowId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setSelectedRowId(""); setReason(""); } }, [open]);

  const currentStage = lead.current_stage as LeadStage;
  const selectedRow = useMemo(
    () => statusMaster.find((s) => s.id === selectedRowId) ?? null,
    [statusMaster, selectedRowId],
  );
  const targetStage = (selectedRow?.stage_key ?? currentStage) as LeadStage;
  const targetStatus = (selectedRow?.status_key ?? lead.current_status) as LeadStatus;
  const isCrossStage = !!selectedRow && targetStage !== currentStage;

  // Hide selecting the same (stage,status) pair we're already on, plus terminal
  // stages and draft (admins should not arbitrarily move leads back to draft).
  const visibleOptions = useMemo(
    () => statusMaster.filter((s) => {
      if (s.stage_key === "draft") return false;
      if (s.stage_key === currentStage && s.status_key === lead.current_status) return false;
      return true;
    }),
    [statusMaster, currentStage, lead.current_status],
  );

  const reasonNeeded = selectedRow
    ? statusRequiresReason(targetStatus) || (isCrossStage && stageRequiresReason(targetStage))
    : false;

  const canSubmit = !!selectedRow
    && (!reasonNeeded || reason.trim().length >= 10)
    && !busy;

  const submit = async () => {
    if (!selectedRow) return;
    setBusy(true);
    const res = isCrossStage
      ? await changeLeadStage({
          leadId: lead.id,
          newStage: targetStage,
          newStatus: targetStatus,
          changeReason: reason.trim() || null,
        })
      : await changeLeadStatus({
          leadId: lead.id,
          newStatus: targetStatus,
          changeReason: reason.trim() || null,
        });
    setBusy(false);
    if (!res.ok) {
      toast.error("Action failed — nothing was changed", { description: res.error });
      return;
    }
    toast.success(
      isCrossStage
        ? `Moved to ${formatStageLabel(targetStage)} — ${selectedRow.status_label}`
        : "Status updated",
    );
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Status</DialogTitle>
          <DialogDescription>
            Current: <Badge variant="outline" className="ml-1">{formatStageLabel(currentStage)}</Badge>
            {" "}— picking a status from a different stage will move the lead atomically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">New status</Label>
            <Select value={selectedRowId} onValueChange={setSelectedRowId}>
              <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
              <SelectContent className="max-h-[320px]">
                {visibleOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {formatStageLabel(s.stage_key)} — {s.status_label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isCrossStage && (
              <p className="text-[10px] text-muted-foreground mt-1">
                This will also move the stage from <strong>{formatStageLabel(currentStage)}</strong> to{" "}
                <strong>{formatStageLabel(targetStage)}</strong>.
              </p>
            )}
          </div>

          {reasonNeeded && (
            <div>
              <Label className="text-xs">Reason <span className="text-destructive">*</span></Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="At least 10 characters" />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
