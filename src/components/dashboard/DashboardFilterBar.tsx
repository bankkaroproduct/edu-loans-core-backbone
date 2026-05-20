import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarRange } from "lucide-react";
import { useDashboardDateFilter, type DateRange } from "./DashboardDateFilterContext";

/**
 * Page-level filter bar for the partner Dashboard.
 * Drives both the summary stats table and the leads table below via the
 * shared DashboardDateFilterContext.
 */
export function DashboardFilterBar() {
  const ctx = useDashboardDateFilter();

  const onRangeChange = (v: string) => {
    const next = v as DateRange;
    ctx.setDateFilter({
      dateRange: next,
      ...(next !== "custom" ? { dateFrom: "", dateTo: "" } : {}),
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <CalendarRange className="h-4 w-4 text-muted-foreground" />
        Date range
      </div>

      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">Period</Label>
        <Select value={ctx.dateRange || "3m"} onValueChange={onRangeChange}>
          <SelectTrigger className="h-9 w-[180px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="3m">Last 3 Months</SelectItem>
            <SelectItem value="6m">Last 6 Months</SelectItem>
            <SelectItem value="custom">Custom Date Range</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {ctx.dateRange === "custom" && (
        <>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">From</Label>
            <Input
              type="date"
              className="h-9 w-[160px] text-sm"
              value={ctx.dateFrom}
              onChange={(e) => ctx.setDateFilter({ dateFrom: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">To</Label>
            <Input
              type="date"
              className="h-9 w-[160px] text-sm"
              value={ctx.dateTo}
              onChange={(e) => ctx.setDateFilter({ dateTo: e.target.value })}
            />
          </div>
        </>
      )}
    </div>
  );
}
