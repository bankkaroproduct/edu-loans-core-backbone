import { ReactNode } from "react";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReviewBlockProps {
  /** Outlined chip label, e.g. "Student Details". */
  label: string;
  /** Optional small tag next to the chip (e.g. "Optional"). */
  tag?: string;
  /** Edit handler — should call the existing step-jump handler. */
  onEdit?: () => void;
  children: ReactNode;
  className?: string;
}

/**
 * Review section block — outlined chip header + Edit link + body of inline rows.
 */
export function ReviewBlock({ label, tag, onEdit, children, className }: ReviewBlockProps) {
  return (
    <section className={cn("border-t border-[color:var(--al-border-2)] pt-3.5 mt-3.5 first:border-0 first:pt-0 first:mt-0", className)}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[color:var(--al-border-1)] bg-[color:var(--al-bg-card)] px-3 py-1 text-[11.5px] font-semibold text-[color:var(--al-fg-1)]">
            {label}
          </span>
          {tag && (
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--al-fg-3)]">
              {tag}
            </span>
          )}
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 text-[12px] font-bold text-[color:var(--al-blue)] hover:underline"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        )}
      </div>
      <div>{children}</div>
    </section>
  );
}

interface ReviewRowInlineProps {
  label: string;
  value: ReactNode;
  /** When true, value renders as muted "Please provide details →". */
  isEmpty?: boolean;
  /** Optional click target for the empty-state text (jumps to that step/field). */
  onNudge?: () => void;
  /** Cascade-disabled academic rows render as "Not Applicable". */
  notApplicable?: boolean;
}

export function ReviewRowInline({ label, value, isEmpty, onNudge, notApplicable }: ReviewRowInlineProps) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-[color:var(--al-border-2)] px-1 py-3 last:border-0">
      <span className="text-[13.5px] font-semibold text-[color:var(--al-fg-1)]">
        {label}:
      </span>
      {notApplicable ? (
        <span className="text-[13.5px] font-medium text-[color:var(--al-fg-3)]">Not Applicable</span>
      ) : isEmpty ? (
        onNudge ? (
          <button
            type="button"
            onClick={onNudge}
            className="text-[13.5px] font-medium text-[color:var(--al-fg-muted)] hover:text-[color:var(--al-blue)] hover:underline"
          >
            Please provide details →
          </button>
        ) : (
          <span className="text-[13.5px] font-medium text-[color:var(--al-fg-muted)]">
            Please provide details →
          </span>
        )
      ) : (
        <span className="min-w-0 truncate text-[13.5px] font-semibold text-[color:var(--al-fg-1)]">
          {value}
        </span>
      )}
    </div>
  );
}
