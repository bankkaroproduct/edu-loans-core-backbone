import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw, ArrowLeft, Edit, FileText } from "lucide-react";
import { LeadDetailHeader } from "@/components/lead-detail/LeadDetailHeader";
import { LeadSummaryStrip } from "@/components/lead-detail/LeadSummaryStrip";
import { LeadProfileSection } from "@/components/lead-detail/LeadProfileSection";
import { LeadLifecycleProgress } from "@/components/lead-detail/LeadLifecycleProgress";
import { LeadTimeline } from "@/components/lead-detail/LeadTimeline";
import { LeadDuplicateContext } from "@/components/lead-detail/LeadDuplicateContext";
import { LeadPayoutSnapshot } from "@/components/lead-detail/LeadPayoutSnapshot";
import { AdminPartnerCard } from "@/components/admin/AdminPartnerCard";
import { AdminStageStatusPanel } from "@/components/admin/AdminStageStatusPanel";
import { AdminDocumentReviewPanel } from "@/components/admin/AdminDocumentReviewPanel";
import { AdminInternalNotes } from "@/components/admin/AdminInternalNotes";
import { AdminEditRequestPanel } from "@/components/admin/AdminEditRequestPanel";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"student_leads">;
type History = Tables<"lead_stage_history">;
type Note = Tables<"lead_notes">;
type PayoutRecord = Tables<"partner_payout_records">;
type PartnerOrg = Tables<"partner_organizations">;

interface DocReq {
  id: string;
  document_type_id: string;
  status: string;
  required_flag: boolean;
  remarks: string | null;
  document_master?: { document_name: string; document_category: string | null } | null;
}

interface State {
  loading: boolean;
  error: string | null;
  notFound: boolean;
  lead: Lead | null;
  history: History[];
  notes: Note[];
  docRequirements: DocReq[];
  payouts: PayoutRecord[];
  partner: PartnerOrg | null;
  submittedByName: string | null;
}

const initialState: State = {
  loading: true,
  error: null,
  notFound: false,
  lead: null,
  history: [],
  notes: [],
  docRequirements: [],
  payouts: [],
  partner: null,
  submittedByName: null,
};

export default function AdminLeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<State>(initialState);

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

      const [histRes, notesRes, docRes, payoutRes, partnerRes, userRes] = await Promise.all([
        supabase.from("lead_stage_history").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
        supabase.from("lead_notes").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
        supabase.from("lead_document_requirements").select("*, document_master(document_name, document_category)").eq("lead_id", id).order("created_at"),
        supabase.from("partner_payout_records").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
        lead.partner_id
          ? supabase.from("partner_organizations").select("*").eq("id", lead.partner_id).maybeSingle()
          : Promise.resolve({ data: null, error: null } as never),
        lead.partner_user_id
          ? supabase.from("users").select("full_name").eq("id", lead.partner_user_id).maybeSingle()
          : Promise.resolve({ data: null, error: null } as never),
      ]);

      const errs = [histRes.error, notesRes.error, docRes.error, payoutRes.error, partnerRes.error, userRes.error].filter(Boolean);
      if (errs.length) throw errs[0];

      setState({
        loading: false,
        error: null,
        notFound: false,
        lead,
        history: histRes.data ?? [],
        notes: notesRes.data ?? [],
        docRequirements: (docRes.data ?? []) as DocReq[],
        payouts: payoutRes.data ?? [],
        partner: (partnerRes.data ?? null) as PartnerOrg | null,
        submittedByName: (userRes.data as { full_name?: string } | null)?.full_name ?? null,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load lead";
      setState({ ...initialState, loading: false, error: message });
    }
  }, [id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  if (state.loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 py-4">
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
      <div className="max-w-6xl mx-auto text-center py-20 space-y-3">
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
      <div className="max-w-6xl mx-auto py-10">
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

  const { lead, history, notes, docRequirements, payouts, partner, submittedByName } = state;
  const isDraft = lead.current_stage === "draft";
  const isStudentDirect = lead.source_type === "student_direct";

  const unverifiedRequiredCount = docRequirements.filter(
    (r) => r.required_flag && r.status !== "verified" && r.status !== "waived" && r.status !== "not_applicable",
  ).length;
  const hasSanctionInHistory = history.some((h) => h.new_stage === "sanction_received");

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <LeadDetailHeader
        lead={lead}
        submittedByName={submittedByName}
        isDraft={isDraft}
        backTo="/admin/leads"
        backLabel="Back to Lead Queue"
        hideActions
      />

      {/* Admin direct-action row — Edit is always enabled, including terminal stages */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate(`/leads/${lead.id}/documents`)}>
          <FileText className="h-4 w-4 mr-1" /> Documents
        </Button>
        <Button size="sm" onClick={() => navigate(`/admin/leads/new?edit=${lead.id}`)}>
          <Edit className="h-4 w-4 mr-1" /> Edit Lead
        </Button>
      </div>

      <LeadSummaryStrip lead={lead} />
      <LeadLifecycleProgress lead={lead} />
      <LeadDuplicateContext lead={lead} />
      <AdminEditRequestPanel leadId={lead.id} onChanged={loadAll} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <LeadProfileSection lead={lead} submittedByName={submittedByName} />

          <AdminDocumentReviewPanel
            leadId={lead.id}
            requirements={docRequirements}
            onChanged={loadAll}
          />

          <AdminInternalNotes
            leadId={lead.id}
            notes={notes}
            onNoteAdded={loadAll}
          />
        </div>

        <div className="space-y-6">
          <AdminPartnerCard partner={partner} isStudentDirect={isStudentDirect} />

          <AdminStageStatusPanel
            lead={lead}
            unverifiedRequiredCount={unverifiedRequiredCount}
            hasSanctionInHistory={hasSanctionInHistory}
            onChanged={loadAll}
          />

          <LeadTimeline history={history} notes={notes} />

          <LeadPayoutSnapshot payouts={payouts} leadId={lead.id} />
        </div>
      </div>
    </div>
  );
}
