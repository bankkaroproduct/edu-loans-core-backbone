import { useState } from "react";
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

export interface AdminLeadFilterState {
  search: string;
  source: "all" | "partner" | "student_direct";
  stage: "all" | StageEnum;
  status: "all" | StatusEnum;
  country: "all" | string;
  partnerId: "all" | string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
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
};

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
  if (filters.source !== "all") activeChips.push({ label: `Source: ${filters.source === "partner" ? "Partner" : "Student Portal"}`, clear: () => set("source", "all") });
  if (filters.stage !== "all") activeChips.push({ label: `Stage: ${stages.find(s => s.stage_key === filters.stage)?.stage_label ?? filters.stage}`, clear: () => set("stage", "all") });
  if (filters.status !== "all") activeChips.push({ label: `Status: ${statuses.find(s => s.status_key === filters.status)?.status_label ?? filters.status}`, clear: () => set("status", "all") });
  if (filters.country !== "all") activeChips.push({ label: `Country: ${filters.country}`, clear: () => set("country", "all") });
  if (filters.partnerId !== "all") activeChips.push({ label: `Partner: ${partners.find(p => p.id === filters.partnerId)?.display_name ?? "—"}`, clear: () => set("partnerId", "all") });
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
        <Select value={filters.source} onValueChange={(v) => set("source", v as any)}>
          <SelectTrigger className="w-full lg:w-[160px] h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="partner">Partner</SelectItem>
            <SelectItem value="student_direct">Student Portal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Row 2: stage / status / country / partner / date */}
      <div className="flex flex-wrap gap-2">
        <Select value={filters.stage} onValueChange={(v) => set("stage", v as any)}>
          <SelectTrigger className="w-[180px] h-9 text-xs">
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
          <SelectTrigger className="w-[180px] h-9 text-xs">
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
          <SelectTrigger className="w-[180px] h-9 text-xs">
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
          <SelectTrigger className="w-[200px] h-9 text-xs">
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
