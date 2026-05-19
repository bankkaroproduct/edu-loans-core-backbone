import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StageBadge, StatusBadge } from "./StageBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SlidersHorizontal, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";
import { formatINR } from "@/lib/formatCurrency";
import { formatStageLabel } from "./StageBadge";

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

interface Filters {
  stages: string[];
  sources: string[];
  destinations: string[];
  intakes: string[];
  submittedFrom: string;
  submittedTo: string;
  loanMin: string;
  loanMax: string;
}

const EMPTY_FILTERS: Filters = {
  stages: [], sources: [], destinations: [], intakes: [],
  submittedFrom: "", submittedTo: "", loanMin: "", loanMax: "",
};

const STORAGE_KEY = "dashboard.yourLeads.v2";

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
    (f.submittedFrom || f.submittedTo ? 1 : 0) +
    (f.loanMin || f.loanMax ? 1 : 0)
  );
}

const CHIPS: { key: ChipKey; label: string }[] = [
  { key: "all", label: "All Leads" },
  { key: "documents_pending", label: "Documents Pending" },
  { key: "sent_to_lender", label: "Sent to Lender" },
  { key: "disbursed", label: "Disbursed" },
];

export function YourLeads({ leads, loading }: { leads: Lead[]; loading: boolean }) {
  const navigate = useNavigate();

  // Restore persisted state
  const persisted = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, []);

  const [chip, setChip] = useState<ChipKey>(persisted?.chip ?? "all");
  const [sort, setSort] = useState<SortKey>(persisted?.sort ?? "updated_desc");
  const [filters, setFilters] = useState<Filters>(persisted?.filters ?? EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] = useState<Filters>(filters);
  const [open, setOpen] = useState(false);

  // Persist
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ chip, sort, filters }));
    } catch { /* ignore */ }
  }, [chip, sort, filters]);

  // Derive destination/intake options from data
  const destinationOptions = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => l.intended_study_country && set.add(l.intended_study_country));
    return Array.from(set).sort();
  }, [leads]);

  const intakeOptions = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => set.add(`${l.intake_term} ${l.intake_year}`));
    return Array.from(set).sort();
  }, [leads]);

  const visible = useMemo(() => {
    let rows = leads.filter((l) => matchesChip(l, chip));

    if (filters.stages.length) rows = rows.filter((l) => filters.stages.includes(l.current_stage));
    if (filters.sources.length) rows = rows.filter((l) => filters.sources.includes(l.source_type));
    if (filters.destinations.length) rows = rows.filter((l) => filters.destinations.includes(l.intended_study_country));
    if (filters.intakes.length) rows = rows.filter((l) => filters.intakes.includes(`${l.intake_term} ${l.intake_year}`));
    if (filters.submittedFrom) {
      const from = new Date(filters.submittedFrom).getTime();
      rows = rows.filter((l) => new Date(l.created_at).getTime() >= from);
    }
    if (filters.submittedTo) {
      const to = new Date(filters.submittedTo).getTime() + 86400000;
      rows = rows.filter((l) => new Date(l.created_at).getTime() <= to);
    }
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
        case "amount_desc": return (b.loan_amount_required ?? 0) - (a.loan_amount_required ?? 0);
        case "amount_asc": return (a.loan_amount_required ?? 0) - (b.loan_amount_required ?? 0);
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
  }, [leads, chip, sort, filters]);

  const fcount = activeFilterCount(filters);

  const toggleArr = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const applyDraft = () => {
    setFilters(draftFilters);
    setOpen(false);
  };

  const resetAll = () => {
    setDraftFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
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

  return (
    <Card>
      <CardHeader className="pb-3 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base">Your Leads</CardTitle>
          <div className="flex items-center gap-2 ml-auto">
            <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setDraftFilters(filters); }}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 relative">
                  <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
                  Filters
                  {fcount > 0 && (
                    <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px]">{fcount}</Badge>
                  )}
                </Button>
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
                        <label key={o.value} className="flex items-center gap-2 text-xs cursor-pointer">
                          <Checkbox
                            checked={draftFilters.sources.includes(o.value)}
                            onCheckedChange={() => setDraftFilters({ ...draftFilters, sources: toggleArr(draftFilters.sources, o.value) })}
                          />
                          {o.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {destinationOptions.length > 0 && (
                    <div>
                      <Label className="text-xs font-semibold mb-2 block">Destination</Label>
                      <div className="grid grid-cols-3 gap-1.5 max-h-24 overflow-y-auto">
                        {destinationOptions.map((d) => (
                          <label key={d} className="flex items-center gap-2 text-xs cursor-pointer">
                            <Checkbox
                              checked={draftFilters.destinations.includes(d)}
                              onCheckedChange={() => setDraftFilters({ ...draftFilters, destinations: toggleArr(draftFilters.destinations, d) })}
                            />
                            {d}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {intakeOptions.length > 0 && (
                    <div>
                      <Label className="text-xs font-semibold mb-2 block">Intake</Label>
                      <div className="grid grid-cols-3 gap-1.5 max-h-24 overflow-y-auto">
                        {intakeOptions.map((i) => (
                          <label key={i} className="flex items-center gap-2 text-xs cursor-pointer">
                            <Checkbox
                              checked={draftFilters.intakes.includes(i)}
                              onCheckedChange={() => setDraftFilters({ ...draftFilters, intakes: toggleArr(draftFilters.intakes, i) })}
                            />
                            {i}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="text-xs font-semibold mb-2 block">Submitted Date</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="date"
                        className="h-8 text-xs"
                        value={draftFilters.submittedFrom}
                        onChange={(e) => setDraftFilters({ ...draftFilters, submittedFrom: e.target.value })}
                      />
                      <Input
                        type="date"
                        className="h-8 text-xs"
                        value={draftFilters.submittedTo}
                        onChange={(e) => setDraftFilters({ ...draftFilters, submittedTo: e.target.value })}
                      />
                    </div>
                  </div>

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
              <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
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

            <Button variant="link" size="sm" className="h-8" onClick={() => navigate("/leads")}>
              View All →
            </Button>
          </div>
        </div>

        {/* Quick chips row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {CHIPS.map((c) => (
            <Button
              key={c.key}
              variant={chip === c.key ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs px-3"
              onClick={() => handleChipClick(c.key)}
            >
              {c.label}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
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
            <Table>
              <TableHeader>
                <TableRow className="h-11">
                  <TableHead className="w-28">Lead ID</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead className="hidden md:table-cell">Destination</TableHead>
                  <TableHead className="hidden lg:table-cell">Course</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="whitespace-nowrap">Submitted On</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((lead) => (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer h-12"
                    onClick={() => navigate(`/leads/${lead.id}`)}
                  >
                    <TableCell className="font-mono text-xs">{lead.lead_id ?? "—"}</TableCell>
                    <TableCell className="font-medium text-sm">
                      {lead.student_full_name ?? `${lead.student_first_name} ${lead.student_last_name ?? ""}`.trim()}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      {lead.intended_study_country}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm max-w-[140px] truncate">
                      {lead.course_name}
                    </TableCell>
                    <TableCell><StageBadge stage={lead.current_stage} /></TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <StatusBadge status={lead.current_status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(lead.created_at)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(lead.updated_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
