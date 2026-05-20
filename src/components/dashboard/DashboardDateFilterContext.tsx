import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type DateField = "submitted" | "updated";
export type DateRange = "" | "7d" | "1m" | "this_month" | "3m" | "6m" | "1y" | "custom";

export interface DashboardDateFilterState {
  dateField: DateField;
  dateRange: DateRange;
  dateFrom: string;
  dateTo: string;
}

export const DEFAULT_DATE_FILTER: DashboardDateFilterState = {
  dateField: "submitted",
  dateRange: "3m",
  dateFrom: "",
  dateTo: "",
};

const SHARED_KEY = "dashboard.sharedDateFilter.v1";
const LEGACY_KEY = "dashboard.yourLeads.v4"; // one-time migration source

interface ContextValue extends DashboardDateFilterState {
  setDateFilter: (next: Partial<DashboardDateFilterState>) => void;
  resetDateFilter: () => void;
  /** Generic predicate: returns true if the given iso date string is in range. */
  isDateInRange: (iso: string | null | undefined, opts?: { useUpdated?: boolean; updatedIso?: string | null }) => boolean;
  /** Human-readable label for the currently active range. */
  rangeLabel: string;
  /** Human-readable label for the currently active date field. */
  fieldLabel: string;
}

const Ctx = createContext<ContextValue | null>(null);

function readInitial(): DashboardDateFilterState {
  if (typeof window === "undefined") return DEFAULT_DATE_FILTER;
  try {
    const raw = sessionStorage.getItem(SHARED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DashboardDateFilterState>;
      return { ...DEFAULT_DATE_FILTER, ...parsed };
    }
    // One-time seed from legacy YourLeads blob so returning users keep their window.
    const legacyRaw = sessionStorage.getItem(LEGACY_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      const f = legacy?.filters;
      if (f && (f.dateField || f.dateRange || f.dateFrom || f.dateTo)) {
        return {
          dateField: (f.dateField as DateField) || DEFAULT_DATE_FILTER.dateField,
          dateRange: (f.dateRange as DateRange) || DEFAULT_DATE_FILTER.dateRange,
          dateFrom: f.dateFrom || "",
          dateTo: f.dateTo || "",
        };
      }
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_DATE_FILTER;
}

const RANGE_LABELS: Record<DateRange, string> = {
  "": "All",
  "7d": "Last 7 Days",
  "1m": "Last Month",
  this_month: "This Month",
  "3m": "Last 3 Months",
  "6m": "Last 6 Months",
  "1y": "Last Year",
  custom: "Custom",
};

const RANGE_DAYS: Record<Exclude<DateRange, "" | "custom" | "this_month">, number> = {
  "7d": 7,
  "1m": 30,
  "3m": 90,
  "6m": 180,
  "1y": 365,
};

export function DashboardDateFilterProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DashboardDateFilterState>(readInitial);

  useEffect(() => {
    try {
      sessionStorage.setItem(SHARED_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const setDateFilter = useCallback((next: Partial<DashboardDateFilterState>) => {
    setState((prev) => ({ ...prev, ...next }));
  }, []);

  const resetDateFilter = useCallback(() => setState(DEFAULT_DATE_FILTER), []);

  const isDateInRange = useCallback(
    (iso: string | null | undefined, opts?: { useUpdated?: boolean; updatedIso?: string | null }) => {
      // Caller passes the "submitted/created" iso as primary `iso`; if dateField=updated
      // and an updatedIso is supplied, use that instead. This keeps the API simple for
      // both leads (created_at vs updated_at) and payouts (created_at vs updated_at).
      const effective = state.dateField === "updated" && opts?.updatedIso !== undefined
        ? opts.updatedIso
        : iso;
      if (!effective) return false;
      const t = new Date(effective).getTime();
      if (Number.isNaN(t)) return false;

      if (!state.dateRange) return true;
      if (state.dateRange === "custom") {
        if (state.dateFrom) {
          const from = new Date(state.dateFrom).getTime();
          if (t < from) return false;
        }
        if (state.dateTo) {
          const to = new Date(state.dateTo).getTime() + 86400000;
          if (t > to) return false;
        }
        return true;
      }
      if (state.dateRange === "this_month") {
        const now = new Date();
        const from = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        return t >= from;
      }
      const days = RANGE_DAYS[state.dateRange];
      const from = Date.now() - days * 86400000;
      return t >= from;
    },
    [state],
  );

  const value = useMemo<ContextValue>(
    () => ({
      ...state,
      setDateFilter,
      resetDateFilter,
      isDateInRange,
      rangeLabel: RANGE_LABELS[state.dateRange] ?? "Last 3 Months",
      fieldLabel: state.dateField === "updated" ? "Updated Date" : "Submitted Date",
    }),
    [state, setDateFilter, resetDateFilter, isDateInRange],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDashboardDateFilter(): ContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDashboardDateFilter must be used inside DashboardDateFilterProvider");
  return v;
}
