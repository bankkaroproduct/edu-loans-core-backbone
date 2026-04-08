import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Upload, CheckCircle, AlertTriangle, Clock, XCircle, ArrowRight } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type DocReq = Tables<"lead_document_requirements"> & {
  document_master?: { document_name: string; document_category: string | null } | null;
};

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  verified: { icon: CheckCircle, color: "text-green-600", label: "Verified" },
  uploaded: { icon: Clock, color: "text-blue-600", label: "Uploaded" },
  under_review: { icon: Clock, color: "text-amber-600", label: "Under Review" },
  rejected: { icon: XCircle, color: "text-destructive", label: "Rejected" },
  reupload_needed: { icon: AlertTriangle, color: "text-orange-600", label: "Reupload Needed" },
  not_uploaded: { icon: Upload, color: "text-muted-foreground", label: "Pending Upload" },
  waived: { icon: CheckCircle, color: "text-muted-foreground", label: "Waived" },
  not_applicable: { icon: CheckCircle, color: "text-muted-foreground", label: "N/A" },
};

interface Props {
  requirements: DocReq[];
  leadId: string;
}

export function LeadDocumentSnapshot({ requirements, leadId }: Props) {
  const navigate = useNavigate();

  const counts = {
    total: requirements.length,
    uploaded: requirements.filter(r => ["uploaded", "under_review", "verified"].includes(r.status)).length,
    verified: requirements.filter(r => r.status === "verified").length,
    pending: requirements.filter(r => r.status === "not_uploaded").length,
    rejected: requirements.filter(r => r.status === "rejected").length,
    reupload: requirements.filter(r => r.status === "reupload_needed").length,
  };

  const hasBlockers = counts.rejected > 0 || counts.reupload > 0;
  const hasPending = counts.pending > 0;
  const requiredOnly = requirements.filter(r => r.required_flag && !["waived", "not_applicable"].includes(r.status));
  const allVerified = requiredOnly.length > 0 && requiredOnly.every(r => r.status === "verified");

  // Sort: blockers first, then pending, then rest
  const blockerDocs = requirements.filter(r => ["rejected", "reupload_needed"].includes(r.status));
  const pendingDocs = requirements.filter(r => r.status === "not_uploaded");
  const priorityDocs = [...blockerDocs, ...pendingDocs].slice(0, 4);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Document Checklist
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => navigate(`/leads/${leadId}/documents`)}>
            Manage Documents <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status summary with blocker awareness */}
        {requirements.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No document requirements set for this lead yet.</p>
        ) : (
          <>
            {/* Blocker / status banner */}
            {allVerified && (
              <div className="flex items-center gap-2 rounded-md bg-green-50 dark:bg-green-950/20 p-2.5 text-sm text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>All required documents are verified.</span>
              </div>
            )}
            {hasBlockers && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-2.5 text-sm text-destructive border border-destructive/20">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  {counts.rejected > 0 && `${counts.rejected} rejected`}
                  {counts.rejected > 0 && counts.reupload > 0 && ", "}
                  {counts.reupload > 0 && `${counts.reupload} need reupload`}
                  {" — action required"}
                </span>
              </div>
            )}
            {!hasBlockers && hasPending && !allVerified && (
              <div className="flex items-center gap-2 rounded-md bg-blue-50 dark:bg-blue-950/20 p-2.5 text-sm text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                <Upload className="h-4 w-4 shrink-0" />
                <span>{counts.pending} document{counts.pending > 1 ? "s" : ""} pending upload</span>
              </div>
            )}

            {/* Summary counts */}
            <div className="flex gap-4 flex-wrap text-xs">
              <span className="text-muted-foreground">Total: <span className="font-semibold text-foreground">{counts.total}</span></span>
              <span className="text-green-700 dark:text-green-400">Verified: <span className="font-semibold">{counts.verified}</span></span>
              <span className="text-blue-700 dark:text-blue-400">Uploaded: <span className="font-semibold">{counts.uploaded}</span></span>
              <span className="text-muted-foreground">Pending: <span className="font-semibold">{counts.pending}</span></span>
              {counts.rejected > 0 && <span className="text-destructive">Rejected: <span className="font-semibold">{counts.rejected}</span></span>}
              {counts.reupload > 0 && <span className="text-orange-600">Reupload: <span className="font-semibold">{counts.reupload}</span></span>}
            </div>

            {/* Priority items: blockers + pending first */}
            {priorityDocs.length > 0 && (
              <div className="space-y-1.5">
                {priorityDocs.map(req => {
                  const cfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.not_uploaded;
                  const Icon = cfg.icon;
                  const isBlocker = ["rejected", "reupload_needed"].includes(req.status);
                  return (
                    <div key={req.id} className={`flex items-center justify-between rounded-md border p-2.5 ${
                      isBlocker ? "border-destructive/30 bg-destructive/5" : ""
                    }`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {req.document_master?.document_name ?? "Document"}
                          </p>
                          {req.remarks && isBlocker && (
                            <p className="text-xs text-destructive truncate">{req.remarks}</p>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant={isBlocker ? "destructive" : "outline"}
                        className="text-[10px] shrink-0 ml-2"
                      >
                        {cfg.label}
                      </Badge>
                    </div>
                  );
                })}
                {requirements.length > 4 && (
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => navigate(`/leads/${leadId}/documents`)}>
                    View all {requirements.length} documents →
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
