import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CalendarIcon, ChevronDown, Filter, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  defaultReportFilters,
  type ReportFilterState,
} from "@/lib/reportExports";
import {
  ENTRY_MODE_LABELS,
  INTAKE_LABELS,
  LOAN_RANGE_LABELS,
  LOAN_TYPE_LABELS,
  REGION_LABELS,
  SOURCE_LABELS,
  TYPE_LABELS,
  type EntryModeFilter,
  type IntakeFilter,
  type LoanRangeFilter,
  type LoanTypeFilter,
  type RegionFilter,
  type SourceFilter,
  type StageEnum,
  type StatusEnum,
  type TypeFilter,
} from "@/lib/leadBusinessFilters";

interface Props {
  filters: ReportFilterState;
  onChange: (next: ReportFilterState) => void;
  stages: { stage_key: StageEnum; stage_label: string }[];
  statuses: { status_key: StatusEnum; status_label: string }[];
  countries: { country_name: string }[];
  partners: { id: string; display_name: string }[];
}

const opt = <T extends string>(labels: Record<T, string>) =>
  (Object.keys(labels) as T[]).map((k) => ({ value: k, label: labels[k] }));

export function AdminReportFilters({ filters, onChange, stages, statuses, countries, partners }: Props) {
  const [open, setOpen] = useState(false);

  const set = <K extends keyof ReportFilterState>(key: K, val: ReportFilterState[K]) =>
    onChange({ ...filters, [key]: val });

  const activeCount = [
    filters.dateFrom,
    filters.dateTo,
    filters.partnerId !== "all" ? 1 : null,
    filters.source !== "all" ? 1 : null,
    filters.type !== "all" ? 1 : null,
    filters.entryMode !== "all" ? 1 : null,
    filters.region !== "all" ? 1 : null,
    filters.loanRange !== "all" ? 1 : null,
    filters.intake !== "all" ? 1 : null,
    filters.loanType !== "all" ? 1 : null,
    filters.stage && filters.stage !== "all" ? 1 : null,
    filters.status && filters.status !== "all" ? 1 : null,
    filters.country && filters.country !== "all" ? 1 : null,
    filters.editRequestStatus && filters.editRequestStatus !== "all" ? 1 : null,
    filters.newStage && filters.newStage !== "all" ? 1 : null,
  ].filter(Boolean).length;

  const clearAll = () => onChange(defaultReportFilters);

  return (
    <Card className="border-border/60">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters</span>
              {activeCount > 0 && (
                <span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                  {activeCount} active
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {activeCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearAll();
                  }}
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear all
                </Button>
              )}
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 space-y-3">
            {/* Row 1: Date From / Date To / Partner / Source */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-2">
              <div className="col-span-1 md:col-span-1 lg:col-span-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("w-full h-9 text-xs justify-start font-normal", !filters.dateFrom && "text-muted-foreground")}>
                      <CalendarIcon className="mr-1 h-3.5 w-3.5 shrink-0" />
                      {filters.dateFrom ? format(filters.dateFrom, "dd MMM yyyy") : "From"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={filters.dateFrom} onSelect={(d) => set("dateFrom", d)} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="col-span-1 md:col-span-1 lg:col-span-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("w-full h-9 text-xs justify-start font-normal", !filters.dateTo && "text-muted-foreground")}>
                      <CalendarIcon className="mr-1 h-3.5 w-3.5 shrink-0" />
                      {filters.dateTo ? format(filters.dateTo, "dd MMM yyyy") : "To"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={filters.dateTo} onSelect={(d) => set("dateTo", d)} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="col-span-1 md:col-span-1 lg:col-span-3">
                <Select value={filters.partnerId} onValueChange={(v) => set("partnerId", v)}>
                  <SelectTrigger className="w-full h-9 text-xs"><SelectValue placeholder="Partner" /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="all">All Partners</SelectItem>
                    {partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 md:col-span-1 lg:col-span-3">
                <Select value={filters.source} onValueChange={(v) => set("source", v as SourceFilter)}>
                  <SelectTrigger className="w-full h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {opt(SOURCE_LABELS).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Type / Entry Mode / Region / Loan Range / Intake / Loan Type */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-12 gap-2">
              <div className="col-span-1 lg:col-span-2">
                <Select value={filters.type} onValueChange={(v) => set("type", v as TypeFilter)}>
                  <SelectTrigger className="w-full h-9 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>{opt(TYPE_LABELS).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-1 lg:col-span-2">
                <Select value={filters.entryMode} onValueChange={(v) => set("entryMode", v as EntryModeFilter)}>
                  <SelectTrigger className="w-full h-9 text-xs"><SelectValue placeholder="Entry Mode" /></SelectTrigger>
                  <SelectContent>{opt(ENTRY_MODE_LABELS).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-1 lg:col-span-2">
                <Select value={filters.region} onValueChange={(v) => set("region", v as RegionFilter)}>
                  <SelectTrigger className="w-full h-9 text-xs"><SelectValue placeholder="Region" /></SelectTrigger>
                  <SelectContent>{opt(REGION_LABELS).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-1 lg:col-span-2">
                <Select value={filters.loanRange} onValueChange={(v) => set("loanRange", v as LoanRangeFilter)}>
                  <SelectTrigger className="w-full h-9 text-xs"><SelectValue placeholder="Loan Range" /></SelectTrigger>
                  <SelectContent>{opt(LOAN_RANGE_LABELS).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-1 lg:col-span-2">
                <Select value={filters.intake} onValueChange={(v) => set("intake", v as IntakeFilter)}>
                  <SelectTrigger className="w-full h-9 text-xs"><SelectValue placeholder="Intake" /></SelectTrigger>
                  <SelectContent>{opt(INTAKE_LABELS).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-1 lg:col-span-2">
                <Select value={filters.loanType} onValueChange={(v) => set("loanType", v as LoanTypeFilter)}>
                  <SelectTrigger className="w-full h-9 text-xs"><SelectValue placeholder="Loan Type" /></SelectTrigger>
                  <SelectContent>{opt(LOAN_TYPE_LABELS).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 3: Stage / Status / Country / Edit Request Status / New Stage (report-specific) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-12 gap-2">
              <div className="col-span-1 lg:col-span-3">
                <Select value={filters.stage ?? "all"} onValueChange={(v) => set("stage", v as any)}>
                  <SelectTrigger className="w-full h-9 text-xs"><SelectValue placeholder="Stage (Leads)" /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="all">All Stages (Leads)</SelectItem>
                    {stages.map((s) => <SelectItem key={s.stage_key} value={s.stage_key}>{s.stage_label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 lg:col-span-3">
                <Select value={filters.status ?? "all"} onValueChange={(v) => set("status", v as any)}>
                  <SelectTrigger className="w-full h-9 text-xs"><SelectValue placeholder="Status (Leads)" /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="all">All Statuses (Leads)</SelectItem>
                    {statuses.map((s) => <SelectItem key={s.status_key} value={s.status_key}>{s.status_label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 lg:col-span-2">
                <Select value={filters.country ?? "all"} onValueChange={(v) => set("country", v)}>
                  <SelectTrigger className="w-full h-9 text-xs"><SelectValue placeholder="Country" /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="all">All Countries</SelectItem>
                    {countries.map((c) => <SelectItem key={c.country_name} value={c.country_name}>{c.country_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 lg:col-span-2">
                <Select value={filters.newStage ?? "all"} onValueChange={(v) => set("newStage", v as any)}>
                  <SelectTrigger className="w-full h-9 text-xs"><SelectValue placeholder="New Stage (Movements)" /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="all">All Movements</SelectItem>
                    {stages.map((s) => <SelectItem key={s.stage_key} value={s.stage_key}>→ {s.stage_label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 lg:col-span-2">
                <Select value={filters.editRequestStatus ?? "all"} onValueChange={(v) => set("editRequestStatus", v as any)}>
                  <SelectTrigger className="w-full h-9 text-xs"><SelectValue placeholder="Request Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Request Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="applied">Applied</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
