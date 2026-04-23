import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useRoleAccess } from "@/hooks/useRoleAccess";

interface Props {
  leadId: string;
  field: string;
  label: string;
  value: string | null | undefined;
  onSaved?: (newValue: string) => void;
  /** When true, allow editing even when value already exists. */
  allowEditExisting?: boolean;
  /** Optional input type, default text. */
  inputType?: string;
  /** Display formatter for non-empty saved value (does NOT affect storage). */
  formatDisplay?: (value: string) => string;
  /** Optional placeholder. */
  placeholder?: string;
  className?: string;
  /** When provided, render a segmented toggle instead of a text input. Used for booleans / small enums. */
  options?: { value: string; label: string }[];
  /** When provided, transforms the draft string before save (e.g. "true" -> true for boolean columns). */
  parseValue?: (raw: string) => unknown;
}

/**
 * Admin-only inline-edit cell. Renders a clickable "Please provide details" when
 * the value is missing. On click, swaps to an inline input + Yes/No confirmation.
 *
 * Yes  → writes via supabase.update + admin audit log, then shows the saved value.
 * No   → discards the temp value and restores the placeholder.
 *
 * Non-admins always see the read-only display (delegated to parent via the
 * "isAdmin" check inside the component).
 */
export function InlineEditField({
  leadId,
  field,
  label,
  value,
  onSaved,
  allowEditExisting = false,
  inputType = "text",
  formatDisplay,
  placeholder,
  className,
  options,
  parseValue,
}: Props) {
  const { appUser } = useAuth();
  const { isAdmin } = useRoleAccess();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localValue, setLocalValue] = useState<string | null | undefined>(value);

  const hasValue = localValue !== null && localValue !== undefined && localValue !== "";

  const startEdit = () => {
    setDraft(hasValue ? String(localValue) : "");
    setEditing(true);
    setConfirming(false);
  };
  const cancel = () => {
    setEditing(false);
    setConfirming(false);
    setDraft("");
  };
  const askConfirm = () => {
    if (!draft.trim()) {
      toast.error(`${label} cannot be empty`);
      return;
    }
    setConfirming(true);
  };
  const save = async () => {
    if (!appUser) {
      toast.error("Not authenticated");
      return;
    }
    setSaving(true);
    const trimmed = draft.trim();
    const oldVal = localValue ?? null;
    const writeValue = parseValue ? parseValue(trimmed) : trimmed;
    const { error } = await supabase
      .from("student_leads")
      .update({ [field]: writeValue } as never)
      .eq("id", leadId);
    if (error) {
      setSaving(false);
      toast.error(`Failed to save ${label}`, { description: error.message });
      return;
    }
    // Audit log
    try {
      await supabase.from("audit_logs").insert({
        entity_type: "student_lead",
        entity_id: leadId,
        action_type: "admin_direct_edit",
        actor_user_id: appUser.id,
        actor_role: appUser.role,
        old_value: { [field]: oldVal } as never,
        new_value: { [field]: writeValue } as never,
        meta: { field_count: 1, source: "admin_inline_edit", field } as never,
      } as never);
    } catch (e) {
      console.warn("[InlineEditField] audit log insert failed", e);
    }
    setLocalValue(trimmed);
    setSaving(false);
    setEditing(false);
    setConfirming(false);
    setDraft("");
    toast.success(`${label} updated`);
    onSaved?.(trimmed);
  };

  // Read-only mode (non-admin) — keep parent's existing display behaviour
  if (!isAdmin) {
    if (hasValue) {
      return (
        <span className={className}>
          {formatDisplay ? formatDisplay(String(localValue)) : String(localValue)}
        </span>
      );
    }
    return <span className={`italic text-muted-foreground/70 ${className ?? ""}`}>Please provide details</span>;
  }

  if (editing) {
    return (
      <span className={`inline-flex flex-col gap-1.5 ${className ?? ""}`}>
        {options && options.length > 0 ? (
          <span className="inline-flex items-center gap-1">
            {options.map((opt) => (
              <Button
                key={opt.value}
                size="sm"
                type="button"
                variant={draft === opt.value ? "default" : "outline"}
                className="h-7 px-2 text-xs"
                onClick={() => setDraft(opt.value)}
                disabled={saving}
              >
                {opt.label}
              </Button>
            ))}
          </span>
        ) : (
          <Input
            autoFocus
            type={inputType}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder ?? label}
            className="h-7 text-sm"
            disabled={saving}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (confirming) save();
                else askConfirm();
              } else if (e.key === "Escape") {
                cancel();
              }
            }}
          />
        )}
        {!confirming ? (
          <span className="inline-flex items-center gap-1">
            <Button size="sm" className="h-6 px-2 text-[11px]" onClick={askConfirm} disabled={saving}>
              Save
            </Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={cancel} disabled={saving}>
              Cancel
            </Button>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded border bg-muted/40 p-1.5">
            <span className="text-[11px]">Save this information?</span>
            <Button size="sm" className="h-6 px-2 text-[11px]" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Yes
            </Button>
            <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={cancel} disabled={saving}>
              <X className="h-3 w-3" />
              No
            </Button>
          </span>
        )}
      </span>
    );
  }

  if (hasValue) {
    const display = formatDisplay ? formatDisplay(String(localValue)) : String(localValue);
    if (!allowEditExisting) {
      return <span className={className}>{display}</span>;
    }
    return (
      <button
        type="button"
        onClick={startEdit}
        className={`text-left hover:underline underline-offset-2 ${className ?? ""}`}
        title={`Edit ${label}`}
      >
        {display}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      className={`italic text-primary hover:underline underline-offset-2 ${className ?? ""}`}
      title={`Add ${label}`}
    >
      Please provide details
    </button>
  );
}
