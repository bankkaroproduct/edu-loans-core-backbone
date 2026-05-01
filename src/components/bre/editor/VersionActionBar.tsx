import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Save, Power, ArrowDownToLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { StickyFormFooter } from "@/components/shared/StickyFormFooter";
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
 * Sticky footer used by both BRE editors.
 * - Validation list rendered above the footer when there are errors.
 * - Save button is disabled while errors exist OR while saving.
 * - In read-only mode (`hidden=true`), the entire bar is omitted from the DOM.
 *
 * Built on the shared StickyFormFooter primitive (PR 5).
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

  const summaryEmpty = !changeSummary.trim();
  const disabledReason = hasErrors
    ? "Fix validation errors before saving"
    : summaryEmpty
      ? "Enter a change summary above to save"
      : null;

  const left = (
    <div className="flex-1 min-w-0 space-y-1">
      <Label htmlFor="bre-change-summary" className="text-[10px] uppercase text-muted-foreground">
        Change summary <span className="text-destructive" aria-hidden="true">*</span> (required)
      </Label>
      <Input
        id="bre-change-summary"
        value={changeSummary}
        onChange={(e) => onChangeSummary(e.target.value)}
        placeholder="e.g. Adjusted CIBIL bands, raised salary threshold"
        className="h-10 min-w-[260px] md:w-[420px]"
        aria-required="true"
      />
    </div>
  );

  const right = (
    <>
      {disabledReason && !saving && (
        <span className="text-xs text-muted-foreground mr-1 hidden md:inline">
          {disabledReason}
        </span>
      )}
      <Button
        onClick={onSave}
        disabled={hasErrors || saving || summaryEmpty}
        className={cn(hasErrors && "opacity-60")}
      >
        <Save className="mr-1.5 h-4 w-4" /> {saving ? "Saving…" : saveLabel}
      </Button>
      {showActivate && onSaveAndActivate && (
        <Button
          variant="default"
          onClick={onSaveAndActivate}
          disabled={hasErrors || saving || summaryEmpty}
        >
          <Power className="mr-1.5 h-4 w-4" /> Save & activate
        </Button>
      )}
    </>
  );

  return (
    <>
      {hasErrors && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
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
      <StickyFormFooter left={left} right={right} />
    </>
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
