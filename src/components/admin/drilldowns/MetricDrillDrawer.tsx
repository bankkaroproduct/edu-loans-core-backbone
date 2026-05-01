import { ReactNode } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

interface Chip {
  label: string;
  value: number | string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  totalLabel?: string;
  total?: number | string;
  chips?: Chip[];
  children: ReactNode;
}

export function MetricDrillDrawer({
  open, onOpenChange, title, description, totalLabel, total, chips, children,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <SheetTitle className="text-lg">{title}</SheetTitle>
            {total !== undefined && (
              <Badge variant="secondary" className="shrink-0 text-xs">
                {totalLabel ? `${totalLabel}: ` : ""}{total}
              </Badge>
            )}
          </div>
          {description && (
            <SheetDescription className="text-xs leading-relaxed">{description}</SheetDescription>
          )}
        </SheetHeader>

        {chips && chips.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {chips.map((c) => (
              <div
                key={c.label}
                className="px-2.5 py-1 rounded-full bg-muted text-xs font-medium text-foreground/80 border border-border/60"
              >
                <span className="text-muted-foreground">{c.label}:</span>{" "}
                <span className="tabular-nums">{c.value}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 space-y-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
