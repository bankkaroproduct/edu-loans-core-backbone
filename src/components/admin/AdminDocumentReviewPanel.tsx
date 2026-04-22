import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  FileText, CheckCircle, XCircle, AlertTriangle, Upload, Eye, Loader2, ChevronDown, ChevronRight, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { reviewDocument } from "@/lib/adminActions";
import { DocumentUploadDialog } from "@/components/documents/DocumentUploadDialog";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import type { DocRequirement } from "@/pages/LeadDocuments";
import type { LeadNameFields } from "@/lib/referenceName";

interface DocRequirementInput {
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

interface LeadDocument {
  id: string;
  lead_id: string;
  document_type_id: string | null;
  file_name: string;
  storage_path: string | null;
  mime_type: string | null;
  verification_status: string;
  verification_remark: string | null;
  validation_result: unknown;
  is_latest: boolean;
  uploaded_at: string;
}

interface Props {
  leadId: string;
  lead?: LeadNameFields | null;
  requirements: DocRequirementInput[];
  onChanged: () => void;
}

const STATUS_BADGE: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; label: string }> = {
  verified: { variant: "default", label: "Verified" },
  uploaded: { variant: "secondary", label: "Uploaded" },
  under_review: { variant: "secondary", label: "Under Review" },
  rejected: { variant: "destructive", label: "Rejected" },
  reupload_needed: { variant: "destructive", label: "Reupload Needed" },
  not_uploaded: { variant: "outline", label: "Not Uploaded" },
  waived: { variant: "outline", label: "Waived" },
  not_applicable: { variant: "outline", label: "N/A" },
};

export function AdminDocumentReviewPanel({ leadId, lead, requirements, onChanged }: Props) {
  const [docsByType, setDocsByType] = useState<Record<string, LeadDocument | null>>({});
  const [versionCountByType, setVersionCountByType] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    supabase
      .from("lead_documents")
      .select("*")
      .eq("lead_id", leadId)
      .then(({ data }) => {
        const latestMap: Record<string, LeadDocument | null> = {};
        const countMap: Record<string, number> = {};
        for (const d of data ?? []) {
          if (!d.document_type_id) continue;
          countMap[d.document_type_id] = (countMap[d.document_type_id] ?? 0) + 1;
          if (d.is_latest) latestMap[d.document_type_id] = d as LeadDocument;
        }
        setDocsByType(latestMap);
        setVersionCountByType(countMap);
        setLoading(false);
      });
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    supabase
      .from("lead_documents")
      .select("*")
      .eq("lead_id", leadId)
      .then(({ data }) => {
        if (!alive) return;
        const latestMap: Record<string, LeadDocument | null> = {};
        const countMap: Record<string, number> = {};
        for (const d of data ?? []) {
          if (!d.document_type_id) continue;
          countMap[d.document_type_id] = (countMap[d.document_type_id] ?? 0) + 1;
          if (d.is_latest) latestMap[d.document_type_id] = d as LeadDocument;
        }
        setDocsByType(latestMap);
        setVersionCountByType(countMap);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [leadId]);

  const handleAfterUpload = () => {
    reload();
    onChanged();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> Document Review
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p className="text-xs text-muted-foreground text-center py-4">Loading documents…</p>
        ) : requirements.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No document requirements for this lead.</p>
        ) : (
          requirements.map((req) => (
            <DocReviewRow
              key={req.id}
              req={req}
              leadId={leadId}
              lead={lead ?? null}
              doc={docsByType[req.document_type_id] ?? null}
              versionCount={versionCountByType[req.document_type_id] ?? 0}
              onChanged={handleAfterUpload}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------

function DocReviewRow({
  req, leadId, lead, doc, versionCount, onChanged,
}: {
  req: DocRequirementInput;
  leadId: string;
  lead: LeadNameFields | null;
  doc: LeadDocument | null;
  versionCount: number;
  onChanged: () => void;
}) {
  const { userId, role } = useRoleAccess();
  const [expanded, setExpanded] = useState(false);
  const [action, setAction] = useState<"verify" | "reject" | "reupload" | null>(null);
  const [remark, setRemark] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const status = doc?.verification_status ?? req.status;
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.not_uploaded;
  const noUpload = !doc;

  const submit = async () => {
    if (!doc || !action) return;
    if ((action === "reject" || action === "reupload") && remark.trim().length < 10) {
      toast.error("Remark must be at least 10 characters");
      return;
    }
    setBusy(true);
    const res = await reviewDocument({
      documentId: doc.id,
      action,
      remark: action === "verify" ? null : remark.trim(),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error("Action failed — nothing was changed", { description: res.error });
      return;
    }
    toast.success(
      action === "verify" ? "Document verified" :
      action === "reject" ? "Document rejected" : "Re-upload requested",
    );
    setAction(null); setRemark(""); setExpanded(false);
    onChanged();
  };

  const openFile = async () => {
    if (!doc?.storage_path) return;
    const { data, error } = await supabase.storage.from("lead-documents").createSignedUrl(doc.storage_path, 300);
    if (error || !data) {
      toast.error("Could not open file");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  // Build the DocRequirement shape expected by DocumentUploadDialog
  const dialogRequirement = {
    ...(req as any),
    document_master: {
      document_name: req.document_master?.document_name ?? "Document",
      document_category: req.document_master?.document_category ?? null,
      document_code: req.document_master?.document_code ?? null,
      applicable_for: req.document_master?.applicable_for ?? null,
    },
  } as DocRequirement;

  return (
    <div className="border rounded-md">
      <button
        type="button"
        className="w-full flex items-center justify-between p-2.5 text-left"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          <span className="text-sm font-medium truncate">
            {req.document_master?.document_name ?? "Document"}
          </span>
          {req.required_flag && <span className="text-[10px] text-muted-foreground">(required)</span>}
        </div>
        <Badge variant={badge.variant} className="text-[10px] shrink-0">{badge.label}</Badge>
      </button>

      {/* Visible row-level nudge — does NOT depend on expansion */}
      {(() => {
        const isActionable = ["not_uploaded", "rejected", "reupload_needed"].includes(status);
        if (!isActionable) return null;
        const docLabel = req.document_master?.document_name ?? "this document";
        const nudgeText =
          status === "rejected"
            ? `Please provide corrected ${docLabel}`
            : status === "reupload_needed"
              ? `Reupload required for ${docLabel}`
              : `Please provide details — upload ${docLabel}`;
        const isReupload = status === "rejected" || status === "reupload_needed";
        const nudgeCls = isReupload
          ? "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/15"
          : "bg-primary/10 text-primary border-primary/30 hover:bg-primary/15";
        return (
          <div className="px-2.5 pb-2.5 -mt-1 flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setUploadOpen(true);
              }}
              data-nudge={status}
              data-doc-req-id={req.id}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${nudgeCls}`}
            >
              {nudgeText}
              <ArrowRight className="h-3 w-3" />
            </button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={(e) => { e.stopPropagation(); setUploadOpen(true); }}
            >
              <Upload className="h-3 w-3 mr-1" /> {isReupload ? "Reupload" : "Upload on Behalf"}
            </Button>
          </div>
        );
      })()}

      {expanded && (
        <div className="border-t p-3 space-y-3 bg-muted/20">
          {noUpload ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">No file uploaded yet</p>
              <p className="text-xs text-muted-foreground">
                Upload on behalf to add the first document. The same validation, OCR and versioning pipeline will run, and the action will be attributed to you in the audit log.
              </p>
              <Button size="sm" variant="default" onClick={() => setUploadOpen(true)}>
                <Upload className="h-3.5 w-3.5 mr-1" /> Upload on Behalf
              </Button>
            </div>
          ) : (
            <>
              <div className="text-xs space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground truncate">{doc.file_name}</span>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={openFile}>
                    <Eye className="h-3 w-3 mr-1" /> View
                  </Button>
                </div>
                <p className="text-muted-foreground">
                  Uploaded {new Date(doc.uploaded_at).toLocaleString()}
                </p>
                {doc.verification_remark && (
                  <p className="text-destructive">Last remark: {doc.verification_remark}</p>
                )}
                {doc.validation_result ? (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-muted-foreground">Validation result</summary>
                    <pre className="text-[10px] bg-background border rounded p-2 mt-1 overflow-auto max-h-40">
                      {JSON.stringify(doc.validation_result, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </div>

              {!action && (
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="default" onClick={() => setAction("verify")}>
                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> Verify
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setAction("reject")}>
                    <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setAction("reupload")}>
                    <Upload className="h-3.5 w-3.5 mr-1" /> Request Reupload
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}>
                    <Upload className="h-3.5 w-3.5 mr-1" /> Upload New Version
                  </Button>
                </div>
              )}

              {action && (
                <div className="space-y-2 border-t pt-3">
                  {action === "verify" ? (
                    <p className="text-xs">Confirm verification of this document?</p>
                  ) : (
                    <div>
                      <Label className="text-xs">
                        Reason <span className="text-destructive">*</span> (min 10 chars)
                      </Label>
                      <Textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={2} />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={submit} disabled={busy}>
                      {busy && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                      Confirm {action === "verify" ? "Verify" : action === "reject" ? "Reject" : "Reupload"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setAction(null); setRemark(""); }} disabled={busy}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {status === "rejected" && (
                <div className="flex items-center gap-1.5 text-[10px] text-destructive">
                  <AlertTriangle className="h-3 w-3" /> Partner can see this rejection.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {uploadOpen && (
        <DocumentUploadDialog
          open={uploadOpen}
          onOpenChange={(o) => !o && setUploadOpen(false)}
          requirement={dialogRequirement}
          leadId={leadId}
          lead={lead}
          applicableFor={req.document_master?.applicable_for ?? null}
          userId={userId}
          userRole={role}
          currentVersionCount={versionCount}
          onUploadComplete={() => {
            setUploadOpen(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
