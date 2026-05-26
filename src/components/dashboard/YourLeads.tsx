import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";
import { formatINR } from "@/lib/formatCurrency";
import { formatStageLabel } from "./StageBadge";
import { buildIntakeSessionOptions } from "@/lib/intakeSession";
import { formatDisplayLabel } from "@/lib/formatDisplayLabel";
import { useLeadMasterData } from "@/hooks/useLeadMasterData";
import { useDashboardDateFilter } from "./DashboardDateFilterContext";
import {
  initials,
  avatarColor,
  partnerColor,
} from "@/components/admin/dashboard/visualHelpers";

// ---- Local presentational pills (snake_case → color map) ----
type PillTone = { bg: string; fg: string; dot: string };
const STAGE_TONES: Record<string, PillTone> = {
  submitted: { bg: "#FFF8E6", fg: "#8C6D00", dot: "#E5A800" },
  documents_pending: { bg: "#FFF0E6", fg: "#B5470F", dot: "#FF6D1D" },
  documents_under_review: { bg: "#FFF8E6", fg: "#8C6D00", dot: "#E5A800" },
  sent_to_lender: { bg: "#F3EEFF", fg: "#6B2BD9", dot: "#9747FF" },
  sanctioned: { bg: "#ECFBF3", fg: "#167C3D", dot: "#26A651" },
  sanction_received: { bg: "#ECFBF3", fg: "#167C3D", dot: "#26A651" },
  disbursed: { bg: "#ECFBF3", fg: "#167C3D", dot: "#26A651" },
};
const STATUS_TONES: Record<string, PillTone> = {
  awaiting_verification: { bg: "#FFF0E6", fg: "#B5470F", dot: "#FF6D1D" },
  in_progress: { bg: "#EEF2FF", fg: "#0036DA", dot: "#0036DA" },
  verified: { bg: "#ECFBF3", fg: "#167C3D", dot: "#26A651" },
  under_review: { bg: "#FFF8E6", fg: "#8C6D00", dot: "#E5A800" },
};
const NEUTRAL_TONE: PillTone = { bg: "#F1F3F6", fg: "#45505C", dot: "#9AA3AE" };

function Pill({ tone, label }: { tone: PillTone; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold whitespace-nowrap"
      style={{ background: tone.bg, color: tone.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.dot }} />
      {label}
    </span>
  );
}

function StagePill({ stage }: { stage: string }) {
  const tone = STAGE_TONES[stage] ?? NEUTRAL_TONE;
  return <Pill tone={tone} label={formatStageLabel(stage)} />;
}

function StatusPill({ status }: { status: string }) {
  const tone = STATUS_TONES[status] ?? NEUTRAL_TONE;
  return <Pill tone={tone} label={formatStageLabel(status)} />;
}




type Lead = Tables<"student_leads">;
type PayoutRecord = Tables<"partner_payout_records">;

type ChipKey = "all" | "attention" | "documents_pending" | "sent_to_lender" | "disbursed";
type SortKey =
  | "updated_desc"
  | "created_desc"
  | "created_asc"
  | "amount_desc"
  | "amount_asc"
  | "stage_progression"
  | "attention_first";

const ATTENTION_STAGES = ["documents_pending", "on_hold", "credit_query"];
const ATTENTION_STATUSES = ["pending_info", "reupload_needed", "query_raised"];

const STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "submitted", label: "Submitted" },
  { value: "under_initial_review", label: "Under Review" },
  { value: "login_submitted", label: "Login Submitted" },
  { value: "credit_query", label: "Credit Query" },
  { value: "sanction_received", label: "Sanction Received" },
  { value: "rejected", label: "Rejected" },
  { value: "dropped", label: "Dropped" },
  { value: "on_hold", label: "On Hold" },
];

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: "quick_lead", label: "Quick Lead" },
  { value: "add_lead", label: "Add Lead" },
  { value: "bulk_upload", label: "Bulk Upload" },
];

// Stage progression order (lower = earlier)
const STAGE_ORDER: Record<string, number> = {
  draft: 0, submitted: 1, under_initial_review: 2, documents_pending: 3,
  documents_under_review: 4, bre_evaluated: 5, sent_to_lender: 6, login_submitted: 7,
  credit_query: 8, sanction_received: 9, disbursed: 10, on_hold: 11, rejected: 12, dropped: 13,
};

type DateField = "submitted" | "updated";
type DateRange = "" | "7d" | "1m" | "3m" | "1y" | "custom";

interface Filters {
  stages: string[];
  sources: string[];
  destinations: string[];
  intakes: string[]; // composite keys: `${term}|${year}`
  loanMin: string;
  loanMax: string;
}

const EMPTY_FILTERS: Filters = {
  stages: [], sources: [], destinations: [], intakes: [],
  loanMin: "", loanMax: "",
};

const STORAGE_KEY = "dashboard.yourLeads.v4";

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function isAttention(l: Lead): boolean {
  return ATTENTION_STAGES.includes(l.current_stage)
    || ATTENTION_STATUSES.includes(l.current_status)
    || l.duplicate_flag;
}

function matchesChip(l: Lead, chip: ChipKey): boolean {
  switch (chip) {
    case "all": return true;
    case "attention": return isAttention(l);
    case "documents_pending": return l.current_stage === "documents_pending";
    case "sent_to_lender": return l.current_stage === "sent_to_lender";
    case "disbursed": return l.current_stage === "disbursed";
  }
}

function activeFilterCount(f: Filters): number {
  return (
    (f.stages.length ? 1 : 0) +
    (f.sources.length ? 1 : 0) +
    (f.destinations.length ? 1 : 0) +
    (f.intakes.length ? 1 : 0) +
    (f.loanMin || f.loanMax ? 1 : 0)
  );
}

const CHIPS: { key: ChipKey; label: string }[] = [
  { key: "all", label: "All Leads" },
  { key: "documents_pending", label: "Documents Pending" },
  { key: "sent_to_lender", label: "Sent to Lender" },
  { key: "disbursed", label: "Disbursed" },
];

export function YourLeads({ leads, loading, payouts = [] }: { leads: Lead[]; loading: boolean; payouts?: PayoutRecord[] }) {
  const navigate = useNavigate();
  const dateCtx = useDashboardDateFilter();

  // Restore persisted state. Legacy blobs may contain date fields under
  // `filters` (pre-shared-context); we strip them silently — the shared date
  // context owns those values now and persists to its own key.
  const persisted = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.filters) {
        const { dateField: _df, dateRange: _dr, dateFrom: _from, dateTo: _to, ...rest } = parsed.filters;
        parsed.filters = rest;
      }
      return parsed;
    } catch { return null; }
  }, []);

  const [chip, setChip] = useState<ChipKey>(persisted?.chip ?? "all");
  const [sort, setSort] = useState<SortKey>(persisted?.sort ?? "updated_desc");
  const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS, ...(persisted?.filters ?? {}) });
  const [draftFilters, setDraftFilters] = useState<Filters>(filters);
  // Draft copy of date filter (popover working state). Synced from context on open.
  const [draftDate, setDraftDate] = useState({
    dateField: dateCtx.dateField,
    dateRange: dateCtx.dateRange,
    dateFrom: dateCtx.dateFrom,
    dateTo: dateCtx.dateTo,
  });
  const [open, setOpen] = useState(false);

  // Persist non-date filters only. Date filter lives in shared context with its own key.
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ chip, sort, filters }));
    } catch { /* ignore */ }
  }, [chip, sort, filters]);

  const { intakes: intakeMasterRows } = useLeadMasterData();

  // Destination options — display label is formatted (e.g. "india" → "India"),
  // but the underlying value used for filtering stays exactly as stored.
  const destinationOptions = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => l.intended_study_country && set.add(l.intended_study_country));
    return Array.from(set)
      .map((value) => ({ value, label: formatDisplayLabel(value) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [leads]);

  // Intake options come from the product-wide intake master (not just the
  // currently visible leads). Helper handles null-safety, dedupe, and the
  // canonical "Jul-Sep-2026" label format.
  const intakeOptions = useMemo(
    () => buildIntakeSessionOptions(intakeMasterRows),
    [intakeMasterRows],
  );

  // Most-recent payout record per lead (payouts arrive ordered by created_at desc)
  const payoutByLead = useMemo(() => {
    const m = new Map<string, PayoutRecord>();
    for (const p of payouts) {
      if (p.lead_id && !m.has(p.lead_id)) m.set(p.lead_id, p);
    }
    return m;
  }, [payouts]);

  const visible = useMemo(() => {
    let rows = leads.filter((l) => matchesChip(l, chip));

    if (filters.stages.length) rows = rows.filter((l) => filters.stages.includes(l.current_stage));
    if (filters.sources.length) rows = rows.filter((l) => filters.sources.includes(l.source_type));
    if (filters.destinations.length) rows = rows.filter((l) => filters.destinations.includes(l.intended_study_country));
    if (filters.intakes.length) {
      rows = rows.filter((l) => {
        if (!l.intake_term || !l.intake_year) return false;
        return filters.intakes.includes(`${l.intake_term}|${l.intake_year}`);
      });
    }
    // Date filter — sourced from shared context. Operates on either created_at or updated_at.
    rows = rows.filter((l) =>
      dateCtx.isDateInRange(l.created_at, { updatedIso: l.updated_at }),
    );
    if (filters.loanMin) {
      const min = Number(filters.loanMin);
      rows = rows.filter((l) => (l.loan_amount_required ?? 0) >= min);
    }
    if (filters.loanMax) {
      const max = Number(filters.loanMax);
      rows = rows.filter((l) => (l.loan_amount_required ?? 0) <= max);
    }

    const sorted = [...rows].sort((a, b) => {
      switch (sort) {
        case "updated_desc": return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        case "created_desc": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "created_asc": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "amount_desc": {
          const av = a.loan_amount_required, bv = b.loan_amount_required;
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          return bv - av;
        }
        case "amount_asc": {
          const av = a.loan_amount_required, bv = b.loan_amount_required;
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          return av - bv;
        }
        case "stage_progression": return (STAGE_ORDER[a.current_stage] ?? 99) - (STAGE_ORDER[b.current_stage] ?? 99);
        case "attention_first": {
          const aA = isAttention(a) ? 0 : 1;
          const bA = isAttention(b) ? 0 : 1;
          if (aA !== bA) return aA - bA;
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        }
      }
    });
    return sorted.slice(0, 12);
  }, [leads, chip, sort, filters, dateCtx]);

  const fcount = activeFilterCount(filters);

  const toggleArr = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const applyDraft = () => {
    setFilters(draftFilters);
    dateCtx.setDateFilter(draftDate);
    setOpen(false);
  };

  const resetAll = () => {
    setDraftFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setDraftDate({ dateField: "submitted", dateRange: "3m", dateFrom: "", dateTo: "" });
    dateCtx.resetDateFilter();
    setChip("all");
  };

  const handleChipClick = (key: ChipKey) => {
    setChip(key);
    // Avoid contradiction: clear stage filter when chip implies a stage
    if (key === "documents_pending" || key === "sent_to_lender" || key === "disbursed") {
      if (filters.stages.length) {
        setFilters({ ...filters, stages: [] });
        setDraftFilters({ ...draftFilters, stages: [] });
      }
    }
  };

  // Per-tab counts derived from the already-fetched leads array.
  // No new query, no new state — pure useMemo over existing data.
  const chipCounts = useMemo(() => {
    const c: Record<ChipKey, number> = {
      all: 0, attention: 0, documents_pending: 0, sent_to_lender: 0, disbursed: 0,
    };
    for (const l of leads) {
      if (matchesChip(l, "all")) c.all++;
      if (matchesChip(l, "attention")) c.attention++;
      if (matchesChip(l, "documents_pending")) c.documents_pending++;
      if (matchesChip(l, "sent_to_lender")) c.sent_to_lender++;
      if (matchesChip(l, "disbursed")) c.disbursed++;
    }
    return c;
  }, [leads]);

  const sortLabel =
    sort === "updated_desc" ? "Latest Updated"
    : sort === "created_desc" ? "Newest Submitted"
    : sort === "created_asc" ? "Oldest Submitted"
    : sort === "amount_desc" ? "Highest Loan Amount"
    : sort === "amount_asc" ? "Lowest Loan Amount"
    : sort === "stage_progression" ? "Stage Progression"
    : "Action Required First";

  return (
    <section
      className="rounded-[12px] border bg-white"
      style={{ borderColor: "var(--pp-border-1)" }}
    >
      <header
        className="flex items-start justify-between gap-3 flex-wrap px-5 py-4 border-b"
        style={{ borderColor: "var(--pp-border-2)" }}
      >
        <div>
          <h3
            className="text-[16px] font-extrabold"
            style={{ letterSpacing: "-0.015em", color: "var(--pp-fg-1)" }}
          >
            Your Leads
          </h3>
          <p className="text-[11.5px] font-medium" style={{ color: "var(--pp-fg-3)" }}>
            Sorted by {sortLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Popover open={open} onOpenChange={(o) => {
            setOpen(o);
            if (o) {
              setDraftFilters(filters);
              setDraftDate({
                dateField: dateCtx.dateField,
                dateRange: dateCtx.dateRange,
                dateFrom: dateCtx.dateFrom,
                dateTo: dateCtx.dateTo,
              });
            }
          }}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-[7px] border bg-white px-3 py-1.5 text-[12.5px] font-semibold"
                style={{ borderColor: "var(--pp-border-3)", color: "var(--pp-fg-2)" }}
              >
                <SlidersHorizontal className="h-[15px] w-[15px]" />
                Filters
                {fcount > 0 && (
                  <Badge variant="secondary" className="ml-0.5 h-4 px-1.5 text-[10px]">{fcount}</Badge>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[420px] p-0" align="end">
              <div className="max-h-[480px] overflow-y-auto p-4 space-y-4">
                <div>
                  <Label className="text-xs font-semibold mb-2 block">Stage</Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {STAGE_OPTIONS.map((o) => (
                      <label key={o.value} className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox
                          checked={draftFilters.stages.includes(o.value)}
                          onCheckedChange={() => setDraftFilters({ ...draftFilters, stages: toggleArr(draftFilters.stages, o.value) })}
                        />
                        {o.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold mb-2 block">Source</Label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {SOURCE_OPTIONS.map((o) => (
                      <label key={o.value} className="flex items-center gap-2 text-xs cursor-pointer min-w-0" title={o.label}>
                        <Checkbox
                          checked={draftFilters.sources.includes(o.value)}
                          onCheckedChange={() => setDraftFilters({ ...draftFilters, sources: toggleArr(draftFilters.sources, o.value) })}
                        />
                        <span className="truncate">{o.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {destinationOptions.length > 0 && (
                  <div>
                    <Label className="text-xs font-semibold mb-2 block">Destination</Label>
                    <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pr-1">
                      {destinationOptions.map((d) => (
                        <label key={d.value} className="flex items-center gap-2 text-xs cursor-pointer min-w-0" title={d.label}>
                          <Checkbox
                            checked={draftFilters.destinations.includes(d.value)}
                            onCheckedChange={() => setDraftFilters({ ...draftFilters, destinations: toggleArr(draftFilters.destinations, d.value) })}
                          />
                          <span className="truncate">{d.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {intakeOptions.length > 0 && (
                  <div>
                    <Label className="text-xs font-semibold mb-2 block">Intake</Label>
                    <div className="grid grid-cols-3 gap-1.5 max-h-32 overflow-y-auto pr-1">
                      {intakeOptions.map((i) => (
                        <label key={i.value} className="flex items-center gap-2 text-xs cursor-pointer min-w-0" title={i.label}>
                          <Checkbox
                            checked={draftFilters.intakes.includes(i.value)}
                            onCheckedChange={() => setDraftFilters({ ...draftFilters, intakes: toggleArr(draftFilters.intakes, i.value) })}
                          />
                          <span className="truncate">{i.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-xs font-semibold mb-2 block">Loan Amount (₹)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      className="h-8 text-xs"
                      value={draftFilters.loanMin}
                      onChange={(e) => setDraftFilters({ ...draftFilters, loanMin: e.target.value })}
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      className="h-8 text-xs"
                      value={draftFilters.loanMax}
                      onChange={(e) => setDraftFilters({ ...draftFilters, loanMax: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 border-t p-3">
                <Button variant="ghost" size="sm" className="h-8" onClick={resetAll}>Reset</Button>
                <Button size="sm" className="h-8" onClick={applyDraft}>Apply</Button>
              </div>
            </PopoverContent>
          </Popover>

          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger
              className="h-8 min-w-[170px] text-[12.5px] font-semibold rounded-[7px]"
              style={{ borderColor: "var(--pp-border-3)" }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated_desc">Latest Updated</SelectItem>
              <SelectItem value="created_desc">Newest Submitted</SelectItem>
              <SelectItem value="created_asc">Oldest Submitted</SelectItem>
              <SelectItem value="amount_desc">Highest Loan Amount</SelectItem>
              <SelectItem value="amount_asc">Lowest Loan Amount</SelectItem>
              <SelectItem value="stage_progression">Stage Progression</SelectItem>
              <SelectItem value="attention_first">Action Required First</SelectItem>
            </SelectContent>
          </Select>

          <button
            type="button"
            onClick={() => navigate("/leads")}
            className="inline-flex items-center gap-1 text-[12.5px] font-semibold px-1"
            style={{ color: "var(--pp-blue)" }}
          >
            View All
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="px-5 pt-3 pb-1">
        <div
          className="inline-flex items-center gap-1.5 rounded-[8px] p-[2px]"
          style={{ background: "#F5F7FA" }}
        >
          {CHIPS.map((c) => {
            const isActive = chip === c.key;
            const count = chipCounts[c.key];
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => handleChipClick(c.key)}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-[6px] text-[12.5px] font-semibold transition-colors"
                style={
                  isActive
                    ? { background: "#1C1B1F", color: "#fff" }
                    : { color: "var(--pp-fg-2)", background: "transparent" }
                }
              >
                {c.label}
                <span
                  className="inline-flex items-center justify-center text-[10.5px] font-bold tabular-nums rounded-full"
                  style={
                    isActive
                      ? { background: "rgba(255,255,255,0.18)", color: "#fff", padding: "1px 6px" }
                      : { background: "#E5E7EB", color: "var(--pp-fg-2)", padding: "1px 6px" }
                  }
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-5 pb-5 pt-2">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm text-muted-foreground mb-3">
              {leads.length === 0
                ? "No leads submitted yet. Add your first lead or upload a batch to get started."
                : "No leads match the current filter."}
            </p>
            {leads.length === 0 ? (
              <Button size="sm" onClick={() => navigate("/leads/new")}>Add Lead</Button>
            ) : (
              <Button size="sm" variant="outline" onClick={resetAll}>Clear filters</Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr
                  className="border-b"
                  style={{ borderColor: "var(--pp-border-1)", background: "var(--pp-bg-header)" }}
                >
                  <Th>Lead ID</Th>
                  <Th>Student</Th>
                  <Th className="hidden md:table-cell">Destination</Th>
                  <Th className="hidden lg:table-cell">Course</Th>
                  <Th>Stage</Th>
                  <Th className="hidden sm:table-cell">Status</Th>
                  <Th right>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1"
                      onClick={() => setSort(sort === "amount_desc" ? "amount_asc" : "amount_desc")}
                    >
                      Loan Amount
                      {sort === "amount_desc" ? <ArrowDown className="h-3 w-3" />
                        : sort === "amount_asc" ? <ArrowUp className="h-3 w-3" />
                        : <ArrowUpDown className="h-3 w-3 opacity-50" />}
                    </button>
                  </Th>
                  <Th right className="hidden md:table-cell">Expected Payout</Th>
                  <Th className="hidden lg:table-cell">Payout Status</Th>
                  <Th>Submitted On</Th>
                  <Th right>Updated</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((lead) => {
                  const p = payoutByLead.get(lead.id);
                  const name =
                    lead.student_full_name ??
                    `${lead.student_first_name ?? ""} ${lead.student_last_name ?? ""}`.trim() ??
                    "Student";
                  const country = lead.intended_study_country
                    ? formatDisplayLabel(lead.intended_study_country)
                    : "—";
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => navigate(`/leads/${lead.id}`)}
                      className="cursor-pointer border-b transition-colors hover:bg-[var(--pp-bg-row-hover)]"
                      style={{ borderColor: "var(--pp-border-2)" }}
                    >
                      <Td>
                        <span
                          className="font-mono text-[12px]"
                          style={{ color: "var(--pp-fg-2)" }}
                        >
                          {lead.lead_id ?? "—"}
                        </span>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <span
                            className="flex h-7 w-7 items-center justify-center rounded-full text-[10.5px] font-bold text-white shrink-0"
                            style={{ background: avatarColor(name) }}
                          >
                            {initials(name)}
                          </span>
                          <span className="text-[13.5px] font-semibold" style={{ color: "var(--pp-fg-1)" }}>
                            {name}
                          </span>
                        </div>
                      </Td>
                      <Td className="hidden md:table-cell">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ background: partnerColor(country) }}
                          />
                          <span className="text-[12.5px]" style={{ color: "var(--pp-fg-1)" }}>
                            {country}
                          </span>
                        </div>
                      </Td>
                      <Td className="hidden lg:table-cell">
                        <span className="text-[13px] block max-w-[160px] truncate" style={{ color: "var(--pp-fg-1)" }}>
                          {lead.course_name ?? "—"}
                        </span>
                      </Td>
                      <Td><StagePill stage={lead.current_stage} /></Td>
                      <Td className="hidden sm:table-cell">
                        <StatusPill status={lead.current_status} />
                      </Td>
                      <Td right>
                        {lead.loan_amount_required != null ? (
                          <span
                            className="text-[13px] font-bold tabular-nums whitespace-nowrap"
                            style={{ letterSpacing: "-0.01em", color: "var(--pp-fg-1)" }}
                          >
                            {formatINR(lead.loan_amount_required)}
                          </span>
                        ) : (
                          <span style={{ color: "var(--pp-fg-zero)" }}>—</span>
                        )}
                      </Td>
                      <Td right className="hidden md:table-cell">
                        {p && p.payout_amount != null ? (
                          <span
                            className="text-[13px] font-bold tabular-nums whitespace-nowrap"
                            style={{ letterSpacing: "-0.01em", color: "var(--pp-fg-1)" }}
                          >
                            {formatINR(p.payout_amount)}
                          </span>
                        ) : (
                          <span
                            className="italic text-[12.5px]"
                            style={{ color: "var(--pp-fg-zero)" }}
                          >
                            Not calculated
                          </span>
                        )}
                      </Td>
                      <Td className="hidden lg:table-cell">
                        {p?.payout_status ? (
                          <span
                            className="inline-flex rounded-full px-2 py-0.5 text-[11.5px] font-semibold"
                            style={{ background: "#F1F3F6", color: "var(--pp-fg-2)" }}
                          >
                            {formatStageLabel(p.payout_status)}
                          </span>
                        ) : (
                          <span
                            className="italic text-[12.5px]"
                            style={{ color: "var(--pp-fg-zero)" }}
                          >
                            Not calculated
                          </span>
                        )}
                      </Td>
                      <Td>
                        <span className="text-[12.5px] tabular-nums whitespace-nowrap" style={{ color: "var(--pp-fg-2)" }}>
                          {fmtDate(lead.created_at)}
                        </span>
                      </Td>
                      <Td right>
                        <span className="text-[12.5px] tabular-nums whitespace-nowrap" style={{ color: "var(--pp-fg-2)" }}>
                          {fmtDate(lead.updated_at)}
                        </span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function Th({
  children,
  right,
  className,
}: { children: React.ReactNode; right?: boolean; className?: string }) {
  return (
    <th
      className={`py-3 px-4 text-[10.5px] font-bold uppercase whitespace-nowrap ${right ? "text-right" : "text-left"} ${className ?? ""}`}
      style={{ letterSpacing: "0.08em", color: "var(--pp-fg-3)" }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  right,
  className,
}: { children: React.ReactNode; right?: boolean; className?: string }) {
  return (
    <td
      className={`py-3.5 px-4 text-[13px] ${right ? "text-right" : "text-left"} ${className ?? ""}`}
      style={{ color: "var(--pp-fg-1)" }}
    >
      {children}
    </td>
  );
}

