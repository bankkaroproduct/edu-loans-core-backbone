import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FormCardShellProps {
  /** Section title shown in the head (e.g. "Student details"). */
  title: string;
  /** Optional subtitle / helper copy shown below the title. */
  subtitle?: string;
  /** Visible step indicator on the right of the head, e.g. "Step 2 of 4". */
  stepLabel?: string;
  /** Body slot — typically the form fields. */
  children: ReactNode;
  /** Optional sticky-style footer (Back / Next buttons + autosave indicator). */
  footer?: ReactNode;
  /** Left-side footer slot (e.g. autosave indicator). */
  autosaveSlot?: ReactNode;
  className?: string;
}

/**
 * Standard shell for a step's body inside the Add Lead form.
 * Head + body + foot, scoped via .add-lead-shell tokens.
 * Visual only — owns no state.
 */
export function FormCardShell({
  title,
  subtitle,
  stepLabel,
  children,
  footer,
  autosaveSlot,
  className,
}: FormCardShellProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[12px] border border-[color:var(--al-border-1)] bg-[color:var(--al-bg-card)]",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b border-[color:var(--al-border-1)] px-[22px] pb-4 pt-[18px]">
        <div className="min-w-0">
          <h2 className="text-[15px] font-extrabold tracking-[-0.015em] text-[color:var(--al-fg-1)]">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-[12.5px] text-[color:var(--al-fg-2)]">{subtitle}</p>
          )}
        </div>
        {stepLabel && (
          <span className="shrink-0 rounded-full bg-[color:var(--al-blue-tint)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--al-blue)]">
            {stepLabel}
          </span>
        )}
      </header>
      <div className="px-[22px] py-[22px]">{children}</div>
      {(footer || autosaveSlot) && (
        <footer className="flex flex-col gap-2 border-t border-[color:var(--al-border-1)] bg-[color:var(--al-bg-foot)] px-[22px] py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-[11.5px] font-semibold text-[color:var(--al-fg-2)]">
            {autosaveSlot}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">{footer}</div>
        </footer>
      )}
    </section>
  );
}
