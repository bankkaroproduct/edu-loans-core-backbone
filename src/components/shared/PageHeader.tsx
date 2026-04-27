import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Inline count badge rendered next to the title (e.g. number of rows in queue). */
  count?: number | null;
  /** Optional "Last updated · …" timestamp, rendered top-right next to actions. */
  lastUpdated?: Date | null;
  /** Right-side actions (CTAs, refresh, etc.) */
  children?: ReactNode;
  className?: string;
}

/**
 * Unified admin page header.
 *
 * Layout:
 *   [Title (text-2xl font-semibold)]  [count badge inline]   [Last updated · Refresh/CTA]
 *   [Subtitle (text-sm text-muted-foreground)]
 *   ─────────────── border-b border-border, pb-4 mb-6 ───────────────
 *
 * Visual-only — does not fetch counts itself; consumer passes `count` based on
 * data the page already loads. Logic-free.
 */
export function PageHeader({
  title,
  description,
  count,
  lastUpdated,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border pb-4 mb-6",
        className,
      )}
    >
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight leading-none">
            {title}
          </h1>
          {typeof count === "number" && (
            <Badge
              variant="secondary"
              className="text-xs font-medium tabular-nums"
              aria-label={`${count} total`}
            >
              {count.toLocaleString("en-IN")}
            </Badge>
          )}
        </div>
        {description && (
          <p className="text-sm text-muted-foreground max-w-prose">{description}</p>
        )}
      </div>

      {(lastUpdated || children) && (
        <div className="flex items-center gap-3 flex-wrap shrink-0 sm:pt-1">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
            </span>
          )}
          {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
        </div>
      )}
    </div>
  );
}
