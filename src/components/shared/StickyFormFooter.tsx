import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StickyFormFooterProps {
  /** Left-aligned slot — typically a secondary/destructive action or status text. */
  left?: ReactNode;
  /** Right-aligned slot — typically the primary CTA group. */
  right: ReactNode;
  className?: string;
}

/**
 * Standard sticky bottom footer for long form pages.
 * Matches the visual treatment used by the BRE editors' VersionActionBar.
 *
 * Layout:
 *   [secondary actions / status text]              [primary CTA group]
 *
 * Pages should add `pb-24` (or similar) to their root container so the
 * sticky footer doesn't overlap the last form field.
 */
export function StickyFormFooter({
  left,
  right,
  className,
}: StickyFormFooterProps) {
  return (
    <div
      className={cn(
        "sticky bottom-0 -mx-4 mt-6 border-t bg-background/95 px-4 py-3 backdrop-blur",
        "shadow-[0_-4px_12px_-8px_rgba(0,0,0,0.2)] md:mx-0 md:rounded-md md:border",
        className,
      )}
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 flex-wrap">{left}</div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {right}
        </div>
      </div>
    </div>
  );
}
