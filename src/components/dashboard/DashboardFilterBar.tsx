import { Input } from "@/components/ui/input";
import { CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  resolveDateWindow,
  useDashboardDateFilter,
  type DateRange,
} from "./DashboardDateFilterContext";

const PRESETS: { value: DateRange; label: string }[] = [
  { value: "this_month", label: "This Month" },
  { value: "3m", label: "Last 3 Months" },
  { value: "6m", label: "Last 6 Months" },
  { value: "custom", label: "Custom" },
];

function fmt(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

/**
 * Overview card header row: title + filter pills + date display.
 * Renders without its own card border — it lives inside the shared Overview card.
 */
export function DashboardFilterBar() {
  const ctx = useDashboardDateFilter();
  const active = ctx.dateRange || "3m";

  const onPick = (v: DateRange) => {
    ctx.setDateFilter({
      dateRange: v,
      ...(v !== "custom" ? { dateFrom: "", dateTo: "" } : {}),
    });
  };

  const win = resolveDateWindow(active, ctx.dateFrom, ctx.dateTo);
  const dateDisplay = win ? `${fmt(win.start)} – ${fmt(win.end)}` : "All time";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <h2 className="text-sm font-medium text-foreground">Overview</h2>

      <div className="flex flex-wrap items-center gap-1">
        <div className="flex items-center gap-0.5">
          {PRESETS.map((p) => {
            const isActive = active === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => onPick(p.value)}
                className={cn(
                  "h-7 rounded-md px-2.5 text-xs transition-colors",
                  isActive
                    ? "bg-secondary font-medium text-foreground"
                    : "font-normal text-muted-foreground hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="mx-2 h-5 w-px bg-border" />

        {active === "custom" ? (
          <div className="flex items-center gap-1.5">
            <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="date"
              className="h-7 w-[140px] text-xs"
              value={ctx.dateFrom}
              onChange={(e) => ctx.setDateFilter({ dateFrom: e.target.value })}
            />
            <span className="text-xs text-muted-foreground">–</span>
            <Input
              type="date"
              className="h-7 w-[140px] text-xs"
              value={ctx.dateTo}
              onChange={(e) => ctx.setDateFilter({ dateTo: e.target.value })}
            />
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarRange className="h-3.5 w-3.5" />
            <span className="tabular-nums">{dateDisplay}</span>
          </div>
        )}
      </div>
    </div>
  );
}
