/**
 * Admin Reports — data fetchers + CSV/XLSX download helpers.
 * All fetchers return { rows, count, capped } where `capped=true` means the
 * row count exceeded REPORT_ROW_CAP and the export must be blocked.
 */
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import {
  applyBusinessFilters,
  deriveEntryModeLabel,
  deriveLoanTypeLabel,
  deriveRegionLabel,
  deriveSourceLabel,
  deriveTypeLabel,
  type BusinessFilterState,
  type StageEnum,
} from "./leadBusinessFilters";

export const REPORT_ROW_CAP = 5000;
export const REPORT_CAP_MESSAGE =
  "Too many rows. Please narrow your filters before exporting.";

export interface ReportFilterState extends BusinessFilterState {
  dateFrom?: Date;
  dateTo?: Date;
  partnerId: "all" | string;
  stage?: "all" | StageEnum;
  status?: "all" | string;
  country?: "all" | string;
  /** For Edit Requests report only */
  editRequestStatus?: "all" | "pending" | "applied" | "rejected" | "cancelled";
  /** For Stage Movement report only */
  newStage?: "all" | StageEnum;
}

export const defaultReportFilters: ReportFilterState = {
  source: "all",
  type: "all",
  entryMode: "all",
  region: "all",
  loanRange: "all",
  intake: "all",
  loanType: "all",
  dateFrom: undefined,
  dateTo: undefined,
  partnerId: "all",
  stage: "all",
  status: "all",
  country: "all",
  editRequestStatus: "all",
  newStage: "all",
};

export interface ReportResult<T> {
  rows: T[];
  count: number;
  capped: boolean;
  error?: string;
}

/* -------------------------------------------------------------- */
/*                          Helpers                                */
/* -------------------------------------------------------------- */

function applyDateRange(q: any, f: ReportFilterState, col = "created_at") {
  if (f.dateFrom) q = q.gte(col, f.dateFrom.toISOString());
  if (f.dateTo) {
    const end = new Date(f.dateTo);
    end.setHours(23, 59, 59, 999);
    q = q.lte(col, end.toISOString());
  }
  return q;
}

function fmtAmount(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  return Number(n).toString();
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "";
  try {
    return new Date(d).toISOString().slice(0, 19).replace("T", " ");
  } catch {
    return d;
  }
}

function studentName(r: { student_full_name?: string | null; student_first_name?: string; student_last_name?: string | null }): string {
  return (
    r.student_full_name?.trim() ||
    `${r.student_first_name ?? ""}${r.student_last_name ? " " + r.student_last_name : ""}`.trim() ||
    ""
  );
}

/* -------------------------------------------------------------- */
/*                       Count-only helpers                        */
/* -------------------------------------------------------------- */

/** Count for the Leads Report — applies all business + standard filters. */
export async function countLeadsReport(f: ReportFilterState): Promise<number> {
  let q: any = supabase
    .from("student_leads")
    .select("id", { count: "exact", head: true })
    .eq("is_archived", false);
  if (f.stage && f.stage !== "all") q = q.eq("current_stage", f.stage);
  if (f.status && f.status !== "all") q = q.eq("current_status", f.status);
  if (f.country && f.country !== "all") q = q.eq("intended_study_country", f.country);
  if (f.partnerId !== "all") q = q.eq("partner_id", f.partnerId);
  q = applyDateRange(q, f);
  q = applyBusinessFilters(q, f);
  const { count } = await q;
  return count ?? 0;
}

export async function countStageMovement(f: ReportFilterState): Promise<number> {
  let q: any = supabase
    .from("lead_stage_history")
    .select("id", { count: "exact", head: true });
  q = applyDateRange(q, f, "created_at");
  if (f.newStage && f.newStage !== "all") q = q.eq("new_stage", f.newStage);
  // Partner filter requires join — inline via lead_id IN subquery
  if (f.partnerId !== "all") {
    const { data: leadIds } = await supabase
      .from("student_leads")
      .select("id")
      .eq("partner_id", f.partnerId)
      .eq("is_archived", false)
      .limit(REPORT_ROW_CAP);
    q = q.in("lead_id", ((leadIds ?? []) as Array<{id: string}>).map((l) => l.id));
  }
  const { count } = await q;
  return count ?? 0;
}

export async function countDocumentsPending(f: ReportFilterState): Promise<number> {
  let q: any = supabase
    .from("lead_documents")
    .select("id", { count: "exact", head: true })
    .eq("is_latest", true)
    .in("verification_status", ["uploaded", "reupload_needed"]);
  q = applyDateRange(q, f, "uploaded_at");
  if (f.partnerId !== "all") {
    const { data: leadIds } = await supabase
      .from("student_leads")
      .select("id")
      .eq("partner_id", f.partnerId)
      .eq("is_archived", false)
      .limit(REPORT_ROW_CAP);
    q = q.in("lead_id", ((leadIds ?? []) as Array<{id: string}>).map((l) => l.id));
  }
  const { count } = await q;
  return count ?? 0;
}

export async function countEditRequests(f: ReportFilterState): Promise<number> {
  let q: any = supabase
    .from("lead_edit_requests")
    .select("id", { count: "exact", head: true });
  q = applyDateRange(q, f, "created_at");
  if (f.editRequestStatus && f.editRequestStatus !== "all") q = q.eq("status", f.editRequestStatus);
  if (f.partnerId !== "all") q = q.eq("partner_id", f.partnerId);
  const { count } = await q;
  return count ?? 0;
}

export async function countPartnerPerformance(): Promise<number> {
  // One row per non-archived non-system real partner.
  const { count } = await supabase
    .from("partner_organizations")
    .select("id", { count: "exact", head: true })
    .eq("is_archived", false)
    .neq("partner_code", "PTR-DIRECT");
  return count ?? 0;
}

/* -------------------------------------------------------------- */
/*                      Full data fetchers                         */
/* -------------------------------------------------------------- */

export async function fetchLeadsReport(f: ReportFilterState): Promise<ReportResult<any>> {
  const total = await countLeadsReport(f);
  if (total > REPORT_ROW_CAP) return { rows: [], count: total, capped: true };

  let q: any = supabase
    .from("student_leads")
    .select(
      "id, lead_id, created_at, partner_id, source_type, source_sub_type, " +
        "student_full_name, student_first_name, student_last_name, student_phone, student_email, " +
        "current_stage, current_status, intended_study_country, course_name, university_name_raw, " +
        "intake_term, intake_year, loan_amount_required, collateral_available"
    )
    .eq("is_archived", false);
  if (f.stage && f.stage !== "all") q = q.eq("current_stage", f.stage);
  if (f.status && f.status !== "all") q = q.eq("current_status", f.status);
  if (f.country && f.country !== "all") q = q.eq("intended_study_country", f.country);
  if (f.partnerId !== "all") q = q.eq("partner_id", f.partnerId);
  q = applyDateRange(q, f);
  q = applyBusinessFilters(q, f);
  q = q.order("created_at", { ascending: false }).limit(REPORT_ROW_CAP);

  const { data, error } = await q;
  if (error) return { rows: [], count: 0, capped: false, error: error.message };

  // Partner enrichment
  const partnerIds = Array.from(new Set((data ?? []).map((r: any) => r.partner_id).filter(Boolean)));
  const partnerMap = new Map<string, string>();
  if (partnerIds.length) {
    const { data: pData } = await supabase
      .from("partner_organizations")
      .select("id, display_name, partner_code")
      .in("id", partnerIds);
    (pData ?? []).forEach((p) => partnerMap.set(p.id, p.display_name ?? p.partner_code));
  }

  const rows = (data ?? []).map((r: any) => ({
    "Lead ID": r.lead_id ?? r.id.slice(0, 8),
    "Created At": fmtDate(r.created_at),
    Partner: partnerMap.get(r.partner_id) ?? "",
    Source: deriveSourceLabel(r.source_type, r.source_sub_type),
    "Entry Mode": deriveEntryModeLabel(r.source_type, r.source_sub_type),
    Type: deriveTypeLabel(r.source_sub_type),
    "Student Name": studentName(r),
    Phone: r.student_phone ?? "",
    Email: r.student_email ?? "",
    Stage: r.current_stage,
    Status: r.current_status,
    Country: r.intended_study_country ?? "",
    Course: r.course_name ?? "",
    University: r.university_name_raw ?? "",
    "Intake Term": r.intake_term ?? "",
    "Intake Year": r.intake_year ?? "",
    "Loan Amount": fmtAmount(r.loan_amount_required),
    "Loan Type": deriveLoanTypeLabel(r.collateral_available),
    Region: deriveRegionLabel(r.intended_study_country),
  }));
  return { rows, count: rows.length, capped: false };
}

export async function fetchStageMovementReport(f: ReportFilterState): Promise<ReportResult<any>> {
  const total = await countStageMovement(f);
  if (total > REPORT_ROW_CAP) return { rows: [], count: total, capped: true };

  let q: any = supabase
    .from("lead_stage_history")
    .select(
      "id, lead_id, created_at, previous_stage, new_stage, previous_status, new_status, changed_by_role, change_reason"
    );
  q = applyDateRange(q, f, "created_at");
  if (f.newStage && f.newStage !== "all") q = q.eq("new_stage", f.newStage);
  if (f.partnerId !== "all") {
    const { data: leadIds } = await supabase
      .from("student_leads")
      .select("id")
      .eq("partner_id", f.partnerId)
      .eq("is_archived", false)
      .limit(REPORT_ROW_CAP);
    q = q.in("lead_id", ((leadIds ?? []) as Array<{id: string}>).map((l) => l.id));
  }
  q = q.order("created_at", { ascending: false }).limit(REPORT_ROW_CAP);

  const { data, error } = await q;
  if (error) return { rows: [], count: 0, capped: false, error: error.message };

  // Enrich with student name + partner
  const leadIds = Array.from(new Set((data ?? []).map((r: any) => r.lead_id)));
  const leadMap = new Map<string, { name: string; partnerId: string | null; lead_id: string | null }>();
  if (leadIds.length) {
    const { data: lData } = await supabase
      .from("student_leads")
      .select("id, lead_id, student_full_name, student_first_name, student_last_name, partner_id")
      .in("id", leadIds);
    (lData ?? []).forEach((l: any) =>
      leadMap.set(l.id, { name: studentName(l), partnerId: l.partner_id, lead_id: l.lead_id })
    );
  }
  const partnerIds = Array.from(
    new Set(Array.from(leadMap.values()).map((v) => v.partnerId).filter(Boolean) as string[])
  );
  const partnerMap = new Map<string, string>();
  if (partnerIds.length) {
    const { data: pData } = await supabase
      .from("partner_organizations")
      .select("id, display_name")
      .in("id", partnerIds);
    (pData ?? []).forEach((p) => partnerMap.set(p.id, p.display_name ?? ""));
  }

  const rows = (data ?? []).map((r: any) => {
    const ld = leadMap.get(r.lead_id);
    return {
      "Lead ID": ld?.lead_id ?? r.lead_id.slice(0, 8),
      "Student Name": ld?.name ?? "",
      Partner: ld?.partnerId ? partnerMap.get(ld.partnerId) ?? "" : "",
      "Changed At": fmtDate(r.created_at),
      "Previous Stage": r.previous_stage ?? "",
      "New Stage": r.new_stage,
      "Previous Status": r.previous_status ?? "",
      "New Status": r.new_status,
      "Changed By Role": r.changed_by_role ?? "",
      "Change Reason": r.change_reason ?? "",
    };
  });
  return { rows, count: rows.length, capped: false };
}

export async function fetchDocumentsPendingReport(f: ReportFilterState): Promise<ReportResult<any>> {
  const total = await countDocumentsPending(f);
  if (total > REPORT_ROW_CAP) return { rows: [], count: total, capped: true };

  let q: any = supabase
    .from("lead_documents")
    .select(
      "id, lead_id, document_type_id, file_name, uploaded_at, verification_status"
    )
    .eq("is_latest", true)
    .in("verification_status", ["uploaded", "reupload_needed"]);
  q = applyDateRange(q, f, "uploaded_at");
  if (f.partnerId !== "all") {
    const { data: leadIds } = await supabase
      .from("student_leads")
      .select("id")
      .eq("partner_id", f.partnerId)
      .eq("is_archived", false)
      .limit(REPORT_ROW_CAP);
    q = q.in("lead_id", ((leadIds ?? []) as Array<{id: string}>).map((l) => l.id));
  }
  q = q.order("uploaded_at", { ascending: true }).limit(REPORT_ROW_CAP);

  const { data, error } = await q;
  if (error) return { rows: [], count: 0, capped: false, error: error.message };

  const leadIds = Array.from(new Set((data ?? []).map((r: any) => r.lead_id)));
  const leadMap = new Map<string, { name: string; partnerId: string | null; lead_id: string | null; archived: boolean }>();
  if (leadIds.length) {
    const { data: lData } = await supabase
      .from("student_leads")
      .select("id, lead_id, student_full_name, student_first_name, student_last_name, partner_id, is_archived")
      .in("id", leadIds);
    (lData ?? []).forEach((l: any) =>
      leadMap.set(l.id, {
        name: studentName(l),
        partnerId: l.partner_id,
        lead_id: l.lead_id,
        archived: !!l.is_archived,
      })
    );
  }

  const partnerIds = Array.from(
    new Set(Array.from(leadMap.values()).map((v) => v.partnerId).filter(Boolean) as string[])
  );
  const partnerMap = new Map<string, string>();
  if (partnerIds.length) {
    const { data: pData } = await supabase
      .from("partner_organizations")
      .select("id, display_name")
      .in("id", partnerIds);
    (pData ?? []).forEach((p) => partnerMap.set(p.id, p.display_name ?? ""));
  }

  const docTypeIds = Array.from(new Set((data ?? []).map((r: any) => r.document_type_id).filter(Boolean)));
  const docNameMap = new Map<string, string>();
  if (docTypeIds.length) {
    const { data: dData } = await supabase
      .from("document_master")
      .select("id, document_name")
      .in("id", docTypeIds);
    (dData ?? []).forEach((d: any) => docNameMap.set(d.id, d.document_name));
  }

  const now = Date.now();
  const rows = (data ?? [])
    .filter((r: any) => {
      const ld = leadMap.get(r.lead_id);
      return ld && !ld.archived;
    })
    .map((r: any) => {
      const ld = leadMap.get(r.lead_id);
      const days = r.uploaded_at
        ? Math.floor((now - new Date(r.uploaded_at).getTime()) / 86400000)
        : 0;
      return {
        "Lead ID": ld?.lead_id ?? r.lead_id.slice(0, 8),
        "Student Name": ld?.name ?? "",
        Partner: ld?.partnerId ? partnerMap.get(ld.partnerId) ?? "" : "",
        Document: r.document_type_id ? docNameMap.get(r.document_type_id) ?? "" : "",
        "File Name": r.file_name,
        "Uploaded At": fmtDate(r.uploaded_at),
        Status: r.verification_status,
        "Days Waiting": days,
      };
    })
    .sort((a, b) => Number(b["Days Waiting"]) - Number(a["Days Waiting"]));
  return { rows, count: rows.length, capped: false };
}

export async function fetchEditRequestsReport(f: ReportFilterState): Promise<ReportResult<any>> {
  const total = await countEditRequests(f);
  if (total > REPORT_ROW_CAP) return { rows: [], count: total, capped: true };

  let q: any = supabase
    .from("lead_edit_requests")
    .select(
      "id, lead_id, partner_id, requested_by_user_id, requested_changes, partner_reason, " +
        "status, admin_decision_note, decided_at, applied_at, created_at"
    );
  q = applyDateRange(q, f, "created_at");
  if (f.editRequestStatus && f.editRequestStatus !== "all") q = q.eq("status", f.editRequestStatus);
  if (f.partnerId !== "all") q = q.eq("partner_id", f.partnerId);
  q = q.order("created_at", { ascending: false }).limit(REPORT_ROW_CAP);

  const { data, error } = await q;
  if (error) return { rows: [], count: 0, capped: false, error: error.message };

  const leadIds = Array.from(new Set((data ?? []).map((r: any) => r.lead_id)));
  const leadMap = new Map<string, string>();
  if (leadIds.length) {
    const { data: lData } = await supabase
      .from("student_leads")
      .select("id, lead_id")
      .in("id", leadIds);
    (lData ?? []).forEach((l: any) => leadMap.set(l.id, l.lead_id ?? ""));
  }
  const partnerIds = Array.from(new Set((data ?? []).map((r: any) => r.partner_id).filter(Boolean)));
  const partnerMap = new Map<string, string>();
  if (partnerIds.length) {
    const { data: pData } = await supabase
      .from("partner_organizations")
      .select("id, display_name")
      .in("id", partnerIds);
    (pData ?? []).forEach((p) => partnerMap.set(p.id, p.display_name ?? ""));
  }
  const userIds = Array.from(new Set((data ?? []).map((r: any) => r.requested_by_user_id).filter(Boolean)));
  const userMap = new Map<string, string>();
  if (userIds.length) {
    const { data: uData } = await supabase.from("users").select("id, full_name").in("id", userIds);
    (uData ?? []).forEach((u: any) => userMap.set(u.id, u.full_name ?? ""));
  }

  const rows = (data ?? []).map((r: any) => {
    const fields = r.requested_changes && typeof r.requested_changes === "object"
      ? Object.keys(r.requested_changes).length
      : 0;
    return {
      "Request ID": r.id.slice(0, 8),
      "Lead ID": leadMap.get(r.lead_id) ?? r.lead_id.slice(0, 8),
      Partner: partnerMap.get(r.partner_id) ?? "",
      "Requested At": fmtDate(r.created_at),
      "Requested By": userMap.get(r.requested_by_user_id) ?? "",
      Status: r.status,
      "Fields Count": fields,
      "Partner Reason": r.partner_reason ?? "",
      "Decided At": fmtDate(r.decided_at),
      "Decision Note": r.admin_decision_note ?? "",
    };
  });
  return { rows, count: rows.length, capped: false };
}

export async function fetchPartnerPerformanceReport(f: ReportFilterState): Promise<ReportResult<any>> {
  // Partners (real, non-archived, non-system).
  const { data: partners, error: pErr } = await supabase
    .from("partner_organizations")
    .select("id, partner_code, display_name, status")
    .eq("is_archived", false)
    .neq("partner_code", "PTR-DIRECT")
    .order("display_name");
  if (pErr) return { rows: [], count: 0, capped: false, error: pErr.message };
  if (!partners?.length) return { rows: [], count: 0, capped: false };

  if (partners.length > REPORT_ROW_CAP) {
    return { rows: [], count: partners.length, capped: true };
  }

  // Pull only the qualifying leads (non-archived, partner-sourced) within date range.
  let lq: any = supabase
    .from("student_leads")
    .select("partner_id, current_stage")
    .eq("is_archived", false)
    .eq("source_type", "partner")
    .in("partner_id", partners.map((p) => p.id))
    .limit(REPORT_ROW_CAP);
  lq = applyDateRange(lq, f, "created_at");

  const { data: leads, error: lErr } = await lq;
  if (lErr) return { rows: [], count: 0, capped: false, error: lErr.message };

  const stageBuckets = {
    draft: ["draft"],
    submitted: ["submitted", "under_initial_review"],
    under_review: ["documents_pending", "documents_under_review", "bre_evaluated"],
    sent_to_lender: ["sent_to_lender", "login_submitted", "credit_query"],
    sanctioned: ["sanction_received"],
    disbursed: ["disbursed"],
    rejected: ["rejected"],
    dropped: ["dropped", "on_hold"],
  } as const;

  const rows = partners.map((p) => {
    const partnerLeads = (leads ?? []).filter((l: any) => l.partner_id === p.id);
    const total = partnerLeads.length;
    const counts: Record<string, number> = {};
    (Object.keys(stageBuckets) as Array<keyof typeof stageBuckets>).forEach((bucket) => {
      counts[bucket] = partnerLeads.filter((l: any) =>
        (stageBuckets[bucket] as readonly string[]).includes(l.current_stage)
      ).length;
    });
    return {
      "Partner Code": p.partner_code,
      "Partner Name": p.display_name,
      Status: p.status,
      "Total Leads": total,
      Draft: counts.draft,
      Submitted: counts.submitted,
      "Under Review": counts.under_review,
      "Sent to Lender": counts.sent_to_lender,
      Sanctioned: counts.sanctioned,
      Disbursed: counts.disbursed,
      Rejected: counts.rejected,
      "Dropped / On Hold": counts.dropped,
    };
  });
  return { rows, count: rows.length, capped: false };
}

/* -------------------------------------------------------------- */
/*                    Download helpers                             */
/* -------------------------------------------------------------- */

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function buildFilename(slug: string, ext: "csv" | "xlsx"): string {
  return `${slug}_${timestamp()}.${ext}`;
}

export function downloadCSV(rows: Record<string, any>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadXLSX(rows: Record<string, any>[], filename: string, sheetName = "Report") {
  if (!rows.length) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename);
}
