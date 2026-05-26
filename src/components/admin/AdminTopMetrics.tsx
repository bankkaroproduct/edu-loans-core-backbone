import { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Inbox, TrendingUp, BadgeCheck, Network,
  AlertCircle, RefreshCw, Minus, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminMetrics } from "@/hooks/useAdminDashboard";
import { Sparkline } from "@/components/admin/dashboard/Sparkline";

export type AdminMetricKey = "action" | "pipeline" | "closed" | "partners";

interface Props {
  data: AdminMetrics | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  activeLendersCount?: number;
  onCardClick?: (key: AdminMetricKey) => void;
}

/* ---------- Tone tokens (scoped — admin dashboard only) ---------- */

type Tone = "action" | "pipeline" | "closed" | "partners";

const TONE: Record<Tone, { iconBg: string; iconFg: string; spark: string }> = {
  action:   { iconBg: "bg-[#FFF5ED]", iconFg: "text-[#FF6D1D]", spark: "#FF6D1D" },
  pipeline: { iconBg: "bg-[#EEF2FF]", iconFg: "text-[#0036DA]", spark: "#0036DA" },
  closed:   { iconBg: "bg-[#ECFBF3]", iconFg: "text-[#26A651]", spark: "#26A651" },
  partners: { iconBg: "bg-[#F3EEFF]", iconFg: "text-[#9747FF]", spark: "#9747FF" },
};

const fmt = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : v.toLocaleString("en-IN");

// TODO: wire trend data — placeholder produces a flat sparkline.
const PLACEHOLDER_TREND = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

/* ---------- Delta chip (placeholder — no w-o-w source today) ---------- */

function DeltaChip() {
  // TODO: wire trend data — render flat chip until week-over-week delta exists.
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-[#F1F3F6] px-[7px] py-0.5 text-[11.5px] font-bold text-[#4F5965]">
      <Minus className="h-3 w-3" strokeWidth={3} />
      —
    </span>
  );
}

/* ---------- KPI tile ---------- */

interface TileProps {
  label: string;
  value: number | null | undefined;
  sub: ReactNode;
  icon: LucideIcon;
  tone: Tone;
  loading?: boolean;
}

function KpiTile({ label, value, sub, icon: Icon, tone, loading }: TileProps) {
  const t = TONE[tone];
  const showSkeleton = loading || value === null || value === undefined;

  return (
    <div className="h-full rounded-[12px] border border-[#ECEEF1] bg-white px-[18px] pt-[18px] pb-[14px] transition-shadow group-hover:shadow-[0_4px_14px_rgba(16,24,40,0.06)]">
      {/* Row 1: label + tinted icon square */}
      <div className="flex items-start justify-between">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.10em] text-[#6B7684] leading-tight">
          {label}
        </p>
        <div className={cn("flex h-[30px] w-[30px] items-center justify-center rounded-[8px]", t.iconBg)}>
          <Icon className={cn("h-4 w-4", t.iconFg)} strokeWidth={2.2} />
        </div>
      </div>

      {/* Value */}
      <div className="mt-3">
        {showSkeleton ? (
          <Skeleton className="h-[36px] w-24" />
        ) : (
          <p className="text-[36px] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-[#1C1B1F]">
            {fmt(value)}
          </p>
        )}
      </div>

      {/* Delta + vs last week + sparkline */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <DeltaChip />
          <span className="text-[11px] font-medium text-[#9AA3AE] truncate">vs last week</span>
        </div>
        <Sparkline data={PLACEHOLDER_TREND} color={t.spark} />
      </div>

      {/* Dashed hairline + sub line */}
      <div className="mt-[10px] border-t border-dashed border-[#ECEEF1] pt-[10px]">
        <p
          className="text-[11.5px] font-medium text-[#45505C] leading-snug line-clamp-2"
          title={typeof sub === "string" ? sub : undefined}
        >
          {sub}
        </p>
      </div>
    </div>
  );
}

/* ---------- Component ---------- */

export function AdminTopMetrics({ data, loading, error, onRetry, activeLendersCount, onCardClick }: Props) {
  if (error) {
    return (
      <div className="rounded-[12px] border border-destructive/30 bg-destructive/5 p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <div>
              <p className="font-semibold">Failed to load top metrics</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  const wrap = (key: AdminMetricKey, ariaLabel: string, node: ReactNode) => (
    <button
      type="button"
      aria-label={`${ariaLabel} — open details`}
      onClick={() => onCardClick?.(key)}
      className="group text-left rounded-[12px] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-transform hover:-translate-y-0.5 cursor-pointer"
    >
      {node}
    </button>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {wrap("action", "Action needed today",
        <KpiTile
          label="Action Needed Today"
          value={data?.pendingAdminActions}
          sub={data ? `Review Due: ${fmt(data.reviewDue)} · Follow-up: ${fmt(data.followUpRequired)}` : ""}
          icon={Inbox}
          tone="action"
          loading={loading}
        />
      )}
      {wrap("pipeline", "Active pipeline",
        <KpiTile
          label="Active Pipeline"
          value={data?.totalLeads}
          sub={data ? `Sent to lender: ${fmt(data.sentToLender)} · Sanctioned: ${fmt(data.sanctionReceived)}` : ""}
          icon={TrendingUp}
          tone="pipeline"
          loading={loading}
        />
      )}
      {wrap("closed", "Closed disbursed leads",
        <KpiTile
          label="Closed"
          value={data?.disbursed}
          sub="Disbursed (lifetime)"
          icon={BadgeCheck}
          tone="closed"
          loading={loading}
        />
      )}
      {wrap("partners", "Active partners",
        <KpiTile
          label="Partners"
          value={data?.activePartners}
          sub={
            activeLendersCount !== undefined
              ? `Active partners · ${fmt(activeLendersCount)} lenders configured`
              : "Active partners on platform"
          }
          icon={Network}
          tone="partners"
          loading={loading}
        />
      )}
    </div>
  );
}
