import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  FileText, CheckCircle, XCircle, AlertTriangle, Upload, Eye, Loader2, ChevronDown, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { reviewDocument } from "@/lib/adminActions";

interface DocRequirement {
  id: string;
  document_type_id: string;
  status: string;
  required_flag: boolean;
  remarks: string | null;
  document_master?: { document_name: string; document_category: string | null } | null;
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
  requirements: DocRequirement[];
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

export function AdminDocumentReviewPanel({ leadId, requirements, onChanged }: Props) {
  const [docsByType, setDocsByType] = useState<Record<string, LeadDocument | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    supabase
      .from("lead_documents")
      .select("*")
      .eq("lead_id", leadId)
      .eq("is_latest", true)
      .then(({ data }) => {
        if (!alive) return;
        const map: Record<string, LeadDocument | null> = {};
        for (const d of data ?? []) {
          if (d.document_type_id) map[d.document_type_id] = d as LeadDocument;
        }
        setDocsByType(map);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [leadId]);

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
              doc={docsByType[req.document_type_id] ?? null}
              onChanged={onChanged}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------

function DocReviewRow({
  req, doc, onChanged,
}: {
  req: DocRequirement;
  doc: LeadDocument | null;
  onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [action, setAction] = useState<"verify" | "reject" | "reupload" | null>(null);
  const [remark, setRemark] = useState("");
  const [busy, setBusy] = useState(false);

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

      {expanded && (
        <div className="border-t p-3 space-y-3 bg-muted/20">
          {noUpload ? (
            <p className="text-xs text-muted-foreground">No file uploaded yet — admin actions disabled.</p>
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
    </div>
  );
}
