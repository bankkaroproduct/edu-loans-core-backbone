import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, X } from "lucide-react";
import { Constants } from "@/integrations/supabase/types";

export interface DashboardFilterValues {
  dateFrom: string;
  dateTo: string;
  stage: string;
  status: string;
  intake: string;
  destination: string;
}

const defaultFilters: DashboardFilterValues = {
  dateFrom: "",
  dateTo: "",
  stage: "",
  status: "",
  intake: "",
  destination: "",
};

interface Props {
  filters: DashboardFilterValues;
  onChange: (filters: DashboardFilterValues) => void;
  destinations: string[];
  intakes: string[];
}

export { defaultFilters };

export function DashboardFilters({ filters, onChange, destinations, intakes }: Props) {
  const hasFilters = Object.values(filters).some((v) => v !== "");

  const update = (key: keyof DashboardFilterValues, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="flex flex-wrap items-end gap-2 p-3 rounded-lg border bg-card">
      <Filter className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />

      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground">From</label>
        <Input
          type="date"
          className="h-8 w-[130px] text-xs"
          value={filters.dateFrom}
          onChange={(e) => update("dateFrom", e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground">To</label>
        <Input
          type="date"
          className="h-8 w-[130px] text-xs"
          value={filters.dateTo}
          onChange={(e) => update("dateTo", e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground">Stage</label>
        <Select value={filters.stage} onValueChange={(v) => update("stage", v)}>
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <SelectValue placeholder="All stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {Constants.public.Enums.lead_stage_enum.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground">Status</label>
        <Select value={filters.status} onValueChange={(v) => update("status", v)}>
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Constants.public.Enums.lead_status_enum.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground">Destination</label>
        <Select value={filters.destination} onValueChange={(v) => update("destination", v)}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {destinations.map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground">Intake</label>
        <Select value={filters.intake} onValueChange={(v) => update("intake", v)}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {intakes.map((i) => (
              <SelectItem key={i} value={i}>{i}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={() => onChange(defaultFilters)}
        >
          <X className="mr-1 h-3 w-3" /> Clear
        </Button>
      )}
    </div>
  );
}
