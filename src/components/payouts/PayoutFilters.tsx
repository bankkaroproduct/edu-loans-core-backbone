import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Search } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "triggered", label: "Triggered" },
  { value: "approved", label: "Approved" },
  { value: "paid", label: "Paid" },
  { value: "on_hold", label: "On Hold" },
  { value: "reversed", label: "Reversed" },
  { value: "cancelled", label: "Cancelled" },
];

interface Props {
  statusFilter: string;
  onStatusChange: (v: string) => void;
  searchTerm: string;
  onSearchChange: (v: string) => void;
  dateFrom: string;
  onDateFromChange: (v: string) => void;
  dateTo: string;
  onDateToChange: (v: string) => void;
  onClearAll: () => void;
  hasActiveFilters: boolean;
}

export function PayoutFilters({
  statusFilter, onStatusChange,
  searchTerm, onSearchChange,
  dateFrom, onDateFromChange,
  dateTo, onDateToChange,
  onClearAll, hasActiveFilters,
}: Props) {
  const chips: { label: string; onRemove: () => void }[] = [];
  if (statusFilter !== "all") chips.push({ label: `Status: ${statusFilter.replace(/_/g, " ")}`, onRemove: () => onStatusChange("all") });
  if (searchTerm) chips.push({ label: `Search: ${searchTerm}`, onRemove: () => onSearchChange("") });
  if (dateFrom) chips.push({ label: `From: ${dateFrom}`, onRemove: () => onDateFromChange("") });
  if (dateTo) chips.push({ label: `To: ${dateTo}`, onRemove: () => onDateToChange("") });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by Lead ID or student name..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger className="w-[160px] h-10 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={(e) => onDateFromChange(e.target.value)} className="w-[150px] h-10 shrink-0" placeholder="From" />
        <Input type="date" value={dateTo} onChange={(e) => onDateToChange(e.target.value)} className="w-[150px] h-10 shrink-0" placeholder="To" />
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          {chips.map((c) => (
            <Badge key={c.label} variant="secondary" className="gap-1 capitalize">
              {c.label}
              <X className="h-3 w-3 cursor-pointer" onClick={c.onRemove} />
            </Badge>
          ))}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onClearAll} className="text-xs h-6">
              Clear All
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
