import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import {
  type NumericKind,
  validateNumeric,
  validateNumericRange,
  isPurelyNumericText,
  sanitizeNumericInput,
} from "@/lib/numericValidation";
import { MasterCombobox, type MasterOption } from "@/components/ui/master-combobox";


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
  /**
   * When provided, the write merges the parsed value into the named JSONB column at `field` key,
   * preserving sibling keys. The DB column to merge into is given here (e.g. "test_scores").
   * In this mode, `field` becomes the JSON key (not a top-level column).
   * Empty/blank trimmed string deletes the key from the JSONB.
   */
  jsonbColumn?: string;
  /**
   * When set, the field is treated as numeric: input is sanitized live,
   * and Save is blocked (no DB write, no audit log) if the value fails
   * `validateNumeric`. Blank values are still allowed — required-ness is
   * enforced separately by the existing "cannot be empty" check.
   */
  numericKind?: NumericKind;
  /**
   * How to render `options` in edit mode.
   *  - "buttons" (default): existing pill-button toggle behavior (e.g. Gender, Yes/No).
   *  - "dropdown": shadcn <Select> menu — free text is impossible.
   * Has no effect when `options` is not provided.
   */
  optionsRenderAs?: "buttons" | "dropdown";
  /**
   * Range validation for numeric fields. Applied AFTER `numericKind` passes.
   * Optional — when omitted, default `numericKind` semantics are unchanged.
   */
  numericRange?: { min?: number; max?: number; label?: string };
  /**
   * Cross-field guard for numeric fields stored in the same `jsonbColumn`:
   * blocks save when the drafted score exceeds the sibling key's value
   * (e.g. tenth score must be ≤ tenth_total). When the sibling is blank,
   * caller may also set `percentageMaxWhenNoSibling` to enforce a 0–100
   * cap (interprets the score as a percentage).
   */
  siblingMaxKey?: string;
  percentageMaxWhenNoSibling?: number;
  /**
   * When provided, edit mode renders a MasterCombobox bound to the draft.
   * The saved value is the chosen option's `label` (master) or the typed
   * manual text. Manual purely-numeric input is rejected at save time.
   * `numericKind` is ignored while this prop is active.
   */
  masterCombobox?: {
    options: MasterOption[];
    placeholder?: string;
    manualPlaceholder?: string;
    helperText?: string;
  };
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
  jsonbColumn,
  numericKind,
  optionsRenderAs = "buttons",
  numericRange,
  siblingMaxKey,
  percentageMaxWhenNoSibling,
  masterCombobox,
}: Props) {
  const { appUser } = useAuth();
  const { isAdmin } = useRoleAccess();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localValue, setLocalValue] = useState<string | null | undefined>(value);

  // Re-sync display when parent refreshes the lead, but never blow away an active edit session.
  useEffect(() => {
    if (!editing && !confirming && !saving) {
      setLocalValue(value);
    }
  }, [value, editing, confirming, saving]);

  const hasValue = localValue !== null && localValue !== undefined && localValue !== "";

  // Whether the current draft matches a master-combobox option (label match).
  const masterSelectedId = useMemo(() => {
    if (!masterCombobox) return "";
    const d = draft.trim();
    if (!d) return "";
    const m = masterCombobox.options.find((o) => o.label === d);
    return m?.id ?? "";
  }, [masterCombobox, draft]);

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
    const trimmedDraft = draft.trim();
    // Master-combobox fields: blank cancels (no save); manual values cannot be
    // purely numeric junk (e.g. "12345"). Real names with digits are allowed.
    if (masterCombobox) {
      if (!trimmedDraft) {
        toast.error(`${label} cannot be empty`);
        return;
      }
      const isMaster = masterCombobox.options.some((o) => o.label === trimmedDraft);
      if (!isMaster && isPurelyNumericText(trimmedDraft)) {
        toast.error("Please enter a valid name.");
        return;
      }
      setConfirming(true);
      return;
    }
    // Numeric fields: blank is allowed (clears the value); non-blank must be valid.
    if (numericKind) {
      if (trimmedDraft !== "") {
        const baseRes = validateNumeric(numericKind, trimmedDraft);
        if (baseRes.ok === false) {
          toast.error(baseRes.message);
          return;
        }
        if (numericRange) {
          const r = validateNumericRange(numericKind, trimmedDraft, {
            min: numericRange.min,
            max: numericRange.max,
            label: numericRange.label ?? label,
          });
          if (r.ok === false) {
            toast.error(r.message);
            return;
          }
        }
      }
    } else if (!trimmedDraft) {
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
    const trimmed = draft.trim();
    // Re-validate before any DB write to guarantee invalid text never reaches storage.
    if (masterCombobox) {
      if (!trimmed) {
        toast.error(`${label} cannot be empty`);
        return;
      }
      const isMaster = masterCombobox.options.some((o) => o.label === trimmed);
      if (!isMaster && isPurelyNumericText(trimmed)) {
        toast.error("Please enter a valid name.");
        return;
      }
    }
    if (numericKind && trimmed !== "") {
      const res = validateNumeric(numericKind, trimmed);
      if (res.ok === false) {
        toast.error(res.message);
        return;
      }
      if (numericRange) {
        const r = validateNumericRange(numericKind, trimmed, {
          min: numericRange.min,
          max: numericRange.max,
          label: numericRange.label ?? label,
        });
        if (r.ok === false) {
          toast.error(r.message);
          return;
        }
      }
    }
    setSaving(true);
    const oldVal = localValue ?? null;
    let writeValue: unknown = parseValue ? parseValue(trimmed) : trimmed;
    if (numericKind && trimmed !== "") {
      const res = validateNumeric(numericKind, trimmed);
      if (res.ok) writeValue = res.clean;
    }

    let updatePayload: Record<string, unknown>;
    let auditOld: Record<string, unknown>;
    let auditNew: Record<string, unknown>;
    let pincodeWarning: string | null = null;
    let pincodeEnriched = false;

    // ─── Pincode branch (handled FIRST and atomically) ──────────────────
    // When admin edits the `pincode` field, build a single multi-field
    // updatePayload that includes city/district/state/tier from
    // pincode_master. This must run before the generic builders below so
    // the enrichment is guaranteed to land in one .update() call.
    if (!jsonbColumn && field === "pincode") {
      if (trimmed === "") {
        // Blank → clear pincode only; do NOT wipe location fields.
        updatePayload = { pincode: null };
        auditOld = { pincode: oldVal };
        auditNew = { pincode: null };
      } else {
        if (!/^\d{6}$/.test(trimmed)) {
          setSaving(false);
          toast.error("Pincode must be exactly 6 digits");
          return;
        }
        const { data: pinRow, error: pinErr } = await supabase
          .from("pincode_master")
          .select("district, state, tier, has_conflict")
          .eq("pincode", trimmed)
          .maybeSingle();
        if (pinErr) {
          console.warn("[InlineEditField] pincode_master lookup failed", pinErr);
        }
        if (pinRow) {
          updatePayload = {
            pincode: trimmed,
            city: pinRow.district ?? null,
            district: pinRow.district ?? null,
            state: pinRow.state ?? null,
            tier: pinRow.tier ?? null,
          };
          pincodeEnriched = true;
          if (pinRow.has_conflict) {
            pincodeWarning = "This pincode maps to multiple areas — please verify city/state.";
          }
        } else {
          updatePayload = { pincode: trimmed };
          pincodeWarning = "Pincode not found in master. City/state were not auto-filled.";
        }
        auditOld = { pincode: oldVal };
        auditNew = { ...updatePayload };
      }
    } else if (jsonbColumn) {
      // Read existing JSONB, merge/delete the key, write whole object back
      const { data: row, error: readErr } = await supabase
        .from("student_leads")
        .select(jsonbColumn)
        .eq("id", leadId)
        .maybeSingle();
      if (readErr) {
        setSaving(false);
        toast.error(`Failed to load ${label}`, { description: readErr.message });
        return;
      }
      const current = ((row as unknown as Record<string, unknown> | null)?.[jsonbColumn] ?? {}) as Record<string, unknown>;
      // Cross-field score/total guard (e.g. tenth ≤ tenth_total). Run only
      // when we have a numeric draft + a configured sibling key.
      if (trimmed !== "" && numericKind && (siblingMaxKey || percentageMaxWhenNoSibling)) {
        const draftNum = Number(typeof writeValue === "number" ? writeValue : trimmed);
        if (Number.isFinite(draftNum)) {
          const sibRaw = siblingMaxKey ? current?.[siblingMaxKey] : undefined;
          const sibNum =
            sibRaw === null || sibRaw === undefined || sibRaw === ""
              ? null
              : Number(sibRaw);
          if (sibNum !== null && Number.isFinite(sibNum)) {
            if (draftNum > sibNum) {
              setSaving(false);
              toast.error("Score obtained cannot be greater than total marks / scale.");
              return;
            }
          } else if (percentageMaxWhenNoSibling !== undefined && draftNum > percentageMaxWhenNoSibling) {
            setSaving(false);
            toast.error(`Percentage cannot be greater than ${percentageMaxWhenNoSibling}.`);
            return;
          }
        }
      }
      const next = { ...(typeof current === "object" && current ? current : {}) };
      if (trimmed === "") {
        delete next[field];
      } else {
        next[field] = writeValue;
      }
      updatePayload = { [jsonbColumn]: next };
      auditOld = { [jsonbColumn]: { [field]: current?.[field] ?? null } };
      auditNew = { [jsonbColumn]: { [field]: trimmed === "" ? null : writeValue } };
    } else {
      // For numeric fields, blank → null (not empty string) to satisfy
      // numeric DB columns and to avoid silent "" coercion to 0.
      const finalValue =
        numericKind && trimmed === "" ? null : writeValue;
      updatePayload = { [field]: finalValue };
      auditOld = { [field]: oldVal };
      auditNew = { [field]: finalValue };
    }

    const { error } = await supabase
      .from("student_leads")
      .update(updatePayload as never)
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
        old_value: auditOld as never,
        new_value: auditNew as never,
        meta: {
          field_count: Object.keys(updatePayload).length,
          source: "admin_inline_edit",
          field,
          jsonb_column: jsonbColumn ?? null,
          pincode_enriched: pincodeEnriched,
        } as never,
      } as never);
    } catch (e) {
      console.warn("[InlineEditField] audit log insert failed", e);
    }
    setLocalValue(trimmed);
    setSaving(false);
    setEditing(false);
    setConfirming(false);
    setDraft("");
    if (field === "pincode" && pincodeEnriched) {
      toast.success("Pincode saved — city/state auto-filled from master");
    } else {
      toast.success(`${label} updated`);
    }
    if (pincodeWarning) toast.warning(pincodeWarning);
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
      <span className={`flex flex-col gap-1.5 w-full min-w-0 ${className ?? ""}`}>
        {options && options.length > 0 ? (
          optionsRenderAs === "dropdown" ? (
            <Select value={draft} onValueChange={(v) => setDraft(v)} disabled={saving}>
              <SelectTrigger className="h-8 text-sm w-full">
                <SelectValue placeholder={placeholder ?? `Select ${label}`} />
              </SelectTrigger>
              <SelectContent>
                {options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="flex flex-wrap items-center gap-1">
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
          )
        ) : (
          <Input
            autoFocus
            type={inputType}
            value={draft}
            onChange={(e) => {
              const v = e.target.value;
              setDraft(numericKind ? sanitizeNumericInput(numericKind, v) : v);
            }}
            placeholder={placeholder ?? label}
            className="h-7 text-sm w-full"
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
          <span className="flex flex-wrap items-center gap-1">
            <Button size="sm" className="h-6 px-2 text-[11px]" onClick={askConfirm} disabled={saving}>
              Save
            </Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={cancel} disabled={saving}>
              Cancel
            </Button>
          </span>
        ) : (
          <span className="flex flex-wrap items-center gap-1.5 rounded border bg-muted/40 p-1.5 w-full">
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
