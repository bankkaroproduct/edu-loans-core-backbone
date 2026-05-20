import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/integrations/supabase/types";
import { useDashboardDateFilter } from "./DashboardDateFilterContext";

type Lead = Tables<"student_leads">;

interface Props {
  leads: Lead[];
  sanctionedEverIds: Set<string>;
  loading?: boolean;
}

// Stages considered "Logged In" — at or past login_submitted on the active
// happy path. Excludes off-track terminal/hold stages.
const LOGGED_IN_STAGES = new Set([
  "login_submitted",
  "credit_query",
  "sanction_received",
  "disbursed",
]);

const REJECTED_STAGES = new Set(["rejected", "dropped"]);

interface Bucket {
  key: string;
  label: string;
  leadCounts: number;
  loggedIn: number;
  sanctioned: number;
  disbursed: number;
  rejected: number;
}

function monthLabel(year: number, monthIdx: number): string {
  return new Date(year, monthIdx, 1).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
}

function dayMonth(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function computeBucket(
  key: string,
  label: string,
  rows: Lead[],
  sanctionedEverIds: Set<string>,
): Bucket {
  let loggedIn = 0;
  let sanctioned = 0;
  let disbursed = 0;
  let rejected = 0;
  for (const l of rows) {
    if (LOGGED_IN_STAGES.has(l.current_stage)) loggedIn++;
    if (sanctionedEverIds.has(l.id)) sanctioned++;
    if (l.current_stage === "disbursed") disbursed++;
    if (REJECTED_STAGES.has(l.current_stage)) rejected++;
  }
  return {
    key,
    label,
    leadCounts: rows.length,
    loggedIn,
    sanctioned,
    disbursed,
    rejected,
  };
}

/**
 * Resolves the active [start, end] window from the shared date context.
 * Returns null if the range is "all" (no bounds) — in that case we fall back
 * to the bounds of the data itself.
 */
function resolveWindow(
  dateRange: string,
  dateFrom: string,
  dateTo: string,
  leads: Lead[],
  dateField: "submitted" | "updated",
): { start: Date; end: Date } | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (dateRange === "this_month") {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: today };
  }
  if (dateRange === "custom") {
    if (dateFrom && dateTo) {
      return { start: new Date(dateFrom), end: new Date(dateTo) };
    }
    if (dateFrom) return { start: new Date(dateFrom), end: today };
    if (dateTo) {
      // No lower bound — fall back to earliest lead date in scope.
      const minIso = leads.reduce<string | null>((acc, l) => {
        const iso = dateField === "updated" ? l.updated_at : l.created_at;
        if (!iso) return acc;
        return !acc || iso < acc ? iso : acc;
      }, null);
      return { start: minIso ? new Date(minIso) : today, end: new Date(dateTo) };
    }
    return null;
  }
  const daysMap: Record<string, number> = {
    "7d": 7,
    "1m": 30,
    "3m": 90,
    "6m": 180,
    "1y": 365,
  };
  const days = daysMap[dateRange];
  if (days) {
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));
    return { start, end: today };
  }
  return null;
}

export function DashboardStatsTable({ leads, sanctionedEverIds, loading }: Props) {
  const ctx = useDashboardDateFilter();

  const rows = useMemo<Bucket[]>(() => {
    const win = resolveWindow(ctx.dateRange, ctx.dateFrom, ctx.dateTo, leads, ctx.dateField);

    // Helper — pick the effective date for a lead under the current dateField
    const pickIso = (l: Lead): string | null =>
      ctx.dateField === "updated" ? l.updated_at : l.created_at;

    // Single-month case (or no resolvable window)
    if (
      !win ||
      (win.start.getFullYear() === win.end.getFullYear() &&
        win.start.getMonth() === win.end.getMonth())
    ) {
      const label = win
        ? monthLabel(win.start.getFullYear(), win.start.getMonth())
        : "All time";
      return [computeBucket("single", label, leads, sanctionedEverIds)];
    }

    // Multi-month: Total + one row per calendar month inside the window
    const total = computeBucket("total", "Total", leads, sanctionedEverIds);

    // Walk months from start to end
    const months: Array<{ y: number; m: number }> = [];
    const cursor = new Date(win.start.getFullYear(), win.start.getMonth(), 1);
    const endCursor = new Date(win.end.getFullYear(), win.end.getMonth(), 1);
    while (cursor <= endCursor) {
      months.push({ y: cursor.getFullYear(), m: cursor.getMonth() });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const monthBuckets: Bucket[] = months.map(({ y, m }) => {
      const monthStart = new Date(y, m, 1);
      const monthEnd = new Date(y, m + 1, 0); // last day of month
      const segStart = monthStart < win.start ? win.start : monthStart;
      const segEnd = monthEnd > win.end ? win.end : monthEnd;
      const segStartT = segStart.getTime();
      const segEndT = segEnd.getTime() + 86400000 - 1;
      const inMonth = leads.filter((l) => {
        const iso = pickIso(l);
        if (!iso) return false;
        const t = new Date(iso).getTime();
        return t >= segStartT && t <= segEndT;
      });
      const label = `${monthLabel(y, m)} (${dayMonth(segStart)}–${dayMonth(segEnd)})`;
      return computeBucket(`${y}-${m}`, label, inMonth, sanctionedEverIds);
    });

    return [total, ...monthBuckets];
  }, [leads, sanctionedEverIds, ctx.dateRange, ctx.dateFrom, ctx.dateTo, ctx.dateField]);

  if (loading) {
    return (
      <Card className="p-4">
        <Skeleton className="h-6 w-40 mb-3" />
        <Skeleton className="h-32 w-full" />
      </Card>
    );
  }

  const isMulti = rows.length > 1;

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-left">Period</TableHead>
              <TableHead className="text-right">Lead Counts</TableHead>
              <TableHead className="text-right">Logged In</TableHead>
              <TableHead className="text-right">Sanctioned</TableHead>
              <TableHead className="text-right">Disbursed</TableHead>
              <TableHead className="text-right">Rejected</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, idx) => {
              const isTotal = isMulti && idx === 0;
              return (
                <TableRow
                  key={r.key}
                  className={
                    isTotal
                      ? "bg-muted/50 font-semibold border-b-2 border-border"
                      : undefined
                  }
                >
                  <TableCell className="text-left">{r.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.leadCounts}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.loggedIn}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.sanctioned}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.disbursed}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.rejected}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
