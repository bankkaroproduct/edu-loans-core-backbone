// Generic popover-based inline editor for master-backed fields on a lead.
// Renders a clickable trigger that opens a popover with caller-provided
// content (typically a MasterCombobox or Select). Save writes the supplied
// payload to `student_leads` and inserts an admin_direct_edit audit row.
//
// This component intentionally does NOT duplicate InlineEditField logic.
// It is used only by the Admin Lead Detail summary strip for fields that
// need a searchable master picker.
import { ReactNode, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useRoleAccess } from "@/hooks/useRoleAccess";

interface Props {
  leadId: string;
  label: string;
  /** What the trigger displays when collapsed. Pass `null` to render the
   *  italic "Please provide details" placeholder. */
  display: string | null;
  /** Render-prop body for the popover (typically a MasterCombobox). */
  renderBody: () => ReactNode;
  /** Build the supabase.update payload. Return null to abort save with a toast. */
  buildPayload: () => Record<string, unknown> | null;
  /** Build audit { old, new } pair. */
  buildAudit: () => { old: Record<string, unknown>; new: Record<string, unknown> };
  /** Called after a successful save so the parent can refresh. */
  onSaved?: () => void;
  /** Optional pre-save validation. Return error string to block. */
  validate?: () => string | null;
}

export function MasterEditPopover({
  leadId,
  label,
  display,
  renderBody,
  buildPayload,
  buildAudit,
  onSaved,
  validate,
}: Props) {
  const { appUser } = useAuth();
  const { isAdmin } = useRoleAccess();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!isAdmin) {
    return display ? (
      <span className="text-sm font-semibold text-foreground truncate" title={display}>
        {display}
      </span>
    ) : (
      <span className="text-sm italic text-muted-foreground/70 truncate">Please provide details</span>
    );
  }

  const save = async () => {
    if (!appUser) {
      toast.error("Not authenticated");
      return;
    }
    const validationErr = validate?.();
    if (validationErr) {
      toast.error(validationErr);
      return;
    }
    const payload = buildPayload();
    if (!payload) return;
    setSaving(true);
    const { error } = await supabase
      .from("student_leads")
      .update(payload as never)
      .eq("id", leadId);
    if (error) {
      setSaving(false);
      toast.error(`Failed to save ${label}`, { description: error.message });
      return;
    }
    try {
      const audit = buildAudit();
      await supabase.from("audit_logs").insert({
        entity_type: "student_lead",
        entity_id: leadId,
        action_type: "admin_direct_edit",
        actor_user_id: appUser.id,
        actor_role: appUser.role,
        old_value: audit.old as never,
        new_value: audit.new as never,
        meta: { source: "admin_summary_master_edit", label } as never,
      } as never);
    } catch (e) {
      console.warn("[MasterEditPopover] audit insert failed", e);
    }
    setSaving(false);
    setOpen(false);
    toast.success(`${label} updated`);
    onSaved?.();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={
            display
              ? "text-left text-sm font-semibold text-foreground truncate hover:underline underline-offset-2 w-full"
              : "text-left text-sm italic text-primary hover:underline underline-offset-2 w-full"
          }
          title={`Edit ${label}`}
        >
          {display ?? "Please provide details"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          {label}
        </p>
        <div className="space-y-2">{renderBody()}</div>
        <div className="flex items-center justify-end gap-2 mt-3">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
