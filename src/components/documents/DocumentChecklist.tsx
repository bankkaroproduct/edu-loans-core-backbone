import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CheckCircle, Clock, XCircle, AlertTriangle, Upload, Eye,
  FileText, ShieldCheck, Ban, RotateCcw, Info
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { DocRequirement, DocFile } from "@/pages/LeadDocuments";

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; bgClass: string; label: string }> = {
  verified:        { icon: CheckCircle,    color: "text-green-600",          bgClass: "", label: "Verified" },
  uploaded:        { icon: Clock,          color: "text-blue-600",           bgClass: "", label: "Uploaded" },
  under_review:    { icon: Clock,          color: "text-amber-600",          bgClass: "", label: "Under Review" },
  rejected:        { icon: XCircle,        color: "text-destructive",        bgClass: "bg-destructive/5 border-destructive/20", label: "Rejected" },
  reupload_needed: { icon: AlertTriangle,  color: "text-orange-600",         bgClass: "bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800", label: "Reupload Needed" },
  not_uploaded:    { icon: Upload,         color: "text-muted-foreground",   bgClass: "", label: "Pending Upload" },
  waived:          { icon: ShieldCheck,    color: "text-muted-foreground",   bgClass: "opacity-60", label: "Waived" },
  not_applicable:  { icon: Ban,            color: "text-muted-foreground",   bgClass: "opacity-60", label: "N/A" },
};

interface Props {
  requirements: DocRequirement[];
  documents: DocFile[];
  onUpload: (req: DocRequirement) => void;
  leadId: string;
}

export function DocumentChecklist({ requirements, documents, onUpload, leadId }: Props) {
  // Group documents by document_type_id for quick lookup
  const docsByType = new Map<string, DocFile[]>();
  documents.forEach(doc => {
    if (doc.document_type_id) {
      const existing = docsByType.get(doc.document_type_id) ?? [];
      existing.push(doc);
      docsByType.set(doc.document_type_id, existing);
    }
  });

  const handleViewFile = async (doc: DocFile) => {
    if (doc.storage_path) {
      const { data } = await supabase.storage
        .from("lead-documents")
        .createSignedUrl(doc.storage_path, 300);
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      } else {
        toast.error("Could not generate file link. Please try again.");
      }
    } else if (doc.file_url) {
      window.open(doc.file_url, "_blank");
    } else {
      toast.error("No file available to view.");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> Document Checklist
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {requirements.map(req => {
          const cfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.not_uploaded;
          const Icon = cfg.icon;
          const relatedDocs = docsByType.get(req.document_type_id) ?? [];
          const latestDoc = relatedDocs.find(d => d.is_latest) ?? relatedDocs[0];
          const versionCount = relatedDocs.length;
          const isActionable = ["not_uploaded", "rejected", "reupload_needed"].includes(req.status);
          const isReupload = ["rejected", "reupload_needed"].includes(req.status);

          return (
            <div
              key={req.id}
              className={`rounded-lg border p-3 transition-colors ${cfg.bgClass}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${cfg.color}`} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{req.document_master?.document_name ?? "Document"}</p>
                      {req.document_master?.document_category && (
                        <Badge variant="outline" className="text-[9px]">{req.document_master.document_category}</Badge>
                      )}
                      {req.required_flag && (
                        <Badge variant="secondary" className="text-[9px]">Required</Badge>
                      )}
                      {!req.required_flag && (
                        <Badge variant="outline" className="text-[9px] text-muted-foreground">Optional</Badge>
                      )}
                    </div>

                    {/* Latest file info */}
                    {latestDoc && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate max-w-[200px]">{latestDoc.file_name}</span>
                        {versionCount > 1 && <span>· v{latestDoc.version_number}</span>}
                        <span>· {new Date(latestDoc.uploaded_at).toLocaleDateString()}</span>
                      </div>
                    )}

                    {/* Remarks */}
                    {req.remarks && (
                      <div className={`flex items-start gap-1.5 text-xs rounded-md p-1.5 mt-1 ${
                        isReupload ? "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300" : "bg-muted text-muted-foreground"
                      }`}>
                        <Info className="h-3 w-3 shrink-0 mt-0.5" />
                        <span>{req.remarks}</span>
                      </div>
                    )}

                    {/* Due date */}
                    {req.due_date && (
                      <p className="text-[10px] text-muted-foreground">Due: {new Date(req.due_date).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>

                {/* Actions + Status Badge */}
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant={req.status === "verified" ? "default" : "outline"}
                    className={`text-[10px] ${req.status === "verified" ? "bg-green-600" : ""}`}
                  >
                    {cfg.label}
                  </Badge>

                  {latestDoc && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleViewFile(latestDoc)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>View File</TooltipContent>
                    </Tooltip>
                  )}

                  {isActionable && (
                    <Button
                      size="sm"
                      variant={isReupload ? "destructive" : "default"}
                      className="text-xs h-7"
                      onClick={() => onUpload(req)}
                    >
                      {isReupload ? (
                        <><RotateCcw className="h-3 w-3 mr-1" /> Reupload</>
                      ) : (
                        <><Upload className="h-3 w-3 mr-1" /> Upload</>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
