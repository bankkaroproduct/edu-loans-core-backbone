import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatStageLabel } from "@/components/dashboard/StageBadge";
import {
  ArrowDown, ArrowUp, ArrowUpDown, Inbox, AlertCircle, RefreshCw,
  ExternalLink, MoreHorizontal, ArrowRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { initials, avatarColor, partnerColor } from "@/components/admin/dashboard/visualHelpers";
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

function sourceLabel(row: AdminLeadRow): { kind: "partner" | "student"; name: string } {
  if (row.source_type === "student_direct") return { kind: "student", name: "Student Portal" };
  return { kind: "partner", name: row.partner_display_name ?? "Partner Lead" };
}

/* ============================================================
 * LOCAL pills — intentionally NOT exported.
 * Future code must not import these as if they were shared badges.
 * Colors map by raw snake_case enum key. Unknown → neutral slate.
 * Display text comes from formatStageLabel (pure casing formatter).
 * ============================================================ */

type PillTone = { bg: string; fg: string; dot: string };

const NEUTRAL: PillTone = { bg: "#F1F3F6", fg: "#45505C", dot: "#9AA3AE" };

const STAGE_TONE: Record<string, PillTone> = {
  submitted:              { bg: "#FFF8E6", fg: "#8C6D00", dot: "#E5A800" },
  documents_pending:      { bg: "#FFF0E6", fg: "#B5470F", dot: "#FF6D1D" },
  documents_under_review: { bg: "#FFF8E6", fg: "#8C6D00", dot: "#E5A800" },
  sanctioned:             { bg: "#ECFBF3", fg: "#167C3D", dot: "#26A651" },
  sanction_received:      { bg: "#ECFBF3", fg: "#167C3D", dot: "#26A651" },
};

const STATUS_TONE: Record<string, PillTone> = {
  awaiting_verification: { bg: "#FFF0E6", fg: "#B5470F", dot: "#FF6D1D" },
  in_progress:           { bg: "#EEF2FF", fg: "#0036DA", dot: "#0036DA" },
  verified:              { bg: "#ECFBF3", fg: "#167C3D", dot: "#26A651" },
};

function Pill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-[5px] rounded-full px-[9px] py-[3px] text-[11.5px] font-semibold"
      style={{ backgroundColor: tone.bg, color: tone.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tone.dot }} />
      {children}
    </span>
  );
}

function StagePill({ stage }: { stage: string }) {
  const tone = STAGE_TONE[stage] ?? NEUTRAL;
  return <Pill tone={tone}>{formatStageLabel(stage)}</Pill>;
}

function StatusPill({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? NEUTRAL;
  return <Pill tone={tone}>{formatStageLabel(status)}</Pill>;
}

/* ---------- Student cell ---------- */

function StudentCell({ row }: { row: AdminLeadRow }) {
  const name =
    row.student_full_name ??
    `${row.student_first_name}${row.student_last_name ? " " + row.student_last_name : ""}`.trim();
  const safeName = name || "—";
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white text-[10.5px] font-bold"
        style={{ backgroundColor: avatarColor(safeName) }}
        aria-hidden
      >
        {initials(safeName) || "—"}
      </span>
      <div className="min-w-0">
        <p className="text-[13.5px] font-semibold text-[#1C1B1F] truncate">{safeName}</p>
      </div>
    </div>
  );
}

/* ---------- Source chip ---------- */

function SourceCell({ row }: { row: AdminLeadRow }) {
  const src = sourceLabel(row);
  if (src.kind === "student") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F5F7FA] px-2 py-1 text-xs font-medium text-[#45505C]">
        {src.name}
      </span>
    );
  }
  const letter = (src.name[0] ?? "?").toUpperCase();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F5F7FA] py-[3px] pl-1 pr-2 text-xs font-medium text-[#45505C]">
      <span
        className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-white text-[9px] font-bold"
        style={{ backgroundColor: partnerColor(src.name) }}
        aria-hidden
      >
        {letter}
      </span>
      <span className="truncate max-w-[160px]">{src.name}</span>
    </span>
  );
}

/* ---------- Component ---------- */

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
    if (filters.sortBy !== col) return <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />;
    return filters.sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />;
  };

  return (
    <div className="overflow-hidden rounded-[12px] border border-[#ECEEF1] bg-white">
      {/* Panel header */}
      <div className="flex flex-col gap-3 border-b border-[#F1F3F6] px-[18px] py-[14px] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-[17px] font-extrabold tracking-[-0.015em] text-[#1C1B1F]">Lead Queue</h3>
          <p className="mt-0.5 text-[12px] font-medium text-[#6B7684]">Latest 10 leads across all sources</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filters.source} onValueChange={(v) => onFiltersChange({ ...filters, source: v as LeadQueueFilters["source"] })}>
            <SelectTrigger className="h-8 min-w-[130px] rounded-[7px] border-[#E5E7EB] px-3 text-[12.5px] font-semibold text-[#1C1B1F]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="partner">Partner</SelectItem>
              <SelectItem value="student_direct">Student Portal</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.stage} onValueChange={(v) => onFiltersChange({ ...filters, stage: v as LeadQueueFilters["stage"] })}>
            <SelectTrigger className="h-8 min-w-[150px] rounded-[7px] border-[#E5E7EB] px-3 text-[12.5px] font-semibold text-[#1C1B1F]">
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

      {/* Body */}
      <div>
        {loading && (
          <div className="space-y-2 p-4">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center justify-between gap-4 p-4">
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
          <div className="p-6">
            <EmptyState icon={Inbox} title="No leads match" description="Adjust filters to see leads here." />
          </div>
        )}

        {!loading && !error && data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#FAFBFC] text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#6B7684]">
                  <th className="border-b border-[#ECEEF1] px-4 py-3">Lead ID</th>
                  <th className="border-b border-[#ECEEF1] px-4 py-3">Student</th>
                  <th className="border-b border-[#ECEEF1] px-4 py-3">Source</th>
                  <th className="border-b border-[#ECEEF1] px-4 py-3">Stage</th>
                  <th className="border-b border-[#ECEEF1] px-4 py-3">Status</th>
                  <th className="border-b border-[#ECEEF1] px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleSort("updated_at")}
                      className="inline-flex items-center gap-1 uppercase tracking-[0.08em] hover:text-[#1C1B1F] transition-colors"
                    >
                      Updated {sortIcon("updated_at")}
                    </button>
                  </th>
                  <th className="border-b border-[#ECEEF1] px-2 py-3 w-[64px]" aria-label="Row actions" />
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => (
                  <tr
                    key={row.id}
                    onClick={() => navigate(`/admin/leads/${row.id}`)}
                    className={cn(
                      "group cursor-pointer transition-colors hover:bg-[#FAFBFC]",
                      idx !== data.length - 1 && "border-b border-[#F1F3F6]",
                    )}
                  >
                    <td className="px-4 py-[13px] font-mono text-[12px] font-medium text-[#45505C]" style={{ fontFamily: "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace" }}>
                      {row.lead_id ?? "—"}
                    </td>
                    <td className="px-4 py-[13px]"><StudentCell row={row} /></td>
                    <td className="px-4 py-[13px]"><SourceCell row={row} /></td>
                    <td className="px-4 py-[13px]"><StagePill stage={row.current_stage} /></td>
                    <td className="px-4 py-[13px]"><StatusPill status={row.current_status} /></td>
                    <td className="px-4 py-[13px] text-[12.5px] text-[#45505C] whitespace-nowrap tabular-nums">
                      {formatDistanceToNow(new Date(row.updated_at), { addSuffix: true })}
                    </td>
                    <td className="px-2 py-[13px] w-[64px]">
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          aria-label="Open lead"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/leads/${row.id}`);
                          }}
                          className="flex h-[26px] w-[26px] items-center justify-center rounded-md hover:bg-[#F1F3F6]"
                        >
                          <ExternalLink className="h-4 w-4 text-[#45505C]" />
                        </button>
                        <button
                          type="button"
                          aria-label="More actions"
                          // TODO: wire row-level overflow menu if/when product defines it
                          onClick={(e) => e.stopPropagation()}
                          className="flex h-[26px] w-[26px] items-center justify-center rounded-md hover:bg-[#F1F3F6]"
                        >
                          <MoreHorizontal className="h-4 w-4 text-[#45505C]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-[#F1F3F6] bg-[#FAFBFC] px-5 py-3">
        <span className="text-[12px] text-[#6B7684]">
          Showing <b className="font-semibold text-[#1C1B1F]">{data.length}</b> of{" "}
          <b className="font-semibold text-[#1C1B1F]">{data.length}</b> leads
        </span>
        <button
          type="button"
          onClick={() => navigate("/admin/leads")}
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#0036DA] hover:underline"
        >
          View all leads <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
