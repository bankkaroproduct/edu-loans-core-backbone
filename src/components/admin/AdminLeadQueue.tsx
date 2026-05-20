import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/EmptyState";
import { StageBadge, StatusBadge } from "@/components/dashboard/StageBadge";
import { ArrowDown, ArrowUp, ArrowUpDown, Inbox, AlertCircle, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { AdminLeadRow, LeadQueueFilters, PipelineStage } from "@/hooks/useAdminDashboard";

interface Props {
  data: AdminLeadRow[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  filters: LeadQueueFilters;
  onFiltersChange: (f: LeadQueueFilters) => void;
  pipelineStages: PipelineStage[];
}

function sourceLabel(row: AdminLeadRow): string {
  if (row.source_type === "student_direct") return "Student Portal";
  return row.partner_display_name ? `Partner: ${row.partner_display_name}` : "Partner Lead";
}

export function AdminLeadQueue({ data, loading, error, onRetry, filters, onFiltersChange, pipelineStages }: Props) {
  const navigate = useNavigate();

  const toggleSort = (col: "updated_at" | "created_at") => {
    if (filters.sortBy === col) {
      onFiltersChange({ ...filters, sortDir: filters.sortDir === "asc" ? "desc" : "asc" });
    } else {
      onFiltersChange({ ...filters, sortBy: col, sortDir: "desc" });
    }
  };

  const sortIcon = (col: "updated_at" | "created_at") => {
    if (filters.sortBy !== col) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return filters.sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  // Quick chips: navigate to /admin/leads with appropriate URL filters pre-applied.
  const chips = metrics
    ? [
        {
          label: "Pending review",
          count: metrics.requestsPendingApproval,
          to: "/admin/leads?status=awaiting_verification",
          tone: "amber",
        },
        {
          label: "High Priority Leads",
          count: metrics.pendingAdminActions,
          to: "/admin/leads?status=awaiting_verification",
          tone: "amber",
        },
        {
          label: "Sent to Lender",
          count: metrics.sentToLender,
          to: "/admin/leads?stage=sent_to_lender",
          tone: "primary",
        },
      ]
    : [];

  const chipToneClass = (tone: string) =>
    tone === "amber"
      ? "border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900"
      : "border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary";

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 pt-5 pb-4 border-b border-border/60">
        <div>
          <h3 className="text-base font-semibold tracking-tight">Lead Queue</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Latest 10 leads across all sources</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filters.source} onValueChange={(v) => onFiltersChange({ ...filters, source: v as any })}>
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="partner">Partner</SelectItem>
              <SelectItem value="student_direct">Student Portal</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.stage} onValueChange={(v) => onFiltersChange({ ...filters, stage: v as any })}>
            <SelectTrigger className="w-[170px] h-8 text-xs">
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="all">All Stages</SelectItem>
              {pipelineStages.map((s) => (
                <SelectItem key={s.stage_key} value={s.stage_key}>{s.stage_label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Quick chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2 px-6 pt-4">
          {chips.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => navigate(c.to)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${chipToneClass(c.tone)}`}
            >
              <span>{c.label}</span>
              <span className="rounded-full bg-background/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                {c.count.toLocaleString("en-IN")}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="px-6 py-4">
        {loading && (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <div>
                <p className="font-medium text-sm">Lead queue failed to load</p>
                <p className="text-xs text-muted-foreground">{error}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
            </Button>
          </div>
        )}

        {!loading && !error && data.length === 0 && (
          <EmptyState icon={Inbox} title="No leads match" description="Adjust filters to see leads here." />
        )}

        {!loading && !error && data.length > 0 && (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground bg-muted/40">
                  <th className="py-2 pr-4 pl-1 font-medium">Lead ID</th>
                  <th className="py-2 pr-4 font-medium">Student</th>
                  <th className="py-2 pr-4 font-medium">Source</th>
                  <th className="py-2 pr-4 font-medium">Stage</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">
                    <button
                      type="button"
                      onClick={() => toggleSort("updated_at")}
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors uppercase tracking-wide"
                    >
                      Updated {sortIcon("updated_at")}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => navigate(`/admin/leads/${row.id}`)}
                    className="border-b border-border/50 last:border-b-0 hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 pr-4 pl-1 font-mono text-xs text-foreground/80">{row.lead_id ?? "—"}</td>
                    <td className="py-3 pr-4 font-medium text-foreground">
                      {row.student_full_name ?? `${row.student_first_name}${row.student_last_name ? " " + row.student_last_name : ""}`}
                    </td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground">{sourceLabel(row)}</td>
                    <td className="py-3 pr-4"><StageBadge stage={row.current_stage} /></td>
                    <td className="py-3 pr-4"><StatusBadge status={row.current_status} /></td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(row.updated_at), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="px-6 py-3 border-t border-border/60 bg-muted/20 flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/leads")} className="text-xs h-7">
          View all leads →
        </Button>
      </div>
    </Card>
  );
}
