import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type StatCardTone = "default" | "primary" | "amber" | "emerald" | "destructive";

interface StatCardProps {
  label: string;
  value: number | string | null | undefined;
  sub?: ReactNode;
  icon: LucideIcon;
  /**
   * Semantic tone — apply only where it carries meaning.
   *   amber       = action required
   *   emerald     = positive outcome (closed/won)
   *   destructive = failed / rejected
   *   primary     = highlighted neutral
   *   default     = neutral count (preferred default)
   */
  tone?: StatCardTone;
  loading?: boolean;
  /** Optional in-app link wrapping the card. */
  to?: string;
  className?: string;
}

const TONE_STYLES: Record<StatCardTone, { bg: string; fg: string }> = {
  default: { bg: "bg-muted", fg: "text-muted-foreground" },
  primary: { bg: "bg-primary/10", fg: "text-primary" },
  amber: { bg: "bg-amber-100 dark:bg-amber-500/15", fg: "text-amber-700 dark:text-amber-400" },
  emerald: { bg: "bg-emerald-100 dark:bg-emerald-500/15", fg: "text-emerald-700 dark:text-emerald-400" },
  destructive: { bg: "bg-destructive/10", fg: "text-destructive" },
};

const fmt = (v: number | string | null | undefined) => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return v.toLocaleString("en-IN");
  return v;
};

/**
 * Compact admin stat card.
 *
 * Visual-only primitive — does not fetch or compute. Caller passes value/sub.
 * Tone is semantic, not decorative: use only when the color carries meaning
 * (amber = action, emerald = positive, destructive = failed). Default = neutral.
 */
export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
  loading,
  to,
  className,
}: StatCardProps) {
  const t = TONE_STYLES[tone];
  const showSkeleton = loading || value === null || value === undefined;

  const inner = (
    <Card
      className={cn(
        "p-4 h-full",
        to && "transition-colors hover:border-primary/40",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 h-full">
        <div className="space-y-1.5 min-w-0 flex-1">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide leading-tight">
            {label}
          </p>
          {showSkeleton ? (
            <Skeleton className="h-7 w-16" />
          ) : (
            <p className="text-2xl font-semibold tabular-nums leading-none text-foreground">
              {fmt(value)}
            </p>
          )}
          {sub !== undefined && sub !== null && sub !== "" && (
            <p
              className="text-[11px] text-muted-foreground leading-snug line-clamp-2"
              title={typeof sub === "string" ? sub : undefined}
            >
              {sub}
            </p>
          )}
        </div>
        <div className={cn("rounded-md p-2 shrink-0", t.bg)}>
          <Icon className={cn("h-4 w-4", t.fg)} />
        </div>
      </div>
    </Card>
  );

  if (to) {
    return (
      <Link to={to} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
        {inner}
      </Link>
    );
  }
  return inner;
}
