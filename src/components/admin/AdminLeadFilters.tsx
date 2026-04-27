import { useMemo, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Search, CalendarIcon, X, Check, ChevronsUpDown, ChevronDown, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import {
  format,
  startOfDay,
  endOfDay,
  subDays,
  startOfMonth,
  endOfMonth,
  subMonths,
} from "date-fns";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type StageEnum = Database["public"]["Enums"]["lead_stage_enum"];
type StatusEnum = Database["public"]["Enums"]["lead_status_enum"];

export type SourceFilter =
  | "all"
  | "partner"
  | "student_direct"
  | "referral"
  | "partner_direct"
  | "partner_referral"
  | "student_portal"
  | "university_referral";
export type TypeFilter = "all" | "quick_lead" | "full_lead";
export type EntryModeFilter = "all" | "add_lead" | "bulk_upload" | "quick_lead" | "student_portal";
export type RegionFilter = "all" | "domestic" | "international";
export type LoanRangeFilter = "all" | "lt10" | "10to25" | "25to50" | "gt50";
export type IntakeFilter = "all" | "Spring" | "Fall" | "Summer";
export type LoanTypeFilter = "all" | "secured" | "unsecured";

export interface AdminLeadFilterState {
  search: string;
  source: SourceFilter;
  stage: "all" | StageEnum;
  status: "all" | StatusEnum;
  country: "all" | string;
  partnerId: "all" | string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  type: TypeFilter;
  entryMode: EntryModeFilter;
  region: RegionFilter;
  loanRange: LoanRangeFilter;
  intake: IntakeFilter;
  loanType: LoanTypeFilter;
  /**
   * When true, restrict the queue to leads whose latest activity (`updated_at`)
   * is older than 48h AND that are still in an actionable, non-terminal,
   * non-blocked state. Set by the "Stale > 48h" quick chip in AdminLeads.
   */
  staleOnly: boolean;
}

export const defaultAdminLeadFilters: AdminLeadFilterState = {
  search: "",
  source: "all",
  stage: "all",
  status: "all",
  country: "all",
  partnerId: "all",
  dateFrom: undefined,
  dateTo: undefined,
  type: "all",
  entryMode: "all",
  region: "all",
  loanRange: "all",
  intake: "all",
  loanType: "all",
  staleOnly: false,
};

// Primary visible source buckets (admin-thinking first)
const SOURCE_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: "all", label: "All Sources" },
  { value: "partner", label: "Partner" },
  { value: "student_direct", label: "Student Direct" },
  { value: "referral", label: "Referral" },
];
// NOTE: legacy granular source values (partner_direct, partner_referral, university_referral,
// student_portal) are NOT exposed in the UI. They remain in the SourceFilter union purely for
// URL hydration of old shared links — collapsed to the simplified primary buckets when displayed.
const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "quick_lead", label: "Quick Lead" },
  { value: "full_lead", label: "Full Lead" },
];
const ENTRY_MODE_OPTIONS: { value: EntryModeFilter; label: string }[] = [
  { value: "all", label: "All Entry Modes" },
  { value: "add_lead", label: "Manual Add" },
  { value: "bulk_upload", label: "Bulk Upload" },
  { value: "quick_lead", label: "Quick Lead" },
  { value: "student_portal", label: "Student Portal" },
];
const REGION_OPTIONS: { value: RegionFilter; label: string }[] = [
  { value: "all", label: "All Regions" },
  { value: "domestic", label: "Domestic (India)" },
  { value: "international", label: "International" },
];
const LOAN_RANGE_OPTIONS: { value: LoanRangeFilter; label: string }[] = [
  { value: "all", label: "Any Loan Amount" },
  { value: "lt10", label: "< ₹10L" },
  { value: "10to25", label: "₹10L – ₹25L" },
  { value: "25to50", label: "₹25L – ₹50L" },
  { value: "gt50", label: "₹50L+" },
];
const INTAKE_OPTIONS: { value: IntakeFilter; label: string }[] = [
  { value: "all", label: "All Intakes" },
  { value: "Spring", label: "Spring" },
  { value: "Fall", label: "Fall" },
  { value: "Summer", label: "Summer" },
];
const LOAN_TYPE_OPTIONS: { value: LoanTypeFilter; label: string }[] = [
  { value: "all", label: "Any Loan Type" },
  { value: "secured", label: "Secured" },
  { value: "unsecured", label: "Unsecured" },
];

const labelOf = <T extends { value: string; label: string }>(opts: T[], v: string) =>
  opts.find((o) => o.value === v)?.label ?? v;

// =================== SearchableSelect (inline) ===================
interface SearchableSelectProps {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  allLabel: string;
  searchPlaceholder?: string;
  className?: string;
}
function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  allLabel,
  searchPlaceholder = "Search…",
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const selectedLabel =
    value === "all" ? allLabel : options.find((o) => o.value === value)?.label ?? placeholder;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full h-9 text-xs justify-between font-normal",
            value === "all" && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0 pointer-events-auto" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-9 text-xs" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={allLabel}
                onSelect={() => {
                  onChange("all");
                  setOpen(false);
                }}
                className="text-xs"
              >
                <Check className={cn("mr-2 h-3.5 w-3.5", value === "all" ? "opacity-100" : "opacity-0")} />
                {allLabel}
              </CommandItem>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.label}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className="text-xs"
                >
                  <Check
                    className={cn("mr-2 h-3.5 w-3.5", value === o.value ? "opacity-100" : "opacity-0")}
                  />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// =================== DateRangeControl (inline) ===================
type DateRangePreset = "today" | "last7" | "last30" | "thisMonth" | "lastMonth";
const PRESETS: { key: DateRangePreset; label: string; resolve: () => { from: Date; to: Date } }[] = [
  { key: "today", label: "Today", resolve: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  { key: "last7", label: "Last 7 Days", resolve: () => ({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) }) },
  { key: "last30", label: "Last 30 Days", resolve: () => ({ from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) }) },
  { key: "thisMonth", label: "This Month", resolve: () => ({ from: startOfMonth(new Date()), to: endOfDay(new Date()) }) },
  { key: "lastMonth", label: "Last Month", resolve: () => {
      const last = subMonths(new Date(), 1);
      return { from: startOfMonth(last), to: endOfMonth(last) };
    } },
];

function sameDay(a?: Date, b?: Date) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function detectPreset(from?: Date, to?: Date): DateRangePreset | null {
  if (!from || !to) return null;
  for (const p of PRESETS) {
    const r = p.resolve();
    if (sameDay(from, r.from) && sameDay(to, r.to)) return p.key;
  }
  return null;
}

interface DateRangeControlProps {
  from: Date | undefined;
  to: Date | undefined;
  onApply: (from: Date | undefined, to: Date | undefined) => void;
}
function DateRangeControl({ from, to, onApply }: DateRangeControlProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<DateRange | undefined>(
    from || to ? { from, to } : undefined,
  );

  // Sync pending state when external filters change (e.g. Clear All / preset click)
  useEffect(() => {
    setPending(from || to ? { from, to } : undefined);
  }, [from, to]);

  const presetKey = detectPreset(from, to);
  const triggerLabel = (() => {
    if (presetKey) return PRESETS.find((p) => p.key === presetKey)!.label;
    if (from && to) return `${format(from, "dd MMM")} – ${format(to, "dd MMM yyyy")}`;
    if (from) return `From ${format(from, "dd MMM yyyy")}`;
    if (to) return `Until ${format(to, "dd MMM yyyy")}`;
    return "Date range";
  })();

  const applyPreset = (key: DateRangePreset) => {
    const r = PRESETS.find((p) => p.key === key)!.resolve();
    onApply(r.from, r.to);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full h-9 text-xs justify-start font-normal",
            !from && !to && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="mr-1.5 h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{triggerLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
        <div className="flex">
          <div className="flex flex-col border-r p-2 min-w-[140px] gap-0.5">
            {PRESETS.map((p) => (
              <Button
                key={p.key}
                variant={presetKey === p.key ? "secondary" : "ghost"}
                size="sm"
                className="justify-start text-xs h-8"
                onClick={() => applyPreset(p.key)}
              >
                {p.label}
              </Button>
            ))}
            <div className="border-t my-1" />
            <Button
              variant="ghost"
              size="sm"
              className="justify-start text-xs h-8 text-muted-foreground"
              onClick={() => {
                setPending(undefined);
                onApply(undefined, undefined);
                setOpen(false);
              }}
            >
              Clear
            </Button>
          </div>
          <div className="p-2">
            <Calendar
              mode="range"
              selected={pending}
              onSelect={setPending}
              numberOfMonths={1}
              initialFocus
              className={cn("p-0 pointer-events-auto")}
            />
            <div className="flex items-center justify-between pt-2 border-t mt-2">
              <span className="text-[11px] text-muted-foreground">
                {pending?.from && pending?.to
                  ? `${format(pending.from, "dd MMM")} – ${format(pending.to, "dd MMM yyyy")}`
                  : pending?.from
                  ? `From ${format(pending.from, "dd MMM yyyy")}`
                  : "Pick a range"}
              </span>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  onApply(pending?.from, pending?.to);
                  setOpen(false);
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// =================== Main component ===================
interface Props {
  filters: AdminLeadFilterState;
  onChange: (next: AdminLeadFilterState) => void;
  searchInput: string;
  onSearchInputChange: (v: string) => void;
  stages: { stage_key: StageEnum; stage_label: string }[];
  statuses: { stage_key: StageEnum; status_key: StatusEnum; status_label: string }[];
  countries: { country_name: string }[];
  partners: { id: string; display_name: string }[];
}

export function AdminLeadFilters({
  filters, onChange, searchInput, onSearchInputChange,
  stages, statuses, countries, partners,
}: Props) {
  const set = <K extends keyof AdminLeadFilterState>(key: K, val: AdminLeadFilterState[K]) =>
    onChange({ ...filters, [key]: val });

  // Stage → Status narrowing. When Stage is "all" → unique statuses across all stages.
  // When a specific stage is selected → only statuses configured for that stage.
  const visibleStatuses = useMemo(() => {
    if (filters.stage === "all") {
      const seen = new Set<string>();
      return statuses.filter((s) => {
        if (seen.has(s.status_key)) return false;
        seen.add(s.status_key);
        return true;
      });
    }
    return statuses.filter((s) => s.stage_key === filters.stage);
  }, [statuses, filters.stage]);

  // Stage change handler: auto-clear Status if it becomes invalid for the new Stage.
  const handleStageChange = (nextStage: "all" | StageEnum) => {
    let nextStatus = filters.status;
    let didReset = false;
    if (nextStage !== "all" && filters.status !== "all") {
      const stillValid = statuses.some(
        (s) => s.stage_key === nextStage && s.status_key === filters.status,
      );
      if (!stillValid) {
        nextStatus = "all";
        didReset = true;
      }
    }
    onChange({ ...filters, stage: nextStage, status: nextStatus });
    if (didReset) {
      toast.info("Status reset because it does not apply to the selected stage.");
    }
  };

  // Determine the visible primary source value (collapse legacy granular into primary buckets)
  const primarySourceValue: SourceFilter = useMemo(() => {
    switch (filters.source) {
      case "partner_direct":
      case "partner_referral":
        return "partner";
      case "student_portal":
        return "student_direct";
      case "university_referral":
        return "referral";
      default:
        return filters.source;
    }
  }, [filters.source]);

  // Count of active "advanced" (row 2) filters
  const advancedActiveCount = useMemo(() => {
    let n = 0;
    if (filters.country !== "all") n++;
    if (filters.type !== "all") n++;
    if (filters.entryMode !== "all") n++;
    if (filters.region !== "all") n++;
    if (filters.loanRange !== "all") n++;
    if (filters.intake !== "all") n++;
    if (filters.loanType !== "all") n++;
    return n;
  }, [filters]);

  const [advancedOpen, setAdvancedOpen] = useState(advancedActiveCount > 0);
  // Auto-open advanced when URL hydration reveals advanced filters
  useEffect(() => {
    if (advancedActiveCount > 0) setAdvancedOpen(true);
  }, [advancedActiveCount]);

  const countryOptions = useMemo(
    () => countries.map((c) => ({ value: c.country_name, label: c.country_name })),
    [countries],
  );
  const partnerOptions = useMemo(
    () => partners.map((p) => ({ value: p.id, label: p.display_name })),
    [partners],
  );

  const activeChips: { label: string; clear: () => void }[] = [];
  if (filters.search) activeChips.push({ label: `Search: "${filters.search}"`, clear: () => { onSearchInputChange(""); onChange({ ...filters, search: "" }); } });
  if (filters.source !== "all") {
    // Always display the simplified primary label; legacy granular values
    // collapse to their primary bucket (e.g. partner_referral → "Referral").
    const lbl = labelOf(SOURCE_OPTIONS, primarySourceValue);
    activeChips.push({ label: `Source: ${lbl}`, clear: () => set("source", "all") });
  }
  if (filters.stage !== "all") activeChips.push({ label: `Stage: ${stages.find(s => s.stage_key === filters.stage)?.stage_label ?? filters.stage}`, clear: () => set("stage", "all") });
  if (filters.status !== "all") activeChips.push({ label: `Status: ${statuses.find(s => s.status_key === filters.status)?.status_label ?? filters.status}`, clear: () => set("status", "all") });
  if (filters.partnerId !== "all") activeChips.push({ label: `Partner: ${partners.find(p => p.id === filters.partnerId)?.display_name ?? "—"}`, clear: () => set("partnerId", "all") });
  if (filters.dateFrom || filters.dateTo) {
    const lbl = filters.dateFrom && filters.dateTo
      ? `${format(filters.dateFrom, "dd MMM")} – ${format(filters.dateTo, "dd MMM yyyy")}`
      : filters.dateFrom
        ? `From ${format(filters.dateFrom, "dd MMM yyyy")}`
        : `Until ${format(filters.dateTo!, "dd MMM yyyy")}`;
    activeChips.push({ label: `Date: ${lbl}`, clear: () => onChange({ ...filters, dateFrom: undefined, dateTo: undefined }) });
  }
  if (filters.country !== "all") activeChips.push({ label: `Country: ${filters.country}`, clear: () => set("country", "all") });
  if (filters.type !== "all") activeChips.push({ label: `Type: ${labelOf(TYPE_OPTIONS, filters.type)}`, clear: () => set("type", "all") });
  if (filters.entryMode !== "all") activeChips.push({ label: `Entry: ${labelOf(ENTRY_MODE_OPTIONS, filters.entryMode)}`, clear: () => set("entryMode", "all") });
  if (filters.region !== "all") activeChips.push({ label: `Region: ${labelOf(REGION_OPTIONS, filters.region)}`, clear: () => set("region", "all") });
  if (filters.loanRange !== "all") activeChips.push({ label: `Loan: ${labelOf(LOAN_RANGE_OPTIONS, filters.loanRange)}`, clear: () => set("loanRange", "all") });
  if (filters.intake !== "all") activeChips.push({ label: `Intake: ${labelOf(INTAKE_OPTIONS, filters.intake)}`, clear: () => set("intake", "all") });
  if (filters.loanType !== "all") activeChips.push({ label: `Loan Type: ${labelOf(LOAN_TYPE_OPTIONS, filters.loanType)}`, clear: () => set("loanType", "all") });
  if (filters.staleOnly) activeChips.push({ label: "Stale > 48h", clear: () => set("staleOnly", false) });

  const clearAll = () => {
    onSearchInputChange("");
    onChange(defaultAdminLeadFilters);
  };

  return (
    <div className="space-y-3">
      {/* PRIMARY ROW */}
      <div className="grid grid-cols-2 md:grid-cols-6 lg:grid-cols-12 gap-2">
        <div className="relative col-span-2 md:col-span-6 lg:col-span-4">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, or lead ID…"
            value={searchInput}
            onChange={(e) => onSearchInputChange(e.target.value)}
            className="pl-9 h-9 w-full"
          />
        </div>

        <div className="col-span-1 md:col-span-2 lg:col-span-2">
          <Select
            value={primarySourceValue}
            onValueChange={(v) => set("source", v as SourceFilter)}
          >
            <SelectTrigger className="w-full h-9 text-xs">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-1 md:col-span-2 lg:col-span-2">
          <Select value={filters.stage} onValueChange={(v) => handleStageChange(v as "all" | StageEnum)}>
            <SelectTrigger className="w-full h-9 text-xs">
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="all">All Stages</SelectItem>
              {stages.map((s) => (
                <SelectItem key={s.stage_key} value={s.stage_key}>{s.stage_label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-1 md:col-span-2 lg:col-span-2">
          <Select value={filters.status} onValueChange={(v) => set("status", v as any)}>
            <SelectTrigger className="w-full h-9 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="all">All Statuses</SelectItem>
              {visibleStatuses.map((s) => (
                <SelectItem key={s.status_key} value={s.status_key}>{s.status_label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filters.stage !== "all" && (
            <p className="text-[10px] text-muted-foreground mt-1 px-0.5">
              Showing statuses for selected stage
            </p>
          )}
        </div>

        <div className="col-span-1 md:col-span-3 lg:col-span-2">
          <SearchableSelect
            value={filters.partnerId}
            onChange={(v) => set("partnerId", v)}
            options={partnerOptions}
            placeholder="Partner"
            allLabel="All Partners"
            searchPlaceholder="Search partners…"
          />
        </div>

        <div className="col-span-2 md:col-span-3 lg:col-span-12 xl:col-span-12">
          <DateRangeControl
            from={filters.dateFrom}
            to={filters.dateTo}
            onApply={(f, t) => onChange({ ...filters, dateFrom: f, dateTo: t })}
          />
        </div>
      </div>

      {/* ADVANCED TOGGLE + ROW */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <div className="flex items-center justify-between">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 px-2 -ml-2">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              More filters
              {advancedActiveCount > 0 && (
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px] ml-0.5">
                  {advancedActiveCount}
                </Badge>
              )}
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  advancedOpen && "rotate-180",
                )}
              />
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
          <div className="grid grid-cols-2 md:grid-cols-6 lg:grid-cols-12 gap-2 pt-2">
            <div className="col-span-1 md:col-span-2 lg:col-span-3">
              <SearchableSelect
                value={filters.country}
                onChange={(v) => set("country", v)}
                options={countryOptions}
                placeholder="Country"
                allLabel="All Countries"
                searchPlaceholder="Search countries…"
              />
            </div>

            {/* Source Detail removed — primary Source filter is the single source control.
                Legacy granular values still hydrate from URL and collapse to primary labels. */}

            <div className="col-span-1 md:col-span-2 lg:col-span-3">
              <Select value={filters.type} onValueChange={(v) => set("type", v as TypeFilter)}>
                <SelectTrigger className="w-full h-9 text-xs">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-1 md:col-span-2 lg:col-span-3">
              <Select value={filters.entryMode} onValueChange={(v) => set("entryMode", v as EntryModeFilter)}>
                <SelectTrigger className="w-full h-9 text-xs">
                  <SelectValue placeholder="Entry Mode" />
                </SelectTrigger>
                <SelectContent>
                  {ENTRY_MODE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-1 md:col-span-2 lg:col-span-3">
              <Select value={filters.region} onValueChange={(v) => set("region", v as RegionFilter)}>
                <SelectTrigger className="w-full h-9 text-xs">
                  <SelectValue placeholder="Region" />
                </SelectTrigger>
                <SelectContent>
                  {REGION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-1 md:col-span-2 lg:col-span-3">
              <Select value={filters.loanRange} onValueChange={(v) => set("loanRange", v as LoanRangeFilter)}>
                <SelectTrigger className="w-full h-9 text-xs">
                  <SelectValue placeholder="Loan Range" />
                </SelectTrigger>
                <SelectContent>
                  {LOAN_RANGE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-1 md:col-span-2 lg:col-span-3">
              <Select value={filters.intake} onValueChange={(v) => set("intake", v as IntakeFilter)}>
                <SelectTrigger className="w-full h-9 text-xs">
                  <SelectValue placeholder="Intake" />
                </SelectTrigger>
                <SelectContent>
                  {INTAKE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-1 md:col-span-2 lg:col-span-3">
              <Select value={filters.loanType} onValueChange={(v) => set("loanType", v as LoanTypeFilter)}>
                <SelectTrigger className="w-full h-9 text-xs">
                  <SelectValue placeholder="Loan Type" />
                </SelectTrigger>
                <SelectContent>
                  {LOAN_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Active chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeChips.map((c, i) => (
            <Badge key={i} variant="secondary" className="text-[10px] gap-1">
              {c.label}
              <button type="button" onClick={c.clear} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button variant="ghost" size="sm" onClick={clearAll} className="h-6 text-xs">Clear all</Button>
        </div>
      )}
    </div>
  );
}
