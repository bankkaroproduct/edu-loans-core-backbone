import type { Tables } from "@/integrations/supabase/types";
import { formatINR as fmtINR } from "@/lib/formatCurrency";

export type CardKey =
  | "total_earned"
  | "pending_payout_amount"
  | "needs_attention"
  | "active"
  | "sanctioned"
  | "disbursed"
  | "rejected"
  | "payout_released"
  | "payout_pending";

type Lead = Tables<"student_leads">;
type Payout = Tables<"partner_payout_records">;
type DocReq = Tables<"lead_document_requirements">;
type LenderMatch = Tables<"lead_lender_matches">;
type PayoutRule = Tables<"partner_payout_rules">;

export interface Segment {
  key: string;
  label: string;
  count: number;
  amount: number;
  percent: number;
  filterFn: (recordId: string) => boolean;
}

export interface RecordRow {
  id: string;
  leadId?: string; // EL-PL-xxxxxx human id
  leadDbId?: string; // uuid for navigation
  primary: string; // student name or payout title
  secondary: string; // lender / stage / etc
  meta: string; // amount / date
  navTo: string;
}

export interface DrilldownView {
  title: string;
  subtitle: string;
  segments: Segment[] | null;
  records: RecordRow[];
  emptyMessage?: string;
}

export interface DrilldownData {
  leads: Lead[];
  payoutRecords: Payout[];
  docReqs: DocReq[];
  sanctionedEverIds: Set<string>;
  lenderNameById: Map<string, string>;
  /** payout_rule_id -> lender_id */
  ruleLenderById: Map<string, string | null>;
  /** lead_id -> chosen lender_id (from lock_status=true match) */
  lockedLenderByLeadId: Map<string, string>;
  stageLabelByKey: Map<string, string>;
}


const fullName = (l: Lead) =>
  [l.student_first_name, l.student_last_name].filter(Boolean).join(" ") || l.student_full_name || "—";

const ageDays = (iso: string | null | undefined) => {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
};

const ageBucket = (days: number) => {
  if (days <= 7) return { key: "0_7", label: "0–7 days" };
  if (days <= 30) return { key: "8_30", label: "8–30 days" };
  return { key: "30p", label: "30+ days" };
};

function buildSegments<T>(
  rows: T[],
  groupKey: (r: T) => { key: string; label: string },
  amountFn: (r: T) => number,
  idFn: (r: T) => string,
): Segment[] {
  const groups = new Map<string, { label: string; count: number; amount: number; ids: Set<string> }>();
  for (const r of rows) {
    const { key, label } = groupKey(r);
    const g = groups.get(key) ?? { label, count: 0, amount: 0, ids: new Set<string>() };
    g.count += 1;
    g.amount += amountFn(r);
    g.ids.add(idFn(r));
    groups.set(key, g);
  }
  const total = rows.length || 1;
  return Array.from(groups.entries())
    .map(([key, g]) => ({
      key,
      label: g.label,
      count: g.count,
      amount: g.amount,
      percent: Math.round((g.count / total) * 100),
      filterFn: (id: string) => g.ids.has(id),
    }))
    .sort((a, b) => b.count - a.count);
}

const ATTENTION_STAGES = new Set(["on_hold", "documents_pending", "credit_query"]);
const ATTENTION_STATUSES = new Set(["pending_info", "reupload_needed", "query_raised"]);

function attentionBucket(l: Lead): { key: string; label: string } {
  if (l.current_status === "reupload_needed") return { key: "reupload", label: "Document reupload required" };
  if (l.current_status === "query_raised" || l.current_stage === "credit_query")
    return { key: "lender_query", label: "Lender query awaiting response" };
  if (l.current_status === "pending_info") return { key: "coapp", label: "Co-applicant action required" };
  return { key: "other", label: "Other (on hold / documents pending / duplicate)" };
}

export function buildDrilldown(card: CardKey, d: DrilldownData): DrilldownView {
  const lenderForLead = (leadId: string): { id: string | null; name: string } => {
    const lid = d.lockedLenderByLeadId.get(leadId);
    if (!lid) return { id: null, name: "Lender unassigned" };
    return { id: lid, name: d.lenderNameById.get(lid) ?? "Unknown lender" };
  };
  const lenderForPayout = (p: Payout): { id: string | null; name: string } => {
    const lid = p.payout_rule_id ? d.ruleLenderById.get(p.payout_rule_id) ?? null : null;
    if (!lid) return { id: null, name: "Lender unassigned" };
    return { id: lid, name: d.lenderNameById.get(lid) ?? "Unknown lender" };
  };
  const leadById = new Map(d.leads.map((l) => [l.id, l] as const));
  const stageLabel = (k: string) => d.stageLabelByKey.get(k) ?? k.replace(/_/g, " ");

  const leadRow = (l: Lead, secondary: string, meta: string): RecordRow => ({
    id: l.id,
    leadId: l.lead_id ?? undefined,
    leadDbId: l.id,
    primary: fullName(l),
    secondary,
    meta,
    navTo: `/leads/${l.id}`,
  });
  const payoutRow = (p: Payout, secondary: string, meta: string): RecordRow => {
    const lead = leadById.get(p.lead_id);
    return {
      id: p.id,
      leadId: lead?.lead_id ?? undefined,
      leadDbId: lead?.id,
      primary: lead ? fullName(lead) : "—",
      secondary,
      meta,
      navTo: lead ? `/leads/${lead.id}` : `/payouts`,
    };
  };

  switch (card) {
    case "total_earned": {
      const earned = d.payoutRecords.filter((p) =>
        ["pending", "triggered", "approved", "paid"].includes(p.payout_status),
      );
      const total = earned.reduce((s, p) => s + (p.payout_amount ?? 0), 0);
      const labels: Record<string, string> = {
        paid: "Paid",
        approved: "Approved (not yet paid)",
        triggered: "Triggered (awaiting approval)",
        pending: "Pending (calculation pending)",
      };
      const segments = buildSegments(
        earned,
        (p) => ({ key: p.payout_status, label: labels[p.payout_status] ?? p.payout_status }),
        (p) => p.payout_amount ?? 0,
        (p) => p.id,
      );
      return {
        title: "Total Accrued Payout",
        subtitle: `${fmtINR(total)} across ${earned.length} payout record${earned.length === 1 ? "" : "s"}`,
        segments: segments.length ? segments : null,
        records: earned
          .sort((a, b) => (b.updated_at > a.updated_at ? 1 : -1))
          .map((p) => payoutRow(p, lenderForPayout(p).name, `${fmtINR(p.payout_amount ?? 0)} • ${labels[p.payout_status] ?? p.payout_status}`)),
        emptyMessage: "No commission earned yet. Disbursals will appear here once recorded.",
      };
    }
    case "pending_payout_amount":
    case "payout_pending": {
      const pending = d.payoutRecords.filter((p) =>
        ["pending", "triggered", "approved"].includes(p.payout_status),
      );
      const total = pending.reduce((s, p) => s + (p.payout_amount ?? 0), 0);
      const segments = buildSegments(
        pending,
        (p) => ageBucket(ageDays(p.payout_triggered_at ?? p.created_at)),
        (p) => p.payout_amount ?? 0,
        (p) => p.id,
      );
      return {
        title: card === "payout_pending" ? "Pending Payout Records" : "Pending Payout Amount",
        subtitle: `${fmtINR(total)} across ${pending.length} record${pending.length === 1 ? "" : "s"}`,
        segments: segments.length ? segments : null,
        records: pending.map((p) => {
          const days = ageDays(p.payout_triggered_at ?? p.created_at);
          return payoutRow(p, lenderForPayout(p).name, `${fmtINR(p.payout_amount ?? 0)} • ${days}d pending`);
        }),
        emptyMessage: "No pending payouts right now.",
      };
    }
    case "needs_attention": {
      const rows = d.leads.filter(
        (l) =>
          ATTENTION_STAGES.has(l.current_stage) ||
          ATTENTION_STATUSES.has(l.current_status) ||
          l.duplicate_flag === true,
      );
      const segments = buildSegments(rows, attentionBucket, () => 0, (l) => l.id);
      return {
        title: "Needs Attention",
        subtitle: `${rows.length} lead${rows.length === 1 ? "" : "s"} need action`,
        segments: segments.length ? segments : null,
        records: rows.map((l) =>
          leadRow(l, attentionBucket(l).label, `${ageDays(l.updated_at)}d since update`),
        ),
        emptyMessage: "Nothing needs your attention right now.",
      };
    }
    case "active": {
      const excluded = new Set(["draft", "disbursed", "rejected", "dropped", "sanction_received"]);
      const rows = d.leads.filter((l) => !excluded.has(l.current_stage));
      const segments = buildSegments(
        rows,
        (l) => ({ key: l.current_stage, label: stageLabel(l.current_stage) }),
        (l) => l.loan_amount_required ?? 0,
        (l) => l.id,
      );
      return {
        title: "Total Loan Active",
        subtitle: `${rows.length} lead${rows.length === 1 ? "" : "s"} • ${fmtINR(rows.reduce((s, l) => s + (l.loan_amount_required ?? 0), 0))}`,
        segments: segments.length ? segments : null,
        records: rows.map((l) =>
          leadRow(l, stageLabel(l.current_stage), fmtINR(l.loan_amount_required ?? 0)),
        ),
        emptyMessage: "No active leads in the pipeline.",
      };
    }
    case "sanctioned": {
      const rows = d.leads.filter(
        (l) => l.current_stage === "sanction_received" || d.sanctionedEverIds.has(l.id),
      );
      const segments = buildSegments(
        rows,
        (l) => {
          const lender = lenderForLead(l.id);
          return { key: lender.id ?? "unassigned", label: lender.name };
        },
        (l) => l.loan_amount_required ?? 0,
        (l) => l.id,
      );
      return {
        title: "Total Loan Sanctioned",
        subtitle: `${rows.length} lead${rows.length === 1 ? "" : "s"} • ${fmtINR(rows.reduce((s, l) => s + (l.loan_amount_required ?? 0), 0))}`,
        segments: segments.length ? segments : null,
        records: rows.map((l) =>
          leadRow(l, lenderForLead(l.id).name, `${fmtINR(l.loan_amount_required ?? 0)} • ${stageLabel(l.current_stage)}`),
        ),
        emptyMessage: "No sanctioned leads yet.",
      };
    }
    case "disbursed": {
      const rows = d.leads.filter((l) => l.current_stage === "disbursed");
      // commission per lead
      const commByLead = new Map<string, number>();
      for (const p of d.payoutRecords) {
        if (["paid", "approved", "triggered", "pending"].includes(p.payout_status)) {
          commByLead.set(p.lead_id, (commByLead.get(p.lead_id) ?? 0) + (p.payout_amount ?? 0));
        }
      }
      const segments = buildSegments(
        rows,
        (l) => {
          const lender = lenderForLead(l.id);
          return { key: lender.id ?? "unassigned", label: lender.name };
        },
        (l) => l.loan_amount_required ?? 0,
        (l) => l.id,
      );
      return {
        title: "Total Disbursed",
        subtitle: `${rows.length} lead${rows.length === 1 ? "" : "s"} • ${fmtINR(rows.reduce((s, l) => s + (l.loan_amount_required ?? 0), 0))}`,
        segments: segments.length ? segments : null,
        records: rows.map((l) =>
          leadRow(
            l,
            lenderForLead(l.id).name,
            `${fmtINR(l.loan_amount_required ?? 0)} • commission ${fmtINR(commByLead.get(l.id) ?? 0)}`,
          ),
        ),
        emptyMessage: "No disbursed leads yet.",
      };
    }
    case "rejected": {
      const rows = d.leads.filter((l) => ["rejected", "dropped"].includes(l.current_stage));
      // No rejection_reason_category in schema — fall back to status_reason text grouping ONLY if present.
      const reasoned = rows.filter((l) => (l.status_reason ?? "").trim().length > 0);
      const segments =
        reasoned.length > 0
          ? buildSegments(
              reasoned,
              (l) => {
                const r = (l.status_reason ?? "Other").slice(0, 40);
                return { key: r.toLowerCase(), label: r };
              },
              () => 0,
              (l) => l.id,
            )
          : null;
      return {
        title: "Total Loan Rejected",
        subtitle: `${rows.length} lead${rows.length === 1 ? "" : "s"} • ${fmtINR(rows.reduce((s, l) => s + (l.loan_amount_required ?? 0), 0))}`,
        segments,
        records: rows.map((l) =>
          leadRow(l, l.status_reason ?? "No reason recorded", `${fmtINR(l.loan_amount_required ?? 0)} • ${stageLabel(l.current_stage)}`),
        ),
        emptyMessage: "No rejected leads — every active application is either in progress or has been approved.",
      };
    }
    case "payout_released": {
      const rows = d.payoutRecords.filter((p) => p.payout_status === "paid");
      const total = rows.reduce((s, p) => s + (p.payout_amount ?? 0), 0);
      const segments = buildSegments(
        rows,
        (p) => {
          const date = p.payout_paid_at ?? p.updated_at;
          const dt = new Date(date);
          const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
          const label = dt.toLocaleString("en-IN", { month: "short", year: "numeric" });
          return { key, label };
        },
        (p) => p.payout_amount ?? 0,
        (p) => p.id,
      );
      return {
        title: "Total Payout Released",
        subtitle: `${fmtINR(total)} across ${rows.length} payout${rows.length === 1 ? "" : "s"}`,
        segments: segments.length ? segments : null,
        records: rows.map((p) =>
          payoutRow(
            p,
            lenderForPayout(p).name,
            `${fmtINR(p.payout_amount ?? 0)} • paid ${p.payout_paid_at ? new Date(p.payout_paid_at).toLocaleDateString("en-IN") : "—"}`,
          ),
        ),
        emptyMessage: "No payouts have been released yet. Disbursals will appear here once payout cycles run.",
      };
    }
  }
}
