import { Input } from "@/components/ui/input";
import { Calendar } from "lucide-react";
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
 * Funnel panel header — title + segmented date-range + custom date inputs.
 * Pure restyle; calls the existing setDateFilter / dateRange context.
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
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
      <div>
        <h3
          className="text-[16px] font-extrabold"
          style={{ letterSpacing: "-0.015em", color: "var(--pp-fg-1)" }}
        >
          Pipeline funnel
        </h3>
        <p
          className="text-[11.5px] font-medium tabular-nums"
          style={{ color: "var(--pp-fg-3)" }}
        >
          {dateDisplay} · Conversion at each step
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div
          className="inline-flex items-center gap-0.5 rounded-[8px] p-[3px]"
          style={{ background: "#F5F7FA" }}
        >
          {PRESETS.map((p) => {
            const isActive = active === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => onPick(p.value)}
                className={cn(
                  "px-3 py-1.5 rounded-[6px] text-[12px] font-semibold transition-colors",
                )}
                style={
                  isActive
                    ? {
                        background: "#fff",
                        color: "var(--pp-fg-1)",
                        boxShadow: "0 1px 2px rgba(16,24,40,0.08)",
                      }
                    : { color: "var(--pp-fg-2)", background: "transparent" }
                }
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {active === "custom" && (
          <div
            className="flex items-center gap-1.5 rounded-[8px] border px-2 py-1"
            style={{ borderColor: "var(--pp-border-3)", background: "#fff" }}
          >
            <Calendar className="h-3.5 w-3.5" style={{ color: "var(--pp-fg-3)" }} />
            <Input
              type="date"
              className="h-7 w-[130px] text-xs border-0 shadow-none focus-visible:ring-0 p-0"
              value={ctx.dateFrom}
              onChange={(e) => ctx.setDateFilter({ dateFrom: e.target.value })}
            />
            <span className="text-xs" style={{ color: "var(--pp-fg-3)" }}>
              →
            </span>
            <Input
              type="date"
              className="h-7 w-[130px] text-xs border-0 shadow-none focus-visible:ring-0 p-0"
              value={ctx.dateTo}
              onChange={(e) => ctx.setDateFilter({ dateTo: e.target.value })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
