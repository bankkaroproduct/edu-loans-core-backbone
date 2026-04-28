import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { CardKey, DrilldownData, Segment } from "@/lib/dashboardDrilldowns";
import { buildDrilldown } from "@/lib/dashboardDrilldowns";
import { X } from "lucide-react";

interface Props {
  cardKey: CardKey | null;
  data: DrilldownData;
  onClose: () => void;
}

export function HeroDrillPanel({ cardKey, data, onClose }: Props) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [activeSegment, setActiveSegment] = useState<string | null>(null);

  const view = useMemo(() => (cardKey ? buildDrilldown(cardKey, data) : null), [cardKey, data]);

  // Reset segment filter when card changes
  useMemo(() => {
    setActiveSegment(null);
  }, [cardKey]);

  const filteredRecords = useMemo(() => {
    if (!view) return [];
    if (!activeSegment) return view.records;
    const seg = view.segments?.find((s) => s.key === activeSegment);
    if (!seg) return view.records;
    return view.records.filter((r) => seg.filterFn(r.id));
  }, [view, activeSegment]);

  const handleRowClick = (navTo: string) => {
    onClose();
    navigate(navTo);
  };

  return (
    <Sheet open={!!cardKey} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "p-0 flex flex-col gap-0",
          isMobile ? "h-[100dvh] w-full sm:max-w-full" : "w-[480px] sm:max-w-[480px]",
        )}
      >
        {view && (
          <>
            {/* Header */}
            <div className="px-6 py-5 border-b shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-foreground truncate">{view.title}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{view.subtitle}</p>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-md p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  aria-label="Close panel"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Bifurcation */}
            {view.segments && view.segments.length > 0 && filteredRecords.length >= 0 && view.records.length > 0 && (
              <div className="px-6 py-4 border-b shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Breakdown
                  </h3>
                  {activeSegment && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setActiveSegment(null)}>
                      Clear filter
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  {view.segments.map((seg) => (
                    <SegmentBar
                      key={seg.key}
                      seg={seg}
                      active={activeSegment === seg.key}
                      onClick={() =>
                        setActiveSegment((cur) => (cur === seg.key ? null : seg.key))
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Records */}
            <div className="flex-1 overflow-y-auto">
              {view.records.length === 0 ? (
                <div className="h-full flex items-center justify-center px-8 py-12">
                  <p className="text-sm text-muted-foreground text-center max-w-xs">
                    {view.emptyMessage ?? "No records to display."}
                  </p>
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="px-8 py-12 text-center">
                  <p className="text-sm text-muted-foreground">No records match the selected segment.</p>
                </div>
              ) : (
                <ul className="divide-y">
                  {filteredRecords.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => handleRowClick(r.navTo)}
                        className="w-full text-left px-6 py-3 hover:bg-muted/50 transition-colors focus:outline-none focus:bg-muted/50"
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-sm font-medium text-foreground truncate">{r.primary}</span>
                          {r.leadId && (
                            <span className="text-[11px] font-mono text-muted-foreground shrink-0">{r.leadId}</span>
                          )}
                        </div>
                        <div className="flex items-baseline justify-between gap-3 mt-1">
                          <span className="text-xs text-muted-foreground truncate">{r.secondary}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{r.meta}</span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SegmentBar({ seg, active, onClick }: { seg: Segment; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-md px-3 py-2 transition-colors",
        active ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/60",
      )}
    >
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span className="text-sm font-medium text-foreground truncate">{seg.label}</span>
        <span className="text-xs text-muted-foreground shrink-0">
          {seg.count} • {seg.percent}%
        </span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${Math.max(seg.percent, 2)}%` }}
        />
      </div>
    </button>
  );
}
