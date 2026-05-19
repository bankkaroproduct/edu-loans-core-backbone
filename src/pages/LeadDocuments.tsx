import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { DocumentSummaryStrip } from "@/components/documents/DocumentSummaryStrip";
import { DocumentChecklist } from "@/components/documents/DocumentChecklist";
import { DocumentUploadDialog } from "@/components/documents/DocumentUploadDialog";
import { AdminAddDocumentButton } from "@/components/documents/AdminAddDocumentButton";
import { AdminLeadDocumentsView } from "@/components/admin/AdminLeadDocumentsView";
import {
  useLeadDocumentsData,
  type LeadDocRequirement,
  type LeadDocFile,
} from "@/hooks/useLeadDocumentsData";

// Re-export for backwards compatibility with consumers that imported these from this page module.
export type DocRequirement = LeadDocRequirement;
export type DocFile = LeadDocFile;

export default function LeadDocuments() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userId, role } = useRoleAccess();
  const isAdminContext =
    role === "admin" ||
    role === "super_admin" ||
    (typeof window !== "undefined" && window.location.pathname.startsWith("/admin"));
  const leadDetailPath = `${isAdminContext ? "/admin/leads" : "/leads"}/${id}`;

  const { lead, requirements, documents, loading, notFound, refresh } = useLeadDocumentsData(id);

  // Upload dialog state (used only by partner/student checklist; admin panel manages its own dialog)
  const [uploadTarget, setUploadTarget] = useState<DocRequirement | null>(null);

  const handleUploadComplete = () => {
    setUploadTarget(null);
    refresh();
  };

  if (loading) {
    return (
      <div className="max-w-screen-2xl mx-auto space-y-6 py-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (notFound || !lead) {
    return (
      <div className="max-w-screen-2xl mx-auto text-center py-20 space-y-3">
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
    <div className="max-w-screen-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate(leadDetailPath)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground truncate">Documents</h1>
              <Badge variant="outline" className="text-xs font-mono">{lead.lead_id ?? lead.id.slice(0, 8)}</Badge>
            </div>
            <p className="text-sm text-muted-foreground truncate">{studentName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs capitalize">{lead.current_stage.replace(/_/g, " ")}</Badge>
          {isAdminContext && (
            <AdminAddDocumentButton
              leadId={lead.id}
              existingRequirements={requirements}
              onRequirementReady={(req) => {
                // For admin context the upload happens via the embedded panel which re-fetches on its own.
                // Refresh shared data so the new requirement row shows up immediately.
                refresh();
                // Partner/student fallback: still allow direct upload dialog.
                if (!isAdminContext) setUploadTarget(req);
              }}
            />
          )}
          <Button variant="outline" size="sm" onClick={() => refresh()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* Body — admin renders the SAME shared view used embedded in Lead Detail; partners/students keep the checklist. */}
      {isAdminContext ? (
        <AdminLeadDocumentsView
          leadId={lead.id}
          lead={lead}
          requirements={requirements}
          documents={documents}
          onChanged={refresh}
        />
      ) : (
        <>
          <DocumentSummaryStrip requirements={requirements} hideNudge={isAdminContext} />
          <DocumentChecklist
            requirements={requirements}
            documents={documents}
            onUpload={(req) => setUploadTarget(req)}
            leadId={lead.id}
            hideNudge={isAdminContext}
            highestQualification={lead.highest_qualification}
          />
        </>
      )}

      {/* Upload Dialog — only used by the partner/student checklist path */}
      {uploadTarget && lead && !isAdminContext && (
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
