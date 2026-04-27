import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FormSectionProps {
  /** Short uppercase eyebrow label (e.g. "Loan request", "Student"). */
  title: string;
  /** Optional one-line helper text rendered below the title. */
  description?: string;
  /** Optional right-side slot for inline controls (e.g. a clear/reset link). */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Standard wrapper for a labeled group of form fields.
 *
 * Layout:
 *   [TITLE (xs uppercase tracking-wider muted)]   [optional actions]
 *   [optional description]
 *   [children, typically a grid of fields]
 *
 * Use inside form pages and editor drawers to replace ad-hoc
 * `<div><h3>…</h3>…</div>` patterns. Visual-only, logic-free.
 */
export function FormSection({
  title,
  description,
  actions,
  children,
  className,
}: FormSectionProps) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </h3>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
