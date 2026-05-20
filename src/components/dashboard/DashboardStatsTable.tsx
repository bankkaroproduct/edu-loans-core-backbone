import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";
import {
  resolveDateWindow,
  useDashboardDateFilter,
} from "./DashboardDateFilterContext";

type Lead = Tables<"student_leads">;

interface Props {
  leads: Lead[];
  sanctionedEverIds: Set<string>;
  loading?: boolean;
}

// Stages considered "Logged In" — at or past login_submitted on the happy path.
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

const COLORS = {
  leads: "#3B82F6",
  loggedIn: "#F59E0B",
  sanctioned: "#10B981",
  disbursed: "#22C55E",
  rejected: "#EF4444",
} as const;

function monthLabel(y: number, m: number): string {
  return new Date(y, m, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function dayOnly(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit" });
}

function compute(key: string, label: string, rows: Lead[], sanctioned: Set<string>): Bucket {
  let loggedIn = 0, sanctionedC = 0, disbursed = 0, rejected = 0;
  for (const l of rows) {
    if (LOGGED_IN_STAGES.has(l.current_stage)) loggedIn++;
    if (sanctioned.has(l.id)) sanctionedC++;
    if (l.current_stage === "disbursed") disbursed++;
    if (REJECTED_STAGES.has(l.current_stage)) rejected++;
  }
  return { key, label, leadCounts: rows.length, loggedIn, sanctioned: sanctionedC, disbursed, rejected };
}

export function DashboardStatsTable({ leads, sanctionedEverIds, loading }: Props) {
  const ctx = useDashboardDateFilter();

  const { summary, monthly, isMulti } = useMemo(() => {
    const win = resolveDateWindow(ctx.dateRange, ctx.dateFrom, ctx.dateTo);
    const pickIso = (l: Lead): string | null =>
      ctx.dateField === "updated" ? l.updated_at : l.created_at;

    const total = compute("total", "Total", leads, sanctionedEverIds);

    const singleMonth =
      !win ||
      (win.start.getFullYear() === win.end.getFullYear() &&
        win.start.getMonth() === win.end.getMonth());

    if (singleMonth) {
      const label = win
        ? `${monthLabel(win.start.getFullYear(), win.start.getMonth())} (${dayOnly(win.start)}–${dayOnly(win.end)})`
        : "All time";
      return {
        summary: total,
        monthly: [{ ...total, key: "single", label }],
        isMulti: false,
      };
    }

    const months: Array<{ y: number; m: number }> = [];
    const cursor = new Date(win.start.getFullYear(), win.start.getMonth(), 1);
    const endCursor = new Date(win.end.getFullYear(), win.end.getMonth(), 1);
    while (cursor <= endCursor) {
      months.push({ y: cursor.getFullYear(), m: cursor.getMonth() });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    const buckets = months.map(({ y, m }) => {
      const monthStart = new Date(y, m, 1);
      const monthEnd = new Date(y, m + 1, 0);
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
      const label = `${monthLabel(y, m)} (${dayOnly(segStart)}–${dayOnly(segEnd)})`;
      return compute(`${y}-${m}`, label, inMonth, sanctionedEverIds);
    });

    return { summary: total, monthly: buckets, isMulti: true };
  }, [leads, sanctionedEverIds, ctx.dateRange, ctx.dateFrom, ctx.dateTo, ctx.dateField]);

  if (loading) {
    return (
      <div className="px-4 py-6">
        <Skeleton className="h-1.5 w-full mb-4" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const segments: Array<{ key: string; color: string; value: number }> = [
    { key: "leads", color: COLORS.leads, value: summary.leadCounts },
    { key: "loggedIn", color: COLORS.loggedIn, value: summary.loggedIn },
    { key: "sanctioned", color: COLORS.sanctioned, value: summary.sanctioned },
    { key: "disbursed", color: COLORS.disbursed, value: summary.disbursed },
    { key: "rejected", color: COLORS.rejected, value: summary.rejected },
  ];

  const nonZeroCount = segments.filter((s) => s.value > 0).length;
  const showColored = summary.leadCounts >= 3 && nonZeroCount >= 2;

  return (
    <div>
      {/* Proportion bar */}
      <div className="flex h-1.5 w-full overflow-hidden">
        {showColored ? (
          segments.map((s) =>
            s.value > 0 ? (
              <div key={s.key} style={{ flex: s.value, backgroundColor: s.color }} />
            ) : null,
          )
        ) : (
          <div className="w-full" style={{ backgroundColor: "#E5E7EB" }} />
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-5 divide-x divide-border">
        {[
          { label: "Leads", value: summary.leadCounts, color: COLORS.leads },
          { label: "Logged in", value: summary.loggedIn, color: COLORS.loggedIn },
          { label: "Sanctioned", value: summary.sanctioned, color: COLORS.sanctioned },
          { label: "Disbursed", value: summary.disbursed, color: COLORS.disbursed },
          { label: "Rejected", value: summary.rejected, color: COLORS.rejected },
        ].map((s) => (
          <div key={s.label} className="flex flex-col items-center justify-center gap-1 py-4">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: s.color }}
              aria-hidden
            />
            <span
              className={cn(
                "text-2xl font-medium tabular-nums",
                s.value === 0 ? "text-muted-foreground/60" : "text-foreground",
              )}
            >
              {s.value}
            </span>
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Monthly breakdown */}
      <div className="border-t border-border">
        <div className="px-4 pt-3 pb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
          Monthly breakdown
        </div>
        <div className="px-4 pb-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-2 text-left font-normal">Month</th>
                <th className="py-2 px-2 text-right font-normal">Leads</th>
                <th className="py-2 px-2 text-right font-normal">Logged in</th>
                <th className="py-2 px-2 text-right font-normal">Sanctioned</th>
                <th className="py-2 px-2 text-right font-normal">Disbursed</th>
                <th className="py-2 pl-2 text-right font-normal">Rejected</th>
              </tr>
            </thead>
            <tbody>
              {isMulti && (
                <tr className="border-b border-border bg-muted/40 font-semibold">
                  <td className="py-2 pr-2 text-left">Total</td>
                  <Num v={summary.leadCounts} />
                  <Num v={summary.loggedIn} />
                  <Num v={summary.sanctioned} />
                  <Num v={summary.disbursed} />
                  <Num v={summary.rejected} last />
                </tr>
              )}
              {monthly.map((r) => (
                <tr key={r.key} className="border-b border-border last:border-b-0">
                  <td className="py-2 pr-2 text-left text-muted-foreground">{r.label}</td>
                  <Num v={r.leadCounts} />
                  <Num v={r.loggedIn} />
                  <Num v={r.sanctioned} />
                  <Num v={r.disbursed} />
                  <Num v={r.rejected} last />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Num({ v, last }: { v: number; last?: boolean }) {
  return (
    <td
      className={cn(
        "py-2 text-right tabular-nums",
        last ? "pl-2" : "px-2",
        v === 0 ? "text-muted-foreground/60" : "text-foreground",
      )}
    >
      {v}
    </td>
  );
}
