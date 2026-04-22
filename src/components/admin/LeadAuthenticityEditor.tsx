// Lead Authenticity — canonical structured field on student_leads.
// Replaces the old free-form "fraud_flag" boolean as the source of truth for triage.
// fraud_flag is preserved as a read-only legacy mirror and is NEVER user-editable.

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, ShieldAlert, ShieldQuestion, AlertTriangle, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { toast } from "sonner";

export type LeadAuthenticity = "unverified" | "verified" | "suspicious" | "fraudulent";

export const AUTHENTICITY_OPTIONS: { value: LeadAuthenticity; label: string; description: string }[] = [
  { value: "unverified", label: "Unverified", description: "Default — not yet reviewed for authenticity." },
  { value: "verified", label: "Verified", description: "Identity / co-applicant signals look genuine after review." },
  { value: "suspicious", label: "Suspicious", description: "Some risk signals detected — handle with extra checks." },
  { value: "fraudulent", label: "Fraudulent", description: "Confirmed fraudulent — block downstream actions." },
];

function authenticityVisuals(value: LeadAuthenticity) {
  switch (value) {
    case "verified":
      return { Icon: ShieldCheck, className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "suspicious":
      return { Icon: ShieldAlert, className: "bg-amber-50 text-amber-700 border-amber-200" };
    case "fraudulent":
      return { Icon: ShieldAlert, className: "bg-rose-50 text-rose-700 border-rose-200" };
    case "unverified":
    default:
      return { Icon: ShieldQuestion, className: "bg-muted text-muted-foreground border-border" };
  }
}

interface BadgeProps {
  value: LeadAuthenticity | string | null | undefined;
  className?: string;
}

export function LeadAuthenticityBadge({ value, className }: BadgeProps) {
  const v = (value ?? "unverified") as LeadAuthenticity;
  const opt = AUTHENTICITY_OPTIONS.find((o) => o.value === v) ?? AUTHENTICITY_OPTIONS[0];
  const { Icon, className: visualClass } = authenticityVisuals(v);
  return (
    <Badge variant="outline" className={`gap-1 ${visualClass} ${className ?? ""}`}>
      <Icon className="h-3 w-3" />
      {opt.label}
    </Badge>
  );
}

interface EditorProps {
  leadId: string;
  current: LeadAuthenticity | string | null | undefined;
  fraudFlag: boolean | null | undefined;
  onChanged?: () => void;
}

/** Admin-only editor. Hidden for non-admins — partner forms must NEVER reach this. */
export function LeadAuthenticityEditor({ leadId, current, fraudFlag, onChanged }: EditorProps) {
  const { isAdmin } = useRoleAccess();
  const { appUser } = useAuth();
  const [open, setOpen] = useState(false);
  const initial = (current ?? "unverified") as LeadAuthenticity;
  const [value, setValue] = useState<LeadAuthenticity>(initial);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  if (!isAdmin) {
    return <LeadAuthenticityBadge value={initial} />;
  }

  const handleOpen = (next: boolean) => {
    if (next) {
      setValue(initial);
      setReason("");
    }
    setOpen(next);
  };

  const handleSave = async () => {
    if (value === initial) {
      toast.info("Authenticity unchanged.");
      setOpen(false);
      return;
    }
    if ((value === "suspicious" || value === "fraudulent") && reason.trim().length < 10) {
      toast.error("Please provide a reason of at least 10 characters when flagging as suspicious or fraudulent.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("student_leads")
      .update({ lead_authenticity: value })
      .eq("id", leadId);
    if (error) {
      toast.error(`Failed to update authenticity: ${error.message}`);
      setSaving(false);
      return;
    }
    // Atomic-ish trail: audit log + internal note. Best-effort — don't block on either.
    try {
      await supabase.from("audit_logs").insert({
        entity_type: "student_lead",
        entity_id: leadId,
        action_type: "lead_authenticity_changed",
        actor_user_id: appUser?.id ?? null,
        actor_role: appUser?.role ?? null,
        old_value: { lead_authenticity: initial } as never,
        new_value: { lead_authenticity: value } as never,
        meta: { reason: reason.trim() || null } as never,
      } as never);
    } catch (e) {
      console.warn("[LeadAuthenticity] audit insert failed", e);
    }
    try {
      await supabase.from("lead_notes").insert({
        lead_id: leadId,
        note_type: "internal",
        note_text: `Lead authenticity changed: ${initial} → ${value}${reason.trim() ? ` — ${reason.trim()}` : ""}`,
        created_by: appUser?.id ?? null,
      } as never);
    } catch (e) {
      console.warn("[LeadAuthenticity] note insert failed", e);
    }
    toast.success(`Authenticity updated to ${value}.`);
    setSaving(false);
    setOpen(false);
    onChanged?.();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => handleOpen(true)}
        className="group inline-flex items-center gap-1.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary"
        title="Click to change lead authenticity"
      >
        <LeadAuthenticityBadge value={initial} />
        <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Lead Authenticity</DialogTitle>
            <DialogDescription>
              Canonical authenticity status for this lead. Changes are audited and an internal note is added to the timeline.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Authenticity</Label>
              <Select value={value} onValueChange={(v) => setValue(v as LeadAuthenticity)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AUTHENTICITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      <div className="flex flex-col">
                        <span className="text-sm">{o.label}</span>
                        <span className="text-[11px] text-muted-foreground">{o.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(value === "suspicious" || value === "fraudulent") && (
              <div className="space-y-2">
                <Label>Reason (required)</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe the risk signals — minimum 10 characters."
                  rows={3}
                />
              </div>
            )}

            {fraudFlag ? (
              <Alert className="bg-amber-50 border-amber-200 text-amber-900 [&>svg]:text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Legacy <strong>fraud_flag</strong> is currently <strong>ON</strong> for this lead. It is read-only and only displayed for legacy compatibility — the canonical status is <em>lead_authenticity</em>.
                </AlertDescription>
              </Alert>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
