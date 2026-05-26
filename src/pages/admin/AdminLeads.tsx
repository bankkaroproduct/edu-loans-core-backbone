import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatStageLabel } from "@/components/dashboard/StageBadge";
import { formatINRCompact } from "@/lib/formatCurrency";
import { Sparkline } from "@/components/admin/dashboard/Sparkline";
import { initials as initialsOf, avatarColor, partnerColor } from "@/components/admin/dashboard/visualHelpers";
import { cn } from "@/lib/utils";

import { AdminLeadFilters, defaultAdminLeadFilters, type AdminLeadFilterState } from "@/components/admin/AdminLeadFilters";
import { applyBusinessFilters as applySharedBusinessFilters } from "@/lib/leadBusinessFilters";
import { useAdminLeadScope } from "@/hooks/useAdminLeadScope";

import {
  ACTION_NEEDED_EXCLUDED_STAGES,
  REVIEW_DUE_SELECT_COLUMNS,
  isReviewDue,
} from "@/lib/adminActionNeeded";
import {
  AlertCircle, AlertTriangle, ArrowDown, ArrowRight, ArrowUp, ArrowUpDown, BadgeCheck,
  ChevronLeft, ChevronRight, Clock, ExternalLink, Hourglass, Inbox, Layers,
  MoreHorizontal, RefreshCw, Send, SlidersHorizontal, X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type CardFilterKey = "none" | "high_priority" | "sent_to_lender" | "sanction_received";
const HIGH_PRIORITY_EMPTY_SENTINEL = "00000000-0000-0000-0000-000000000000";

type StageEnum = Database["public"]["Enums"]["lead_stage_enum"];
type StatusEnum = Database["public"]["Enums"]["lead_status_enum"];

interface AdminLeadRow {
  id: string;
  lead_id: string | null;
  student_full_name: string | null;
  student_first_name: string;
  student_last_name: string | null;
  student_phone: string;
  source_type: string;
  partner_id: string | null;
  intended_study_country: string;
  course_name: string;
  loan_amount_required: number | null;
  current_stage: StageEnum;
  current_status: StatusEnum;
  updated_at: string;
  created_at: string;
  partner_display_name: string | null;
}

const PAGE_SIZE = 25;
type SortKey = "updated_at" | "created_at" | "loan_amount_required";
type SortDir = "asc" | "desc";

const STALE_TERMINAL_STAGES: StageEnum[] = ["disbursed", "rejected", "dropped", "on_hold"];
const STALE_BLOCKED_STATUSES: StatusEnum[] = ["pending_info", "query_raised", "reupload_needed"];
const STALE_HOURS = 48;

function sanitizeSearch(s: string): string {
  return s.trim().replace(/[(),"]/g, "").slice(0, 100);
}

function studentName(r: AdminLeadRow): string {
  return r.student_full_name?.trim() ||
    `${r.student_first_name}${r.student_last_name ? " " + r.student_last_name : ""}`.trim() ||
    "—";
}

/* ============================================================
 * LOCAL presentational pills — intentionally NOT exported.
 * Colors map by raw snake_case enum key. Unknown → neutral slate.
 * Display text comes from formatStageLabel (pure casing formatter).
 * ============================================================ */

type PillTone = { bg: string; fg: string; dot: string };
const NEUTRAL: PillTone = { bg: "#F1F3F6", fg: "#45505C", dot: "#9AA3AE" };

const STAGE_TONE: Record<string, PillTone> = {
  submitted:              { bg: "#FFF8E6", fg: "#8C6D00", dot: "#E5A800" },
  documents_pending:      { bg: "#FFF0E6", fg: "#B5470F", dot: "#FF6D1D" },
  documents_under_review: { bg: "#FFF8E6", fg: "#8C6D00", dot: "#E5A800" },
  sent_to_lender:         { bg: "#F3EEFF", fg: "#6B2BD9", dot: "#9747FF" },
  sanctioned:             { bg: "#ECFBF3", fg: "#167C3D", dot: "#26A651" },
  sanction_received:      { bg: "#ECFBF3", fg: "#167C3D", dot: "#26A651" },
};

const STATUS_TONE: Record<string, PillTone> = {
  awaiting_verification: { bg: "#FFF0E6", fg: "#B5470F", dot: "#FF6D1D" },
  in_progress:           { bg: "#EEF2FF", fg: "#0036DA", dot: "#0036DA" },
  verified:              { bg: "#ECFBF3", fg: "#167C3D", dot: "#26A651" },
  under_review:          { bg: "#FFF8E6", fg: "#8C6D00", dot: "#E5A800" },
};

function Pill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full px-2 py-[3px] text-[11px] font-semibold"
      style={{ backgroundColor: tone.bg, color: tone.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tone.dot }} />
      {children}
    </span>
  );
}
function StagePill({ stage }: { stage: string }) {
  return <Pill tone={STAGE_TONE[stage] ?? NEUTRAL}>{formatStageLabel(stage)}</Pill>;
}
function StatusPill({ status }: { status: string }) {
  return <Pill tone={STATUS_TONE[status] ?? NEUTRAL}>{formatStageLabel(status)}</Pill>;
}

/* ---------- Cells ---------- */

function StudentCell({ row }: { row: AdminLeadRow }) {
  const name = studentName(row);
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white text-[10.5px] font-bold"
        style={{ backgroundColor: avatarColor(name) }}
        aria-hidden
      >
        {initialsOf(name) || "—"}
      </span>
      <span className="text-[13.5px] font-semibold text-[#1C1B1F] truncate">{name}</span>
    </div>
  );
}

function SourceCell({ row }: { row: AdminLeadRow }) {
  if (row.source_type === "student_direct") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F5F7FA] px-2 py-1 text-[11.5px] font-medium text-[#45505C]">
        Student Portal
      </span>
    );
  }
  const name = row.partner_display_name ?? "Partner Lead";
  const letter = (name[0] ?? "?").toUpperCase();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F5F7FA] py-[3px] pl-1 pr-2 text-[11.5px] font-medium text-[#45505C]">
      <span
        className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-white text-[9px] font-bold"
        style={{ backgroundColor: partnerColor(name) }}
        aria-hidden
      >
        {letter}
      </span>
      <span className="truncate max-w-[160px]" title={name}>{name}</span>
    </span>
  );
}

function CountryCell({ country }: { country: string }) {
  if (!country) return <span className="text-[#9AA3AE]">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] text-[#1C1B1F]">
      <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: partnerColor(country) }} aria-hidden />
      {country}
    </span>
  );
}

/* ---------- KPI tile ---------- */

interface KpiTileProps {
  label: string;
  value: number;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "info" | "warn" | "purple" | "ok";
  active: boolean;
  disabled?: boolean;
  loading: boolean;
  onClick: () => void;
}
const TONE_STYLE: Record<KpiTileProps["tone"], { bg: string; fg: string }> = {
  info:   { bg: "#EEF2FF", fg: "#0036DA" },
  warn:   { bg: "#FFF5ED", fg: "#FF6D1D" },
  purple: { bg: "#F3EEFF", fg: "#9747FF" },
  ok:     { bg: "#ECFBF3", fg: "#26A651" },
};
function KpiTile({ label, value, sub, icon: Icon, tone, active, disabled, loading, onClick }: KpiTileProps) {
  const t = TONE_STYLE[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        "group relative text-left rounded-[12px] border bg-white p-[18px] transition-all",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        active ? "border-[#0036DA] ring-2 ring-[#0036DA]/15" : "border-[#ECEEF1] hover:border-[#D4DAE3] hover:shadow-[0_4px_14px_-8px_rgba(15,23,42,0.18)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B7684]">{label}</p>
        <span
          className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px]"
          style={{ backgroundColor: t.bg, color: t.fg }}
          aria-hidden
        >
          <Icon className="h-[16px] w-[16px]" />
        </span>
      </div>
      <div className="mt-[10px]">
        {loading ? (
          <Skeleton className="h-9 w-24" />
        ) : (
          <p
            className="text-[36px] font-extrabold leading-none tabular-nums text-[#1C1B1F]"
            style={{ letterSpacing: "-0.03em" }}
          >
            {value.toLocaleString("en-IN")}
          </p>
        )}
      </div>
      <div className="mt-[10px] flex items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-[#F1F3F6] px-2 py-[2px] text-[10.5px] font-bold text-[#45505C]">
          —
        </span>
        {/* TODO: wire trend data */}
        <Sparkline data={[0, 0, 0, 0, 0, 0, 0]} color={t.fg} width={92} height={24} />
      </div>
      <div className="mt-[12px] border-t border-dashed border-[#ECEEF1] pt-[10px]">
        <p className="text-[11.5px] text-[#6B7684] leading-snug">{sub}</p>
      </div>
    </button>
  );
}

/* =================== Component =================== */

export default function AdminLeads() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { ready: scopeReady, isSuperAdmin, scopedPartnerIds, hasNoScope, applyPartnerScope } = useAdminLeadScope();

  // Master data
  const [stages, setStages] = useState<{ stage_key: StageEnum; stage_label: string }[]>([]);
  const [statuses, setStatuses] = useState<{ stage_key: StageEnum; status_key: StatusEnum; status_label: string }[]>([]);
  const [countries, setCountries] = useState<{ country_name: string }[]>([]);
  const [partners, setPartners] = useState<{ id: string; display_name: string }[]>([]);
  const [mastersLoaded, setMastersLoaded] = useState(false);

  // Hydrate filters from URL once
  const initialFilters: AdminLeadFilterState = useMemo(() => ({
    search: searchParams.get("q") ?? "",
    source: (searchParams.get("source") as any) ?? "all",
    stage: (searchParams.get("stage") as any) ?? "all",
    status: (searchParams.get("status") as any) ?? "all",
    country: searchParams.get("country") ?? "all",
    partnerId: searchParams.get("partner") ?? "all",
    dateFrom: searchParams.get("from") ? new Date(searchParams.get("from")!) : undefined,
    dateTo: searchParams.get("to") ? new Date(searchParams.get("to")!) : undefined,
    type: (searchParams.get("type") as any) ?? "all",
    entryMode: (searchParams.get("entry") as any) ?? "all",
    region: (searchParams.get("region") as any) ?? "all",
    loanRange: (searchParams.get("loan") as any) ?? "all",
    intake: (searchParams.get("intake") as any) ?? "all",
    loanType: (searchParams.get("loantype") as any) ?? "all",
    staleOnly: searchParams.get("stale") === "1",
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [filters, setFilters] = useState<AdminLeadFilterState>(initialFilters);
  const [searchInput, setSearchInput] = useState(initialFilters.search);
  const [sortKey, setSortKey] = useState<SortKey>((searchParams.get("sort") as SortKey) ?? "created_at");
  const [sortDir, setSortDir] = useState<SortDir>((searchParams.get("dir") as SortDir) ?? "desc");
  const [page, setPage] = useState(parseInt(searchParams.get("page") ?? "1", 10) || 1);

  // Data state
  const [rows, setRows] = useState<AdminLeadRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(() => new Date());

  // Health strip counts
  const [healthCounts, setHealthCounts] = useState<{
    total: number; pendingReview: number; withLender: number; sanction: number; highPriority: number;
  }>({ total: 0, pendingReview: 0, withLender: 0, sanction: 0, highPriority: 0 });

  const [cardFilter, setCardFilter] = useState<CardFilterKey>("none");
  const [highPriorityIds, setHighPriorityIds] = useState<string[] | null>(null);

  // Debounce search
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      setFilters((f) => ({ ...f, search: searchInput }));
      setPage(1);
    }, 300);
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [searchInput]);

  // Master data
  useEffect(() => {
    if (!scopeReady) return;
    (async () => {
      let partnerQ: any = supabase.from("partner_organizations").select("id, display_name").eq("is_archived", false).order("display_name");
      if (!isSuperAdmin) {
        const ids = scopedPartnerIds.length ? scopedPartnerIds : ["00000000-0000-0000-0000-000000000000"];
        partnerQ = partnerQ.in("id", ids);
      }
      const [sRes, stRes, cRes, pRes] = await Promise.all([
        supabase.from("lifecycle_stage_master").select("stage_key, stage_label, sort_order").eq("active_flag", true).order("sort_order"),
        supabase.from("lifecycle_status_master").select("stage_key, status_key, status_label, sort_order").eq("active_flag", true).order("sort_order"),
        supabase.from("countries_master").select("country_name").eq("active_flag", true).order("country_name"),
        partnerQ,
      ]);
      setStages(sRes.data ?? []);
      setStatuses((stRes.data ?? []).map((r) => ({ stage_key: r.stage_key, status_key: r.status_key, status_label: r.status_label })));
      setCountries(cRes.data ?? []);
      setPartners((pRes.data ?? []).filter((p: any) => !!p.display_name?.trim()));
      setMastersLoaded(true);
    })();
  }, [scopeReady, isSuperAdmin, scopedPartnerIds]);

  // Sync filters → URL
  useEffect(() => {
    const p = new URLSearchParams();
    if (filters.search) p.set("q", filters.search);
    if (filters.source !== "all") p.set("source", filters.source);
    if (filters.stage !== "all") p.set("stage", filters.stage);
    if (filters.status !== "all") p.set("status", filters.status);
    if (filters.country !== "all") p.set("country", filters.country);
    if (filters.partnerId !== "all") p.set("partner", filters.partnerId);
    if (filters.dateFrom) p.set("from", filters.dateFrom.toISOString().slice(0, 10));
    if (filters.dateTo) p.set("to", filters.dateTo.toISOString().slice(0, 10));
    if (filters.type !== "all") p.set("type", filters.type);
    if (filters.entryMode !== "all") p.set("entry", filters.entryMode);
    if (filters.region !== "all") p.set("region", filters.region);
    if (filters.loanRange !== "all") p.set("loan", filters.loanRange);
    if (filters.intake !== "all") p.set("intake", filters.intake);
    if (filters.loanType !== "all") p.set("loantype", filters.loanType);
    if (filters.staleOnly) p.set("stale", "1");
    if (sortKey !== "created_at") p.set("sort", sortKey);
    if (sortDir !== "desc") p.set("dir", sortDir);
    if (page > 1) p.set("page", String(page));
    setSearchParams(p, { replace: true });
  }, [filters, sortKey, sortDir, page, setSearchParams]);

  const applyBusinessFilters = useCallback((q: any) => {
    return applySharedBusinessFilters(q, {
      source: filters.source,
      type: filters.type,
      entryMode: filters.entryMode,
      region: filters.region,
      loanRange: filters.loanRange,
      intake: filters.intake,
      loanType: filters.loanType,
    });
  }, [filters]);

  const fetchPage = useCallback(async () => {
    if (!scopeReady) return;
    if (hasNoScope) {
      setRows([]);
      setTotalCount(0);
      setLoading(false);
      setError(null);
      setLastRefreshedAt(new Date());
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const buildBase = () => {
        let q: any = supabase.from("student_leads")
          .select(
            "id, lead_id, student_full_name, student_first_name, student_last_name, student_phone, source_type, partner_id, intended_study_country, course_name, loan_amount_required, current_stage, current_status, updated_at, created_at",
            { count: "exact" }
          )
          .eq("is_archived", false);
        q = applyPartnerScope(q);

        if (filters.stage !== "all") q = q.eq("current_stage", filters.stage);
        if (filters.status !== "all") q = q.eq("current_status", filters.status);
        if (filters.country !== "all") q = q.eq("intended_study_country", filters.country);
        if (filters.partnerId !== "all") q = q.eq("partner_id", filters.partnerId);
        if (filters.dateFrom) q = q.gte("created_at", filters.dateFrom.toISOString());
        if (filters.dateTo) {
          const end = new Date(filters.dateTo);
          end.setHours(23, 59, 59, 999);
          q = q.lte("created_at", end.toISOString());
        }
        if (filters.staleOnly) {
          const cutoff = new Date(Date.now() - STALE_HOURS * 3600 * 1000).toISOString();
          q = q
            .lt("updated_at", cutoff)
            .not("current_stage", "in", `(${STALE_TERMINAL_STAGES.join(",")})`)
            .not("current_status", "in", `(${STALE_BLOCKED_STATUSES.join(",")})`);
        }
        q = applyBusinessFilters(q);

        const t = sanitizeSearch(filters.search);
        if (t) {
          q = q.or(
            `student_full_name.ilike.%${t}%,student_first_name.ilike.%${t}%,student_last_name.ilike.%${t}%,student_phone.ilike.%${t}%,lead_id.ilike.%${t}%`
          );
        }
        if (cardFilter === "high_priority") {
          const ids = (highPriorityIds && highPriorityIds.length > 0) ? highPriorityIds : [HIGH_PRIORITY_EMPTY_SENTINEL];
          q = q.in("id", ids);
        } else if (cardFilter === "sent_to_lender") {
          q = q.eq("current_stage", "sent_to_lender");
        } else if (cardFilter === "sanction_received") {
          q = q.eq("current_stage", "sanction_received");
        }
        return q;
      };

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const q = buildBase()
        .order(sortKey, { ascending: sortDir === "asc", nullsFirst: false })
        .range(from, to);

      const { data, count, error: qErr } = await q;
      if (qErr) throw qErr;

      const baseRows = (data ?? []) as Omit<AdminLeadRow, "partner_display_name">[];

      const partnerIds = Array.from(new Set(baseRows.map((r) => r.partner_id).filter((x): x is string => !!x)));
      const partnerMap = new Map<string, string>();
      if (partnerIds.length) {
        const { data: pData } = await supabase
          .from("partner_organizations")
          .select("id, display_name")
          .in("id", partnerIds);
        (pData ?? []).forEach((p) => {
          if (p.display_name?.trim()) partnerMap.set(p.id, p.display_name.trim());
        });
      }

      const enriched: AdminLeadRow[] = baseRows.map((r) => ({
        ...r,
        partner_display_name: r.partner_id ? (partnerMap.get(r.partner_id) ?? null) : null,
      }));

      setRows(enriched);
      setTotalCount(count ?? 0);
      setLastRefreshedAt(new Date());
    } catch (e: any) {
      setError(e?.message ?? "Failed to load leads");
      setRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [filters, sortKey, sortDir, page, applyBusinessFilters, cardFilter, highPriorityIds, scopeReady, hasNoScope, applyPartnerScope]);

  useEffect(() => { fetchPage(); }, [fetchPage]);

  const fetchHealthCounts = useCallback(async () => {
    if (!scopeReady) return;
    if (hasNoScope) {
      setHealthCounts({ total: 0, pendingReview: 0, withLender: 0, sanction: 0, highPriority: 0 });
      return;
    }
    const buildCount = (overrideStage?: StageEnum, overrideStatuses?: StatusEnum[], restrictIds?: string[]) => {
      let q: any = supabase.from("student_leads")
        .select("*", { count: "exact", head: true })
        .eq("is_archived", false);
      q = applyPartnerScope(q);
      if (overrideStage) q = q.eq("current_stage", overrideStage);
      else if (filters.stage !== "all") q = q.eq("current_stage", filters.stage);
      if (overrideStatuses) q = q.in("current_status", overrideStatuses);
      else if (filters.status !== "all") q = q.eq("current_status", filters.status);
      if (filters.country !== "all") q = q.eq("intended_study_country", filters.country);
      if (filters.partnerId !== "all") q = q.eq("partner_id", filters.partnerId);
      if (filters.dateFrom) q = q.gte("created_at", filters.dateFrom.toISOString());
      if (filters.dateTo) {
        const end = new Date(filters.dateTo);
        end.setHours(23, 59, 59, 999);
        q = q.lte("created_at", end.toISOString());
      }
      if (filters.staleOnly && !overrideStage && !overrideStatuses) {
        const cutoff = new Date(Date.now() - STALE_HOURS * 3600 * 1000).toISOString();
        q = q
          .lt("updated_at", cutoff)
          .not("current_stage", "in", `(${STALE_TERMINAL_STAGES.join(",")})`)
          .not("current_status", "in", `(${STALE_BLOCKED_STATUSES.join(",")})`);
      }
      q = applyBusinessFilters(q);
      const t = sanitizeSearch(filters.search);
      if (t) {
        q = q.or(`student_full_name.ilike.%${t}%,student_first_name.ilike.%${t}%,student_last_name.ilike.%${t}%,student_phone.ilike.%${t}%,lead_id.ilike.%${t}%`);
      }
      if (restrictIds) {
        q = q.in("id", restrictIds.length > 0 ? restrictIds : [HIGH_PRIORITY_EMPTY_SENTINEL]);
      }
      return q;
    };
    const hpPromise = highPriorityIds === null
      ? Promise.resolve({ count: 0 } as any)
      : buildCount(undefined, undefined, highPriorityIds);
    const [tot, pend, lender, sanc, hp] = await Promise.all([
      buildCount(),
      buildCount(undefined, ["new", "awaiting_verification", "pending_info"] as StatusEnum[]),
      buildCount("sent_to_lender" as StageEnum),
      buildCount("sanction_received" as StageEnum),
      hpPromise,
    ]);
    setHealthCounts({
      total: tot.count ?? 0,
      pendingReview: pend.count ?? 0,
      withLender: lender.count ?? 0,
      sanction: sanc.count ?? 0,
      highPriority: hp.count ?? 0,
    });
  }, [filters, applyBusinessFilters, highPriorityIds, scopeReady, hasNoScope, applyPartnerScope]);

  useEffect(() => { fetchHealthCounts(); }, [fetchHealthCounts]);

  const fetchHighPriorityIds = useCallback(async () => {
    if (!scopeReady) return;
    if (hasNoScope) { setHighPriorityIds([]); return; }
    try {
      const excl = `(${ACTION_NEEDED_EXCLUDED_STAGES.join(",")})`;
      const [followUp, reviewRows] = await Promise.all([
        applyPartnerScope(supabase.from("student_leads").select("id").eq("is_archived", false).not("current_stage", "in", excl)),
        applyPartnerScope(supabase.from("student_leads").select(REVIEW_DUE_SELECT_COLUMNS).eq("is_archived", false).not("current_stage", "in", excl)),
      ]);
      const ids = new Set<string>();
      (followUp.data ?? []).forEach((r: any) => { if (r?.id) ids.add(r.id); });
      (reviewRows.data ?? []).filter((l: any) => isReviewDue(l)).forEach((l: any) => { if (l?.id) ids.add(l.id); });
      setHighPriorityIds(Array.from(ids));
    } catch {
      setHighPriorityIds([]);
    }
  }, [scopeReady, hasNoScope, applyPartnerScope]);

  useEffect(() => { fetchHighPriorityIds(); }, [fetchHighPriorityIds]);

  // Realtime
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel("admin-leads-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "student_leads" }, () => {
        if (t) clearTimeout(t);
        t = setTimeout(() => { fetchPage(); fetchHighPriorityIds(); }, 600);
      })
      .subscribe();
    return () => { if (t) clearTimeout(t); supabase.removeChannel(channel); };
  }, [fetchPage, fetchHighPriorityIds]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
    setPage(1);
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  // Quick-filter chips
  const quickChips = [
    {
      key: "pending",
      label: "Pending review",
      icon: Clock,
      count: healthCounts.pendingReview,
      active: filters.status !== "all" && ["new", "awaiting_verification", "pending_info"].includes(filters.status),
      apply: () => { setFilters({ ...filters, status: "awaiting_verification" as StatusEnum, stage: "all" }); setPage(1); },
    },
    {
      key: "sent",
      label: "Sent to Lender",
      icon: Send,
      count: healthCounts.withLender,
      active: filters.stage === "sent_to_lender",
      apply: () => { setFilters({ ...filters, stage: "sent_to_lender" as StageEnum, status: "all" }); setPage(1); },
    },
    {
      key: "sanction",
      label: "Sanction Received",
      icon: BadgeCheck,
      count: healthCounts.sanction,
      active: filters.stage === "sanction_received",
      apply: () => { setFilters({ ...filters, stage: "sanction_received" as StageEnum, status: "all" }); setPage(1); },
    },
    {
      key: "stale",
      label: "Stale > 48h",
      icon: Hourglass,
      count: null as number | null,
      active: filters.staleOnly,
      apply: () => {
        setFilters({
          ...filters,
          staleOnly: !filters.staleOnly,
          dateTo: filters.staleOnly ? filters.dateTo : undefined,
          stage: "all",
          status: "all",
        });
        setPage(1);
      },
    },
  ];

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.search) n++;
    if (filters.source !== "all") n++;
    if (filters.stage !== "all") n++;
    if (filters.status !== "all") n++;
    if (filters.country !== "all") n++;
    if (filters.partnerId !== "all") n++;
    if (filters.dateFrom) n++;
    if (filters.dateTo) n++;
    if (filters.type !== "all") n++;
    if (filters.entryMode !== "all") n++;
    if (filters.region !== "all") n++;
    if (filters.loanRange !== "all") n++;
    if (filters.intake !== "all") n++;
    if (filters.loanType !== "all") n++;
    if (filters.staleOnly) n++;
    return n;
  }, [filters]);

  const clearAllFilters = () => {
    setSearchInput("");
    setFilters(defaultAdminLeadFilters);
    setPage(1);
  };

  const highPrioritySet = useMemo(
    () => new Set(highPriorityIds ?? []),
    [highPriorityIds],
  );

  const sortLabel = (() => {
    const k = sortKey === "created_at" ? "Created" : sortKey === "updated_at" ? "Updated" : "Loan";
    return `Sorted by ${k} · ${sortDir === "desc" ? "descending" : "ascending"}`;
  })();

  if (scopeReady && hasNoScope) {
    return (
      <div className="w-full">
        <h1 className="text-[26px] font-extrabold tracking-[-0.025em] text-[#1C1B1F]">Lead Queue</h1>
        <p className="mt-1 text-[13.5px] font-medium text-[#6B7684]">
          Review, prioritize, assign, and manage education-loan leads across all sources.
        </p>
        <div className="mt-6 rounded-[12px] border border-[#ECEEF1] bg-white p-10">
          <EmptyState
            icon={Inbox}
            title="No partners assigned to your account"
            description="Contact a super admin to get partners assigned."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Topbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[26px] font-extrabold tracking-[-0.025em] text-[#1C1B1F] leading-none">
              Lead Queue
            </h1>
            <span
              className="inline-flex items-center rounded-full bg-[#EEF2FF] px-[11px] py-1 text-[13px] font-bold tabular-nums text-[#0036DA]"
            >
              {healthCounts.total.toLocaleString("en-IN")}
            </span>
          </div>
          <p className="mt-1.5 text-[13.5px] font-medium text-[#6B7684]">
            Review, prioritize, assign, and manage education-loan leads across all sources.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#6B7684]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#26A651] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#26A651]" />
            </span>
            Live
          </span>
          <span className="text-[12px] text-[#6B7684] tabular-nums">
            Updated {formatDistanceToNow(lastRefreshedAt, { addSuffix: true })}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchPage()}
            disabled={loading}
            className="h-8 rounded-[7px] border-[#E5E7EB] px-3 text-[12.5px] font-semibold text-[#1C1B1F]"
          >
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Total in Queue"
          value={healthCounts.total}
          sub="Matching current filters"
          icon={Layers}
          tone="info"
          active={false}
          loading={loading}
          onClick={() => { setCardFilter("none"); setPage(1); }}
        />
        <KpiTile
          label="High Priority Leads"
          value={healthCounts.highPriority}
          sub="Stale follow-ups · critical-stage pending actions"
          icon={AlertTriangle}
          tone="warn"
          active={cardFilter === "high_priority"}
          disabled={highPriorityIds === null}
          loading={loading}
          onClick={() => { setCardFilter((c) => c === "high_priority" ? "none" : "high_priority"); setPage(1); }}
        />
        <KpiTile
          label="Sent to Lender"
          value={healthCounts.withLender}
          sub="Awaiting lender decision"
          icon={Send}
          tone="purple"
          active={cardFilter === "sent_to_lender"}
          loading={loading}
          onClick={() => { setCardFilter((c) => c === "sent_to_lender" ? "none" : "sent_to_lender"); setPage(1); }}
        />
        <KpiTile
          label="Sanction Received"
          value={healthCounts.sanction}
          sub="Sanction in hand"
          icon={BadgeCheck}
          tone="ok"
          active={cardFilter === "sanction_received"}
          loading={loading}
          onClick={() => { setCardFilter((c) => c === "sanction_received" ? "none" : "sanction_received"); setPage(1); }}
        />
      </div>

      {/* Filters panel */}
      <div className="mt-5 overflow-hidden rounded-[12px] border border-[#ECEEF1] bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-[#F1F3F6] bg-[#FAFBFC] px-[18px] py-[14px]">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-[18px] w-[18px] text-[#0036DA]" />
            <h3 className="text-[15px] font-extrabold tracking-[-0.015em] text-[#1C1B1F]">
              Filters &amp; Search
            </h3>
          </div>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold text-[#6B7684] transition-colors hover:bg-[#F1F3F6] hover:text-[#1C1B1F]"
            >
              <X className="h-3.5 w-3.5" />
              Clear filters
            </button>
          )}
        </div>

        <div className="px-[18px] py-4 space-y-4">
          {!mastersLoaded ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
            <AdminLeadFilters
              filters={filters}
              onChange={(next) => { setFilters(next); setPage(1); }}
              searchInput={searchInput}
              onSearchInputChange={setSearchInput}
              stages={stages}
              statuses={statuses}
              countries={countries}
              partners={partners}
            />
          )}

          {/* Quick views */}
          <div className="border-t border-dashed border-[#ECEEF1] pt-4">
            <p className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.10em] text-[#6B7684]">
              Quick views
            </p>
            <div className="flex flex-wrap gap-2">
              {quickChips.map((c) => {
                const Icon = c.icon;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={c.apply}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-[7px] text-[12.5px] font-semibold transition-colors",
                      c.active
                        ? "border-[#C7D3FF] bg-[#EEF2FF] text-[#0036DA]"
                        : "border-[#E5E7EB] bg-white text-[#1C1B1F] hover:bg-[#FAFBFC]",
                    )}
                  >
                    <Icon className={cn("h-[15px] w-[15px]", c.active ? "text-[#0036DA]" : "text-[#6B7684]")} />
                    <span>{c.label}</span>
                    {c.count !== null && (
                      <span
                        className={cn(
                          "ml-0.5 inline-flex items-center rounded-full px-[7px] py-[1px] text-[11px] font-bold tabular-nums",
                          c.active ? "bg-[#0036DA] text-white" : "bg-[#F1F3F6] text-[#45505C]",
                        )}
                      >
                        {c.count.toLocaleString("en-IN")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Table panel */}
      <div className="mt-5 overflow-hidden rounded-[12px] border border-[#ECEEF1] bg-white">
        {/* Header strip */}
        <div className="flex flex-col gap-2 border-b border-[#F1F3F6] bg-[#FAFBFC] px-[18px] py-[14px] sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-[17px] font-extrabold tracking-[-0.015em] text-[#1C1B1F]">Leads</h3>
              <span className="inline-flex items-center rounded-full bg-[#EEF2FF] px-2.5 py-[2px] text-[12px] font-bold tabular-nums text-[#0036DA]">
                {loading ? "—" : totalCount.toLocaleString("en-IN")}
              </span>
            </div>
            <p className="mt-0.5 text-[12px] font-medium text-[#6B7684]">{sortLabel}</p>
          </div>
          <span className="text-[12px] font-medium text-[#6B7684] tabular-nums">
            {loading ? "Loading…" : error ? "—" : `Page ${page} of ${totalPages}`}
          </span>
        </div>

        {/* Body */}
        {loading && (
          <div className="space-y-2 p-4">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center justify-between gap-4 border-l-4 border-l-destructive bg-destructive/5 p-5">
            <div className="flex items-start gap-3 text-destructive">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">Failed to load lead queue</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{error}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchPage()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="p-6">
            <EmptyState
              icon={Inbox}
              title="No leads match your filters"
              description="Try adjusting filters or search terms above to see leads."
            />
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#FAFBFC] text-left text-[10px] font-bold uppercase tracking-[0.08em] text-[#6B7684]">
                  <th className="border-b border-[#ECEEF1] px-3 py-2.5">Lead ID</th>
                  <th className="border-b border-[#ECEEF1] px-3 py-2.5">Student</th>
                  <th className="border-b border-[#ECEEF1] px-3 py-2.5">Source</th>
                  <th className="border-b border-[#ECEEF1] px-3 py-2.5">Phone</th>
                  <th className="border-b border-[#ECEEF1] px-3 py-2.5">Country</th>
                  <th className="border-b border-[#ECEEF1] px-3 py-2.5">Course</th>
                  <th className="border-b border-[#ECEEF1] px-3 py-2.5 text-right">
                    <button type="button" onClick={() => toggleSort("loan_amount_required")} className="inline-flex items-center gap-1 uppercase tracking-[0.08em] hover:text-[#1C1B1F]">
                      Loan {sortIcon("loan_amount_required")}
                    </button>
                  </th>
                  <th className="border-b border-[#ECEEF1] px-3 py-2.5">Stage</th>
                  <th className="border-b border-[#ECEEF1] px-3 py-2.5">Status</th>
                  <th className="border-b border-[#ECEEF1] px-3 py-2.5">
                    <button type="button" onClick={() => toggleSort("created_at")} className="inline-flex items-center gap-1 uppercase tracking-[0.08em] hover:text-[#1C1B1F]">
                      Created {sortIcon("created_at")}
                    </button>
                  </th>
                  <th className="border-b border-[#ECEEF1] px-3 py-2.5">
                    <button type="button" onClick={() => toggleSort("updated_at")} className="inline-flex items-center gap-1 uppercase tracking-[0.08em] hover:text-[#1C1B1F]">
                      Updated {sortIcon("updated_at")}
                    </button>
                  </th>
                  <th className="border-b border-[#ECEEF1] px-2 py-2.5 w-[80px] text-right uppercase tracking-[0.08em]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const isHigh = highPrioritySet.has(r.id);
                  return (
                    <tr
                      key={r.id}
                      onClick={() => navigate(`/admin/leads/${r.id}`)}
                      style={isHigh ? { boxShadow: "inset 3px 0 0 #FF6D1D" } : undefined}
                      className={cn(
                        "group cursor-pointer transition-colors hover:bg-[#FAFBFC]",
                        idx !== rows.length - 1 && "border-b border-[#F1F3F6]",
                      )}
                    >
                      <td className="px-3 py-[11px]">
                        <div className="flex items-center gap-2">
                          {isHigh && (
                            <span
                              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                              style={{ backgroundColor: "#FFF0E6", color: "#FF6D1D" }}
                              aria-label="High priority"
                              title="High priority"
                            >
                              <AlertTriangle className="h-3 w-3" />
                            </span>
                          )}
                          <span
                            className="truncate whitespace-nowrap text-[12px] font-medium text-[#45505C]"
                            style={{ fontFamily: "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace" }}
                            title={r.lead_id ?? undefined}
                          >
                            {r.lead_id ?? "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-[11px]"><StudentCell row={r} /></td>
                      <td className="px-3 py-[11px]"><SourceCell row={r} /></td>
                      <td
                        className="px-3 py-[11px] whitespace-nowrap text-[12px] font-medium text-[#45505C] tabular-nums"
                        style={{ fontFamily: "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace" }}
                      >
                        {r.student_phone}
                      </td>
                      <td className="px-3 py-[11px]"><CountryCell country={r.intended_study_country} /></td>
                      <td
                        className="px-3 py-[11px] max-w-[180px] truncate text-[12.5px] text-[#1C1B1F]"
                        title={r.course_name}
                      >
                        {r.course_name || "—"}
                      </td>
                      <td className="px-3 py-[11px] text-right tabular-nums text-[13px] font-bold text-[#1C1B1F]">
                        {r.loan_amount_required === null || r.loan_amount_required === undefined ? (
                          <span className="font-normal text-[#9AA3AE]">—</span>
                        ) : (
                          formatINRCompact(r.loan_amount_required)
                        )}
                      </td>
                      <td className="px-3 py-[11px]"><StagePill stage={r.current_stage} /></td>
                      <td className="px-3 py-[11px]"><StatusPill status={r.current_status} /></td>
                      <td className="px-3 py-[11px] whitespace-nowrap text-[12.5px] text-[#45505C] tabular-nums">
                        {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </td>
                      <td className="px-3 py-[11px] whitespace-nowrap text-[12.5px] text-[#45505C] tabular-nums">
                        {formatDistanceToNow(new Date(r.updated_at), { addSuffix: true })}
                      </td>
                      <td className="px-2 py-[11px] text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            aria-label="Open lead"
                            title="Open lead"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/leads/${r.id}`);
                            }}
                            className="flex h-[26px] w-[26px] items-center justify-center rounded-md text-[#45505C] hover:bg-[#F1F3F6] hover:text-[#1C1B1F]"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label="More actions"
                            title="More actions"
                            onClick={(e) => e.stopPropagation()}
                            className="flex h-[26px] w-[26px] items-center justify-center rounded-md text-[#45505C] hover:bg-[#F1F3F6] hover:text-[#1C1B1F]"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && totalCount > 0 && (
          <div className="flex flex-col gap-3 border-t border-[#F1F3F6] bg-[#FAFBFC] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[12px] text-[#6B7684] tabular-nums">
              Showing{" "}
              <b className="font-semibold text-[#1C1B1F]">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)}
              </b>{" "}
              of <b className="font-semibold text-[#1C1B1F]">{totalCount.toLocaleString("en-IN")}</b> leads
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className={cn(
                  "inline-flex h-[30px] min-w-[30px] items-center justify-center gap-1 rounded-md border border-[#E5E7EB] bg-white px-2.5 text-[12.5px] font-semibold text-[#1C1B1F] tabular-nums transition-colors hover:bg-[#FAFBFC]",
                  page <= 1 && "opacity-45 cursor-not-allowed hover:bg-white",
                )}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Previous
              </button>
              <span className="px-2 text-[12px] text-[#6B7684] tabular-nums">
                Page <span className="font-semibold text-[#1C1B1F]">{page}</span> of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className={cn(
                  "inline-flex h-[30px] min-w-[30px] items-center justify-center gap-1 rounded-md border border-[#E5E7EB] bg-white px-2.5 text-[12.5px] font-semibold text-[#1C1B1F] tabular-nums transition-colors hover:bg-[#FAFBFC]",
                  page >= totalPages && "opacity-45 cursor-not-allowed hover:bg-white",
                )}
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
