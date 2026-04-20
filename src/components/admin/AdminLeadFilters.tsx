import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Search, CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type StageEnum = Database["public"]["Enums"]["lead_stage_enum"];
type StatusEnum = Database["public"]["Enums"]["lead_status_enum"];

export type SourceFilter =
  | "all"
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
  // New bifurcation dimensions
  type: TypeFilter;
  entryMode: EntryModeFilter;
  region: RegionFilter;
  loanRange: LoanRangeFilter;
  intake: IntakeFilter;
  loanType: LoanTypeFilter;
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
};

const SOURCE_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: "all", label: "All Sources" },
  { value: "partner_direct", label: "Partner — Direct" },
  { value: "partner_referral", label: "Partner — Referral" },
  { value: "student_portal", label: "Student Portal" },
  { value: "university_referral", label: "University Referral" },
];
const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "quick_lead", label: "Quick Lead" },
  { value: "full_lead", label: "Full Lead" },
];
const ENTRY_MODE_OPTIONS: { value: EntryModeFilter; label: string }[] = [
  { value: "all", label: "All Entry Modes" },
  { value: "add_lead", label: "Add Lead" },
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

interface Props {
  filters: AdminLeadFilterState;
  onChange: (next: AdminLeadFilterState) => void;
  searchInput: string;
  onSearchInputChange: (v: string) => void;
  stages: { stage_key: StageEnum; stage_label: string }[];
  statuses: { status_key: StatusEnum; status_label: string }[];
  countries: { country_name: string }[];
  partners: { id: string; display_name: string }[];
}

export function AdminLeadFilters({
  filters, onChange, searchInput, onSearchInputChange,
  stages, statuses, countries, partners,
}: Props) {
  const set = <K extends keyof AdminLeadFilterState>(key: K, val: AdminLeadFilterState[K]) =>
    onChange({ ...filters, [key]: val });

  const activeChips: { label: string; clear: () => void }[] = [];
  if (filters.source !== "all") activeChips.push({ label: `Source: ${labelOf(SOURCE_OPTIONS, filters.source)}`, clear: () => set("source", "all") });
  if (filters.stage !== "all") activeChips.push({ label: `Stage: ${stages.find(s => s.stage_key === filters.stage)?.stage_label ?? filters.stage}`, clear: () => set("stage", "all") });
  if (filters.status !== "all") activeChips.push({ label: `Status: ${statuses.find(s => s.status_key === filters.status)?.status_label ?? filters.status}`, clear: () => set("status", "all") });
  if (filters.country !== "all") activeChips.push({ label: `Country: ${filters.country}`, clear: () => set("country", "all") });
  if (filters.partnerId !== "all") activeChips.push({ label: `Partner: ${partners.find(p => p.id === filters.partnerId)?.display_name ?? "—"}`, clear: () => set("partnerId", "all") });
  if (filters.type !== "all") activeChips.push({ label: `Type: ${labelOf(TYPE_OPTIONS, filters.type)}`, clear: () => set("type", "all") });
  if (filters.entryMode !== "all") activeChips.push({ label: `Entry: ${labelOf(ENTRY_MODE_OPTIONS, filters.entryMode)}`, clear: () => set("entryMode", "all") });
  if (filters.region !== "all") activeChips.push({ label: `Region: ${labelOf(REGION_OPTIONS, filters.region)}`, clear: () => set("region", "all") });
  if (filters.loanRange !== "all") activeChips.push({ label: `Loan: ${labelOf(LOAN_RANGE_OPTIONS, filters.loanRange)}`, clear: () => set("loanRange", "all") });
  if (filters.intake !== "all") activeChips.push({ label: `Intake: ${labelOf(INTAKE_OPTIONS, filters.intake)}`, clear: () => set("intake", "all") });
  if (filters.loanType !== "all") activeChips.push({ label: `Loan Type: ${labelOf(LOAN_TYPE_OPTIONS, filters.loanType)}`, clear: () => set("loanType", "all") });
  if (filters.dateFrom) activeChips.push({ label: `From: ${format(filters.dateFrom, "dd MMM yyyy")}`, clear: () => set("dateFrom", undefined) });
  if (filters.dateTo) activeChips.push({ label: `To: ${format(filters.dateTo, "dd MMM yyyy")}`, clear: () => set("dateTo", undefined) });
  if (filters.search) activeChips.push({ label: `Search: "${filters.search}"`, clear: () => { onSearchInputChange(""); onChange({ ...filters, search: "" }); } });

  const clearAll = () => {
    onSearchInputChange("");
    onChange(defaultAdminLeadFilters);
  };

  return (
    <div className="space-y-3">
      {/* Row 1: search + source */}
      <div className="flex flex-col lg:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, or lead ID…"
            value={searchInput}
            onChange={(e) => onSearchInputChange(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={filters.source} onValueChange={(v) => set("source", v as SourceFilter)}>
          <SelectTrigger className="w-full lg:w-[200px] h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SOURCE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Row 2: stage / status / country / partner / date */}
      <div className="flex flex-wrap gap-2">
        <Select value={filters.stage} onValueChange={(v) => set("stage", v as any)}>
          <SelectTrigger className="w-[170px] h-9 text-xs">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            <SelectItem value="all">All Stages</SelectItem>
            {stages.map((s) => (
              <SelectItem key={s.stage_key} value={s.stage_key}>{s.stage_label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.status} onValueChange={(v) => set("status", v as any)}>
          <SelectTrigger className="w-[170px] h-9 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            <SelectItem value="all">All Statuses</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s.status_key} value={s.status_key}>{s.status_label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.country} onValueChange={(v) => set("country", v)}>
          <SelectTrigger className="w-[170px] h-9 text-xs">
            <SelectValue placeholder="Country" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            <SelectItem value="all">All Countries</SelectItem>
            {countries.map((c) => (
              <SelectItem key={c.country_name} value={c.country_name}>{c.country_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.partnerId} onValueChange={(v) => set("partnerId", v)}>
          <SelectTrigger className="w-[190px] h-9 text-xs">
            <SelectValue placeholder="Partner" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            <SelectItem value="all">All Partners</SelectItem>
            {partners.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("h-9 text-xs", !filters.dateFrom && "text-muted-foreground")}>
              <CalendarIcon className="mr-1 h-3.5 w-3.5" />
              {filters.dateFrom ? format(filters.dateFrom, "dd MMM") : "From"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={filters.dateFrom} onSelect={(d) => set("dateFrom", d)} initialFocus />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("h-9 text-xs", !filters.dateTo && "text-muted-foreground")}>
              <CalendarIcon className="mr-1 h-3.5 w-3.5" />
              {filters.dateTo ? format(filters.dateTo, "dd MMM") : "To"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={filters.dateTo} onSelect={(d) => set("dateTo", d)} initialFocus />
          </PopoverContent>
        </Popover>
      </div>

      {/* Row 3: business bifurcation — Type / Entry Mode / Region / Loan Range / Intake / Loan Type */}
      <div className="flex flex-wrap gap-2">
        <Select value={filters.type} onValueChange={(v) => set("type", v as TypeFilter)}>
          <SelectTrigger className="w-[150px] h-9 text-xs">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.entryMode} onValueChange={(v) => set("entryMode", v as EntryModeFilter)}>
          <SelectTrigger className="w-[170px] h-9 text-xs">
            <SelectValue placeholder="Entry Mode" />
          </SelectTrigger>
          <SelectContent>
            {ENTRY_MODE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.region} onValueChange={(v) => set("region", v as RegionFilter)}>
          <SelectTrigger className="w-[170px] h-9 text-xs">
            <SelectValue placeholder="Region" />
          </SelectTrigger>
          <SelectContent>
            {REGION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.loanRange} onValueChange={(v) => set("loanRange", v as LoanRangeFilter)}>
          <SelectTrigger className="w-[160px] h-9 text-xs">
            <SelectValue placeholder="Loan Range" />
          </SelectTrigger>
          <SelectContent>
            {LOAN_RANGE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.intake} onValueChange={(v) => set("intake", v as IntakeFilter)}>
          <SelectTrigger className="w-[140px] h-9 text-xs">
            <SelectValue placeholder="Intake" />
          </SelectTrigger>
          <SelectContent>
            {INTAKE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.loanType} onValueChange={(v) => set("loanType", v as LoanTypeFilter)}>
          <SelectTrigger className="w-[160px] h-9 text-xs">
            <SelectValue placeholder="Loan Type" />
          </SelectTrigger>
          <SelectContent>
            {LOAN_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

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
