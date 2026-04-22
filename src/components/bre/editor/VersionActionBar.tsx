import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Save, Power, ArrowDownToLine } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ValidationError } from "@/lib/bre/validate";

interface Props {
  errors: ValidationError[];
  changeSummary: string;
  onChangeSummary: (v: string) => void;
  onSave: () => void;
  onSaveAndActivate?: () => void;
  saving?: boolean;
  /** When true (read-only mode), we hide all mutation controls instead of disabling them. */
  hidden?: boolean;
  showActivate?: boolean;
  saveLabel?: string;
}

/**
 * Sticky footer used by both editors.
 * - Validation list is always visible when there are errors.
 * - Save button is disabled while errors exist OR while saving.
 * - In read-only mode (`hidden=true`), the entire bar is omitted from the DOM
 *   so there is no risk of a stale clickable control.
 */
export function VersionActionBar({
  errors,
  changeSummary,
  onChangeSummary,
  onSave,
  onSaveAndActivate,
  saving,
  hidden,
  showActivate,
  saveLabel = "Save as new version",
}: Props) {
  if (hidden) return null;
  const hasErrors = errors.length > 0;

  return (
    <div className="sticky bottom-0 -mx-4 mt-6 border-t bg-background/95 px-4 py-3 shadow-[0_-4px_12px_-8px_rgba(0,0,0,0.2)] backdrop-blur md:mx-0 md:rounded-md md:border">
      {hasErrors && (
        <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" /> {errors.length} validation issue{errors.length === 1 ? "" : "s"} — fix before saving
          </div>
          <ul className="mt-2 space-y-0.5 text-xs text-destructive/90">
            {errors.slice(0, 6).map((e, i) => (
              <li key={i}>
                • {e.bucket ? `[${e.bucket}${e.param_key ? `/${e.param_key}` : ""}] ` : ""}
                {e.message}
              </li>
            ))}
            {errors.length > 6 && <li className="opacity-70">…and {errors.length - 6} more</li>}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex-1 space-y-1">
          <Label className="text-[10px] uppercase text-muted-foreground">Change summary (required)</Label>
          <Input
            value={changeSummary}
            onChange={(e) => onChangeSummary(e.target.value)}
            placeholder="e.g. Adjusted CIBIL bands, raised salary threshold"
            className="h-9"
          />
        </div>
        <div className="flex shrink-0 items-end gap-2">
          <Button
            onClick={onSave}
            disabled={hasErrors || saving || !changeSummary.trim()}
            className={cn(hasErrors && "opacity-60")}
          >
            <Save className="mr-1.5 h-4 w-4" /> {saving ? "Saving…" : saveLabel}
          </Button>
          {showActivate && onSaveAndActivate && (
            <Button
              variant="default"
              onClick={onSaveAndActivate}
              disabled={hasErrors || saving || !changeSummary.trim()}
            >
              <Power className="mr-1.5 h-4 w-4" /> Save & activate
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ActivateButton({ disabled, onClick, label = "Activate" }: { disabled?: boolean; onClick: () => void; label?: string }) {
  return (
    <Button size="sm" variant="outline" onClick={onClick} disabled={disabled}>
      <Power className="mr-1.5 h-3.5 w-3.5" /> {label}
    </Button>
  );
}

export function RollbackButton({ disabled, onClick }: { disabled?: boolean; onClick: () => void }) {
  return (
    <Button size="sm" variant="ghost" onClick={onClick} disabled={disabled}>
      <ArrowDownToLine className="mr-1.5 h-3.5 w-3.5" /> Rollback
    </Button>
  );
}
