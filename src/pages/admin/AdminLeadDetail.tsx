import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";

import { AdminLeadHeader } from "@/components/admin/lead-detail/AdminLeadHeader";
import { AdminLeadSummaryStrip } from "@/components/admin/lead-detail/AdminLeadSummaryStrip";
import { AdminLeadProfileSection } from "@/components/admin/lead-detail/AdminLeadProfileSection";
import { AdminLeadLifecycleProgress } from "@/components/admin/lead-detail/AdminLeadLifecycleProgress";
import { AdminLeadTimeline } from "@/components/admin/lead-detail/AdminLeadTimeline";
import { AdminLeadDuplicateContext } from "@/components/admin/lead-detail/AdminLeadDuplicateContext";
import { AdminLeadPayoutSnapshot } from "@/components/admin/lead-detail/AdminLeadPayoutSnapshot";
import { AdminPartnerCard } from "@/components/admin/AdminPartnerCard";
import { AdminStageStatusPanel } from "@/components/admin/AdminStageStatusPanel";
import { AdminLeadDocumentsView } from "@/components/admin/AdminLeadDocumentsView";
import { AdminInternalNotes } from "@/components/admin/AdminInternalNotes";
import { AdminEditRequestPanel } from "@/components/admin/AdminEditRequestPanel";
import { AdminAssignLenderCard } from "@/components/admin/AdminAssignLenderCard";
import { AdminBreAndLenderSection } from "@/components/admin/AdminBreAndLenderSection";
import { LeadAuthenticityEditor } from "@/components/admin/LeadAuthenticityEditor";
import { LeadCommunicationPanel } from "@/components/admin/communications/LeadCommunicationPanel";
import { useLeadDocumentsData } from "@/hooks/useLeadDocumentsData";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"student_leads">;
type History = Tables<"lead_stage_history">;
type Note = Tables<"lead_notes">;
type PayoutRecord = Tables<"partner_payout_records">;
type PartnerOrg = Tables<"partner_organizations">;
type AuditLog = Tables<"audit_logs">;

interface DocReq {
  id: string;
  document_type_id: string;
  status: string;
  required_flag: boolean;
  remarks: string | null;
  document_master?: {
    document_name: string;
    document_category: string | null;
    document_code?: string | null;
    applicable_for?: string | null;
  } | null;
}

interface State {
  loading: boolean;
  error: string | null;
  notFound: boolean;
  lead: Lead | null;
  history: History[];
  notes: Note[];
  payouts: PayoutRecord[];
  partner: PartnerOrg | null;
  submittedByName: string | null;
  audits: AuditLog[];
  actorNames: Record<string, string>;
}

const initialState: State = {
  loading: true,
  error: null,
  notFound: false,
  lead: null,
  history: [],
  notes: [],
  payouts: [],
  partner: null,
  submittedByName: null,
  audits: [],
  actorNames: {},
};

export default function AdminLeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<State>(initialState);

  // Shared source of truth for the lead's document requirements + uploaded files,
  // used both here (embedded review panel) and on /admin/leads/:id/documents.
  const {
    requirements: sharedRequirements,
    documents: sharedDocuments,
    refresh: refreshDocs,
  } = useLeadDocumentsData(id);

  const loadAll = useCallback(async () => {
    if (!id) return;
    setState((s) => ({ ...s, loading: true, error: null, notFound: false }));
    try {
      const leadRes = await supabase.from("student_leads").select("*").eq("id", id).maybeSingle();
      if (leadRes.error) throw leadRes.error;
      if (!leadRes.data) {
        setState({ ...initialState, loading: false, notFound: true });
        return;
      }
      const lead = leadRes.data;

      const [histRes, notesRes, payoutRes, partnerRes, userRes, auditRes] = await Promise.all([
        supabase.from("lead_stage_history").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
        supabase.from("lead_notes").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
        supabase.from("partner_payout_records").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
        lead.partner_id
          ? supabase.from("partner_organizations").select("*").eq("id", lead.partner_id).maybeSingle()
          : Promise.resolve({ data: null, error: null } as never),
        lead.partner_user_id
          ? supabase.from("users").select("full_name").eq("id", lead.partner_user_id).maybeSingle()
          : Promise.resolve({ data: null, error: null } as never),
        supabase.from("audit_logs").select("*").eq("entity_type", "student_lead").eq("entity_id", id).order("created_at", { ascending: false }),
      ]);

      const errs = [histRes.error, notesRes.error, payoutRes.error, partnerRes.error, userRes.error, auditRes.error].filter(Boolean);
      if (errs.length) throw errs[0];

      // Resolve actor names for audit logs + history + notes
      const actorIds = new Set<string>();
      (auditRes.data ?? []).forEach((a) => { if (a.actor_user_id) actorIds.add(a.actor_user_id); });
      (histRes.data ?? []).forEach((h) => { if (h.changed_by_user_id) actorIds.add(h.changed_by_user_id); });
      (notesRes.data ?? []).forEach((n) => { if (n.created_by) actorIds.add(n.created_by); });
      const actorNames: Record<string, string> = {};
      if (actorIds.size > 0) {
        const { data: actorRows } = await supabase.from("users").select("id, full_name").in("id", Array.from(actorIds));
        (actorRows ?? []).forEach((u: { id: string; full_name: string }) => { actorNames[u.id] = u.full_name; });
      }

      setState({
        loading: false,
        error: null,
        notFound: false,
        lead,
        history: histRes.data ?? [],
        notes: notesRes.data ?? [],
        payouts: payoutRes.data ?? [],
        partner: (partnerRes.data ?? null) as PartnerOrg | null,
        submittedByName: (userRes.data as { full_name?: string } | null)?.full_name ?? null,
        audits: auditRes.data ?? [],
        actorNames,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load lead";
      setState({ ...initialState, loading: false, error: message });
    }
  }, [id]);

  useEffect(() => { loadAll(); }, [loadAll, location.key]);

  if (state.loading) {
    return (
      <div className="w-full space-y-6 py-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-48" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-40" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (state.notFound) {
    return (
      <div className="w-full text-center py-20 space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Lead Not Found</h2>
        <p className="text-muted-foreground">This lead doesn't exist or you don't have permission to view it.</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/admin/leads")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Lead Queue
        </Button>
      </div>
    );
  }

  if (state.error || !state.lead) {
    return (
      <div className="w-full py-10">
        <div className="flex items-center justify-between gap-4 py-6 px-4 border border-destructive/30 bg-destructive/5 rounded-md">
          <div className="flex items-center gap-3 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <div>
              <p className="font-medium text-sm">Failed to load lead</p>
              <p className="text-xs text-muted-foreground">{state.error ?? "Unknown error"}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/admin/leads")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button size="sm" onClick={() => loadAll()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const { lead, history, notes, payouts, partner, submittedByName, audits, actorNames } = state;
  const isDraft = lead.current_stage === "draft";
  const isStudentDirect = lead.source_type === "student_direct";

  const unverifiedRequiredCount = sharedRequirements.filter(
    (r) => r.required_flag && r.status !== "verified" && r.status !== "waived" && r.status !== "not_applicable",
  ).length;
  const hasSanctionInHistory = history.some((h) => h.new_stage === "sanction_received");

  const onDocsChanged = () => { refreshDocs(); loadAll(); };

  return (
    <div className="w-full space-y-6">
      <AdminLeadHeader
        lead={lead}
        submittedByName={submittedByName}
        isDraft={isDraft}
        backTo="/admin/leads"
        backLabel="Back to Lead Queue"
      />

      {/* Admin authenticity toolbar — Edit/Documents now live inside AdminLeadHeader */}
      <div className="flex items-center gap-3 flex-wrap border rounded-md px-4 py-2 bg-muted/30">
        <span className="text-xs text-muted-foreground">Authenticity</span>
        <LeadAuthenticityEditor
          leadId={lead.id}
          current={(lead as unknown as { lead_authenticity?: string }).lead_authenticity}
          fraudFlag={lead.fraud_flag}
          onChanged={loadAll}
        />
      </div>

      <AdminLeadSummaryStrip lead={lead} />

      {/* Student PTR / Partner Source profile — promoted to the top of Admin Lead
          Detail so the originating partner / student-direct context is always
          visible above the fold. Single source of truth — not duplicated lower. */}
      <AdminPartnerCard partner={partner} isStudentDirect={isStudentDirect} />

      <div className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold pt-2">Lifecycle</h2>
        <AdminLeadLifecycleProgress lead={lead} />
        <AdminLeadDuplicateContext lead={lead} />
        <AdminEditRequestPanel leadId={lead.id} onChanged={loadAll} />
      </div>

      {/* Lifecycle + lender workflow cluster — full-width, hoisted above the
          two-column grid so the visual order is always:
          Lifecycle Timeline → Lender Recommendations → Calculate BRE → Assign Lender. */}
      <div className="space-y-6 mt-2">
        <div className="space-y-1">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Lender Workflow</h2>
          <p className="text-xs text-muted-foreground">
            Diagnostic and assignment tools — manual changes do not auto-update lifecycle.
          </p>
        </div>
        <AdminLeadTimeline history={history} notes={notes} audits={audits} actorNames={actorNames} />
        <AdminBreAndLenderSection lead={lead} />
        <AdminAssignLenderCard leadId={lead.id} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <AdminLeadProfileSection lead={lead} submittedByName={submittedByName} onSaved={loadAll} />

          <AdminLeadDocumentsView
            leadId={lead.id}
            lead={lead}
            requirements={sharedRequirements}
            documents={sharedDocuments}
            onChanged={onDocsChanged}
          />

          <AdminInternalNotes
            leadId={lead.id}
            notes={notes}
            onNoteAdded={loadAll}
          />
        </div>

        <div className="space-y-6">
          {/* AdminPartnerCard intentionally NOT rendered here — it lives at the
              top of the page (above LeadLifecycleProgress) as the sole source
              of truth for the partner / student-direct profile. */}
          <LeadCommunicationPanel lead={lead} />

          <AdminStageStatusPanel
            lead={lead}
            unverifiedRequiredCount={unverifiedRequiredCount}
            hasSanctionInHistory={hasSanctionInHistory}
            onChanged={loadAll}
          />

          <AdminLeadPayoutSnapshot payouts={payouts} leadId={lead.id} />

        </div>
      </div>
    </div>
  );
}
