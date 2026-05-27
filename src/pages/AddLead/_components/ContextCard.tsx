import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ContextCardProps {
  /** Lucide icon component for the leading square. */
  icon: React.ComponentType<{ className?: string }>;
  /** Eyebrow label, e.g. "Partner", "Applying as". */
  eyebrow: string;
  /** Title text (data-bound — partner name, student name). */
  title: string;
  /** Secondary meta text below the title (route, commission, login email). */
  meta?: string;
  /** Right-side verified-style pill: { icon, label, tone }. */
  tag?: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    tone: "green" | "orange" | "blue";
  };
  /** Right-side action (e.g. "Change", "View terms", "Not you?"). */
  action?: { label: string; onClick: () => void };
  className?: string;
  children?: ReactNode;
}

const TONE_CLASSES: Record<NonNullable<ContextCardProps["tag"]>["tone"], string> = {
  green: "bg-[color:var(--al-success-tint)] text-[color:var(--al-success)]",
  orange: "bg-[#FFF1E5] text-[color:var(--al-orange)]",
  blue: "bg-[color:var(--al-blue-tint)] text-[color:var(--al-blue)]",
};

export function ContextCard({
  icon: Icon,
  eyebrow,
  title,
  meta,
  tag,
  action,
  className,
  children,
}: ContextCardProps) {
  const Tag = tag?.icon;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-[12px] border border-[color:var(--al-border-3)] px-[18px] py-3.5",
        "bg-gradient-to-b from-[color:var(--al-blue-tint)] to-[color:var(--al-bg-card)]",
        className,
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[color:var(--al-border-3)] bg-[color:var(--al-bg-card)]">
        <Icon className="h-5 w-5 text-[color:var(--al-blue)]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-[color:var(--al-fg-muted)]">
          {eyebrow}
        </div>
        <div className="truncate text-[15px] font-extrabold tracking-[-0.01em] text-[color:var(--al-fg-1)]">
          {title}
        </div>
        {meta && (
          <div className="mt-0.5 truncate text-[11.5px] font-semibold text-[color:var(--al-fg-2)]">
            {meta}
          </div>
        )}
      </div>
      {tag && Tag && (
        <span className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
          TONE_CLASSES[tag.tone],
        )}>
          <Tag className="h-3 w-3" />
          {tag.label}
        </span>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="shrink-0 text-[12px] font-bold text-[color:var(--al-blue)] hover:underline"
        >
          {action.label}
        </button>
      )}
      {children}
    </div>
  );
}
