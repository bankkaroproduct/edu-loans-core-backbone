import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, RefreshCw } from "lucide-react";
import { DocumentSummaryStrip } from "@/components/documents/DocumentSummaryStrip";
import { DocumentChecklist } from "@/components/documents/DocumentChecklist";
import { DocumentUploadDialog } from "@/components/documents/DocumentUploadDialog";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"student_leads">;

export type DocRequirement = Tables<"lead_document_requirements"> & {
  document_master?: { document_name: string; document_category: string | null; document_code?: string | null; applicable_for?: string | null } | null;
};

export type DocFile = Tables<"lead_documents"> & {
  document_master?: { document_name: string } | null;
};

export default function LeadDocuments() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userId, role } = useRoleAccess();
  const isAdminContext =
    role === "admin" ||
    role === "super_admin" ||
    (typeof window !== "undefined" && window.location.pathname.startsWith("/admin"));
  const leadDetailPath = `${isAdminContext ? "/admin/leads" : "/leads"}/${id}`;

  const [lead, setLead] = useState<Lead | null>(null);
  const [requirements, setRequirements] = useState<DocRequirement[]>([]);
  const [documents, setDocuments] = useState<DocFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Upload dialog state
  const [uploadTarget, setUploadTarget] = useState<DocRequirement | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;

    const leadRes = await supabase.from("student_leads").select("*").eq("id", id).maybeSingle();
    if (!leadRes.data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLead(leadRes.data);

    const [reqRes, docRes] = await Promise.all([
      supabase
        .from("lead_document_requirements")
        .select("*, document_master(document_name, document_category, document_code, applicable_for)")
        .eq("lead_id", id)
        .order("created_at"),
      supabase
        .from("lead_documents")
        .select("*, document_master(document_name)")
        .eq("lead_id", id)
        .order("uploaded_at", { ascending: false }),
    ]);

    setRequirements(reqRes.data ?? []);
    setDocuments(docRes.data ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUploadComplete = () => {
    setUploadTarget(null);
    loadData();
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 py-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (notFound || !lead) {
    return (
      <div className="max-w-5xl mx-auto text-center py-20 space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Lead Not Found</h2>
        <p className="text-muted-foreground">This lead doesn't exist or you don't have permission to view its documents.</p>
        <button onClick={() => navigate("/leads")} className="text-sm text-primary hover:underline">
          ← Back to Submitted Leads
        </button>
      </div>
    );
  }

  const studentName = lead.student_full_name || `${lead.student_first_name} ${lead.student_last_name ?? ""}`.trim();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate(leadDetailPath)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold text-foreground truncate">Documents</h1>
              <Badge variant="outline" className="text-xs font-mono">{lead.lead_id ?? lead.id.slice(0, 8)}</Badge>
            </div>
            <p className="text-sm text-muted-foreground truncate">{studentName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs capitalize">{lead.current_stage.replace(/_/g, " ")}</Badge>
          <Button variant="outline" size="sm" onClick={() => loadData()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* Summary Strip */}
      <DocumentSummaryStrip requirements={requirements} />

      {/* Checklist */}
      {requirements.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center space-y-2">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground" />
          <h3 className="font-medium text-foreground">No Document Requirements</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            No document requirements have been configured for this lead yet. Requirements will appear here once they are set by the operations team.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate(`/leads/${id}`)}>
            Back to Lead Detail
          </Button>
        </div>
      ) : (
        <DocumentChecklist
          requirements={requirements}
          documents={documents}
          onUpload={(req) => setUploadTarget(req)}
          leadId={lead.id}
        />
      )}

      {/* Upload Dialog */}
      {uploadTarget && lead && (
        <DocumentUploadDialog
          open={!!uploadTarget}
          onOpenChange={(open) => !open && setUploadTarget(null)}
          requirement={uploadTarget}
          leadId={lead.id}
          lead={lead}
          applicableFor={uploadTarget.document_master?.applicable_for ?? null}
          userId={userId}
          userRole={role}
          onUploadComplete={handleUploadComplete}
          currentVersionCount={documents.filter(d => d.document_type_id === uploadTarget.document_type_id).length}
        />
      )}
    </div>
  );
}
