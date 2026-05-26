import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { UserPlus, LogIn, BadgeCheck, HandCoins, Ban } from "lucide-react";
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

interface FunnelStep {
  key: string;
  label: string;
  value: number;
  tint: string;
  Icon: typeof UserPlus;
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
      <div className="px-5 py-6">
        <Skeleton className="h-24 w-full mb-4" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const steps: FunnelStep[] = [
    { key: "leads", label: "Leads", value: summary.leadCounts, tint: "var(--pp-blue)", Icon: UserPlus },
    { key: "logged_in", label: "Logged In", value: summary.loggedIn, tint: "var(--pp-warning)", Icon: LogIn },
    { key: "sanctioned", label: "Sanctioned", value: summary.sanctioned, tint: "var(--pp-success)", Icon: BadgeCheck },
    { key: "disbursed", label: "Disbursed", value: summary.disbursed, tint: "var(--pp-purple)", Icon: HandCoins },
    { key: "rejected", label: "Rejected", value: summary.rejected, tint: "var(--pp-error)", Icon: Ban },
  ];

  const maxVal = Math.max(1, ...steps.map((s) => s.value));

  return (
    <div>
      {/* Funnel cells */}
      <div className="px-5 pt-5 pb-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 relative">
          {steps.map((s, i) => {
            const isLast = i === steps.length - 1;
            const fillPct = (s.value / maxVal) * 100;
            return (
              <div
                key={s.key}
                className="relative rounded-[10px] border overflow-hidden"
                style={{
                  background: "#FAFBFC",
                  borderColor: "var(--pp-border-1)",
                  padding: "14px 14px 12px",
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="flex items-center justify-center rounded-[7px]"
                    style={{ width: 26, height: 26, background: s.tint, color: "#fff" }}
                  >
                    <s.Icon className="h-[14px] w-[14px]" />
                  </span>
                  <span
                    className="text-[11px] font-semibold uppercase"
                    style={{ letterSpacing: "0.06em", color: "var(--pp-fg-3)" }}
                  >
                    {s.label}
                  </span>
                </div>
                <div
                  className="text-[28px] font-extrabold tabular-nums"
                  style={{
                    letterSpacing: "-0.03em",
                    color: s.value === 0 ? "var(--pp-fg-zero)" : "var(--pp-fg-1)",
                  }}
                >
                  {s.value}
                </div>
                <div
                  className="mt-3 rounded-full overflow-hidden"
                  style={{ height: 4, background: "#ECEEF1" }}
                >
                  <div
                    className="h-full rounded-full transition-[width]"
                    style={{ width: `${fillPct}%`, background: s.tint }}
                  />
                </div>
                {!isLast && (
                  <span
                    aria-hidden
                    className="hidden lg:block absolute z-[1]"
                    style={{
                      right: -11,
                      top: "50%",
                      width: 22,
                      height: 22,
                      transform: "translateY(-50%) rotate(45deg)",
                      background: "#fff",
                      borderTop: "1px solid var(--pp-border-1)",
                      borderRight: "1px solid var(--pp-border-1)",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly breakdown */}
      <div className="border-t" style={{ borderColor: "var(--pp-border-2)" }}>
        <div
          className="px-5 pt-[18px] pb-2 text-[10.5px] font-bold uppercase"
          style={{ letterSpacing: "0.10em", color: "var(--pp-fg-3)" }}
        >
          Monthly breakdown
        </div>
        <div className="px-5 pb-4">
          <table className="w-full">
            <thead>
              <tr
                className="border-b"
                style={{ borderColor: "var(--pp-border-1)" }}
              >
                <ThLeft>Month</ThLeft>
                <ThRight>Leads</ThRight>
                <ThRight>Logged In</ThRight>
                <ThRight>Sanctioned</ThRight>
                <ThRight>Disbursed</ThRight>
                <ThRight last>Rejected</ThRight>
              </tr>
            </thead>
            <tbody>
              {isMulti && (
                <tr
                  className="border-b font-semibold"
                  style={{ borderColor: "var(--pp-border-2)", background: "#FAFBFC" }}
                >
                  <td className="py-3 pr-4 text-left text-[13px]" style={{ color: "var(--pp-fg-1)" }}>Total</td>
                  <Num v={summary.leadCounts} />
                  <Num v={summary.loggedIn} />
                  <Num v={summary.sanctioned} />
                  <Num v={summary.disbursed} />
                  <Num v={summary.rejected} last />
                </tr>
              )}
              {monthly.map((r) => (
                <tr
                  key={r.key}
                  className="border-b last:border-b-0"
                  style={{ borderColor: "var(--pp-border-2)" }}
                >
                  <td className="py-3 pr-4 text-left text-[13px]" style={{ color: "var(--pp-fg-2)" }}>
                    {r.label}
                  </td>
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

function ThLeft({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="py-2.5 pr-4 text-left text-[10.5px] font-bold uppercase"
      style={{ letterSpacing: "0.08em", color: "var(--pp-fg-3)" }}
    >
      {children}
    </th>
  );
}

function ThRight({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <th
      className={cn("py-2.5 text-right text-[10.5px] font-bold uppercase", last ? "pl-4" : "px-4")}
      style={{ letterSpacing: "0.08em", color: "var(--pp-fg-3)" }}
    >
      {children}
    </th>
  );
}

function Num({ v, last }: { v: number; last?: boolean }) {
  return (
    <td
      className={cn(
        "py-3 text-right text-[13px] font-bold tabular-nums",
        last ? "pl-4" : "px-4",
      )}
      style={{ color: v === 0 ? "var(--pp-fg-zero)" : "var(--pp-fg-1)" }}
    >
      {v}
    </td>
  );
}
