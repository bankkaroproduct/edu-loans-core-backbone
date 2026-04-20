import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { Skeleton } from "@/components/ui/skeleton";
import { LeadDetailHeader } from "@/components/lead-detail/LeadDetailHeader";
import { LeadSummaryStrip } from "@/components/lead-detail/LeadSummaryStrip";
import { LeadProfileSection } from "@/components/lead-detail/LeadProfileSection";
import { LeadLifecycleProgress } from "@/components/lead-detail/LeadLifecycleProgress";
import { LeadTimeline } from "@/components/lead-detail/LeadTimeline";
import { LeadNotes } from "@/components/lead-detail/LeadNotes";
import { LeadDocumentSnapshot } from "@/components/lead-detail/LeadDocumentSnapshot";
import { LeadDuplicateContext } from "@/components/lead-detail/LeadDuplicateContext";
import { LeadActionPanel } from "@/components/lead-detail/LeadActionPanel";
import { LeadPayoutSnapshot } from "@/components/lead-detail/LeadPayoutSnapshot";
import { LeadEditRequestDialog } from "@/components/lead-detail/LeadEditRequestDialog";
import { LeadEditRequestBanner } from "@/components/lead-detail/LeadEditRequestBanner";
import { LeadEditRequestHistory } from "@/components/lead-detail/LeadEditRequestHistory";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"student_leads">;
type History = Tables<"lead_stage_history">;
type Note = Tables<"lead_notes">;
type PayoutRecord = Tables<"partner_payout_records">;
type EditRequest = Tables<"lead_edit_requests">;

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userId, isPartnerAgent } = useRoleAccess();

  const [lead, setLead] = useState<Lead | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [docRequirements, setDocRequirements] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [submittedByName, setSubmittedByName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;

    const leadRes = await supabase.from("student_leads").select("*").eq("id", id).maybeSingle();

    if (!leadRes.data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const lead = leadRes.data;
    setLead(lead);

    // Parallel fetch all related data
    const [histRes, notesRes, docRes, payoutRes] = await Promise.all([
      supabase.from("lead_stage_history").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
      supabase.from("lead_notes").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
      supabase.from("lead_document_requirements").select("*, document_master(document_name, document_category)").eq("lead_id", id).order("created_at"),
      supabase.from("partner_payout_records").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
    ]);

    setHistory(histRes.data ?? []);
    setNotes(notesRes.data ?? []);
    setDocRequirements(docRes.data ?? []);
    setPayouts(payoutRes.data ?? []);

    // Fetch submitted by user name
    if (lead.partner_user_id) {
      const { data: userData } = await supabase
        .from("users")
        .select("full_name")
        .eq("id", lead.partner_user_id)
        .maybeSingle();
      setSubmittedByName(userData?.full_name ?? null);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refreshNotes = async () => {
    if (!id) return;
    const { data } = await supabase.from("lead_notes").select("*").eq("lead_id", id).order("created_at", { ascending: false });
    setNotes(data ?? []);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 py-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (notFound || !lead) {
    return (
      <div className="max-w-6xl mx-auto text-center py-20 space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Lead Not Found</h2>
        <p className="text-muted-foreground">This lead doesn't exist or you don't have permission to view it.</p>
        <button onClick={() => navigate("/leads")} className="text-sm text-primary hover:underline">
          ← Back to Submitted Leads
        </button>
      </div>
    );
  }

  const isDraft = lead.current_stage === "draft";

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* A. Header */}
      <LeadDetailHeader lead={lead} submittedByName={submittedByName} isDraft={isDraft} />

      {/* B. Summary Strip */}
      <LeadSummaryStrip lead={lead} />

      {/* D. Lifecycle Progress */}
      <LeadLifecycleProgress lead={lead} />

      {/* H. Duplicate Context */}
      <LeadDuplicateContext lead={lead} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: Profile + Documents + Notes */}
        <div className="lg:col-span-2 space-y-6">
          {/* C. Lead Profile */}
          <LeadProfileSection lead={lead} submittedByName={submittedByName} />

          {/* G. Document Snapshot */}
          <LeadDocumentSnapshot requirements={docRequirements} leadId={lead.id} onChanged={loadData} />

          {/* F. Notes */}
          <LeadNotes leadId={lead.id} notes={notes} userId={userId} onNoteAdded={refreshNotes} />
        </div>

        {/* Right column: Timeline + Actions + Payout */}
        <div className="space-y-6">
          {/* I. Action Panel */}
          <LeadActionPanel lead={lead} />

          {/* E. Timeline */}
          <LeadTimeline history={history} notes={notes} />

          {/* K. Payout Snapshot */}
          <LeadPayoutSnapshot payouts={payouts} leadId={id!} />
        </div>
      </div>
    </div>
  );
}
