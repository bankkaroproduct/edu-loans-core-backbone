import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type StatCardTone = "default" | "primary" | "amber" | "emerald" | "destructive";
export type StatCardSize = "default" | "lg";

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
  /**
   * Visual density. `default` is the original compact style used everywhere.
   * `lg` is a premium tile (larger padding, bigger numerals, rounded-xl) —
   * opt-in only, used by the Admin Console dashboard. Backwards compatible.
   */
  size?: StatCardSize;
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
  size = "default",
}: StatCardProps) {
  const t = TONE_STYLES[tone];
  const showSkeleton = loading || value === null || value === undefined;
  const isLg = size === "lg";

  const inner = (
    <Card
      className={cn(
        isLg
          ? "p-5 h-full rounded-xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          : "p-4 h-full",
        to && "transition-colors hover:border-primary/40",
        className,
      )}
    >
      <div className={cn("flex items-start justify-between h-full", isLg ? "gap-4" : "gap-3")}>
        <div className={cn("min-w-0 flex-1", isLg ? "space-y-2" : "space-y-1.5")}>
          <p
            className={cn(
              "font-medium text-muted-foreground uppercase leading-tight",
              isLg ? "text-[11px] tracking-[0.12em]" : "text-[11px] tracking-wide",
            )}
          >
            {label}
          </p>
          {showSkeleton ? (
            <Skeleton className={isLg ? "h-9 w-20" : "h-7 w-16"} />
          ) : (
            <p
              className={cn(
                "font-semibold tabular-nums leading-none text-foreground",
                isLg ? "text-3xl" : "text-2xl",
              )}
            >
              {fmt(value)}
            </p>
          )}
          {sub !== undefined && sub !== null && sub !== "" && (
            <p
              className={cn(
                "text-muted-foreground leading-snug line-clamp-2",
                isLg ? "text-xs" : "text-[11px]",
              )}
              title={typeof sub === "string" ? sub : undefined}
            >
              {sub}
            </p>
          )}
        </div>
        <div
          className={cn(
            "shrink-0 flex items-center justify-center",
            isLg ? "rounded-xl h-10 w-10" : "rounded-md p-2",
            t.bg,
          )}
        >
          <Icon className={cn(isLg ? "h-5 w-5" : "h-4 w-4", t.fg)} />
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
