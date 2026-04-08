import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Upload, CheckCircle, AlertTriangle, Clock, XCircle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type DocReq = Tables<"lead_document_requirements"> & {
  document_master?: { document_name: string; document_category: string | null } | null;
};

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  verified: { icon: CheckCircle, color: "text-green-600", label: "Verified" },
  uploaded: { icon: Clock, color: "text-blue-600", label: "Under Review" },
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Document Checklist
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => navigate(`/leads/${leadId}/documents`)}>
            Manage Documents
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary counts */}
        <div className="flex gap-4 flex-wrap text-xs">
          <span className="text-muted-foreground">Total: <span className="font-semibold text-foreground">{counts.total}</span></span>
          <span className="text-green-700">Verified: <span className="font-semibold">{counts.verified}</span></span>
          <span className="text-blue-700">Uploaded: <span className="font-semibold">{counts.uploaded}</span></span>
          <span className="text-muted-foreground">Pending: <span className="font-semibold">{counts.pending}</span></span>
          {counts.rejected > 0 && <span className="text-destructive">Rejected: <span className="font-semibold">{counts.rejected}</span></span>}
          {counts.reupload > 0 && <span className="text-orange-600">Reupload: <span className="font-semibold">{counts.reupload}</span></span>}
        </div>

        {requirements.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No document requirements set for this lead yet.</p>
        ) : (
          <div className="space-y-2">
            {requirements.slice(0, 5).map(req => {
              const cfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.not_uploaded;
              const Icon = cfg.icon;
              return (
                <div key={req.id} className="flex items-center justify-between rounded-md border p-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {req.document_master?.document_name ?? "Document"}
                      </p>
                      {req.remarks && <p className="text-xs text-muted-foreground truncate">{req.remarks}</p>}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0 ml-2">{cfg.label}</Badge>
                </div>
              );
            })}
            {requirements.length > 5 && (
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => navigate(`/leads/${leadId}/documents`)}>
                View all {requirements.length} documents →
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
