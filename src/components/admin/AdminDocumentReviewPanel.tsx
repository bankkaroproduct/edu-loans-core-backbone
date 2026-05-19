import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  FileText, CheckCircle, XCircle, AlertTriangle, Upload, Eye, Loader2, ChevronDown, ChevronRight, ArrowRight, ImageIcon, HelpCircle,
} from "lucide-react";
import { SampleDocumentModal } from "@/components/documents/SampleDocumentModal";
import { DocumentGuidanceModal } from "@/components/documents/DocumentGuidanceModal";
import { findSampleForDocument, getHelperText, type DocumentSample } from "@/lib/documentSamples";
import { findGuidanceForDocument, type DocumentGuidance } from "@/lib/documentGuidance";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { reviewDocument } from "@/lib/adminActions";
import { DocumentUploadDialog } from "@/components/documents/DocumentUploadDialog";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import {
  STATUS_BADGE_VARIANT,
  STATUS_LABEL,
  type EffectiveDocStatus,
} from "@/lib/leadDocumentViewModel";
import {
  groupRequirementsBySection,
  computeSectionStatus,
  shouldDefaultOpen,
  SECTION_STATUS_LABEL,
  SECTION_STATUS_VARIANT,
} from "@/lib/documentSections";
import { partitionRequirementsByApplicability } from "@/lib/documentApplicability";
import type { DocRequirement } from "@/pages/LeadDocuments";
import type { LeadNameFields } from "@/lib/referenceName";
import type { LeadDocFile, LeadDocRequirement } from "@/hooks/useLeadDocumentsData";

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
    display_name?: string | null;
    sort_order?: number | null;
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
  /** Optional: pre-loaded documents from the shared useLeadDocumentsData hook. When provided,
   *  the panel will NOT do its own fetch — guaranteeing the embedded review panel and the
   *  full Documents page render from the exact same in-memory snapshot. */
  documents?: LeadDocument[];
  onChanged: () => void;
  /** Lead's highest_qualification — drives smart academic-doc applicability. */
  highestQualification?: string | null;
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

export function AdminDocumentReviewPanel({ leadId, lead, requirements, documents, onChanged, highestQualification }: Props) {
  const [docsByType, setDocsByType] = useState<Record<string, LeadDocument | null>>({});
  const [versionCountByType, setVersionCountByType] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(documents === undefined);

  // Derive maps from either the supplied documents prop (shared hook) or a local fetch fallback.
  const buildMaps = (data: LeadDocument[] | null | undefined) => {
    const latestMap: Record<string, LeadDocument | null> = {};
    const countMap: Record<string, number> = {};
    for (const d of data ?? []) {
      if (!d.document_type_id) continue;
      countMap[d.document_type_id] = (countMap[d.document_type_id] ?? 0) + 1;
      if (d.is_latest) latestMap[d.document_type_id] = d;
    }
    return { latestMap, countMap };
  };

  const reload = () => {
    if (documents !== undefined) {
      // Owned by parent — just ask the parent to refresh; we'll re-derive when the prop changes.
      onChanged();
      return;
    }
    setLoading(true);
    supabase
      .from("lead_documents")
      .select("*")
      .eq("lead_id", leadId)
      .then(({ data }) => {
        const { latestMap, countMap } = buildMaps(data as LeadDocument[] | null);
        setDocsByType(latestMap);
        setVersionCountByType(countMap);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (documents !== undefined) {
      const { latestMap, countMap } = buildMaps(documents);
      setDocsByType(latestMap);
      setVersionCountByType(countMap);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    supabase
      .from("lead_documents")
      .select("*")
      .eq("lead_id", leadId)
      .then(({ data }) => {
        if (!alive) return;
        const { latestMap, countMap } = buildMaps(data as LeadDocument[] | null);
        setDocsByType(latestMap);
        setVersionCountByType(countMap);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [leadId, documents]);

  const handleAfterUpload = () => {
    reload();
    onChanged();
  };

  // Smart academic applicability — non-applicable academic docs are split out
  // so they don't count toward readiness denominators but remain viewable.
  const { applicable: applicableRequirements, notApplicable: naRequirements } = useMemo(
    () => partitionRequirementsByApplicability(
      requirements as unknown as LeadDocRequirement[],
      highestQualification,
    ),
    [requirements, highestQualification],
  );

  // Group requirements into the 7 spec sections (frontend-only grouping by document_code).
  const grouped = useMemo(
    () => groupRequirementsBySection(applicableRequirements),
    [applicableRequirements],
  );

  const latestByType = useMemo(() => {
    const m = new Map<string, LeadDocFile | null | undefined>();
    for (const [k, v] of Object.entries(docsByType)) m.set(k, v as unknown as LeadDocFile | null);
    return m;
  }, [docsByType]);

  const defaultOpen = useMemo(() => {
    return grouped
      .filter(({ rows }) => shouldDefaultOpen(computeSectionStatus(rows, latestByType).status))
      .map(({ section }) => section.id);
  }, [grouped, latestByType]);

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
          <Accordion type="multiple" defaultValue={defaultOpen} className="w-full">
            {grouped.map(({ section, rows }) => {
              const info = computeSectionStatus(rows, latestByType);
              const statusLabel = SECTION_STATUS_LABEL[info.status];
              const statusVariant = SECTION_STATUS_VARIANT[info.status];
              return (
                <AccordionItem key={section.id} value={section.id} className="border rounded-md mb-2 border-b">
                  <AccordionTrigger className="px-3 py-2.5 hover:no-underline">
                    <div className="flex items-center justify-between gap-3 flex-1 min-w-0">
                      <div className="min-w-0 text-left">
                        <p className="text-sm font-semibold truncate">{section.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{section.purpose}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {info.isOptionalOnly ? (
                          <span className="text-[11px] text-muted-foreground">Optional</span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            {info.requiredVerified} of {info.requiredTotal} required completed
                          </span>
                        )}
                        <Badge variant={statusVariant} className={`text-[10px] ${info.status === "complete" ? "bg-green-600" : ""}`}>
                          {statusLabel}
                        </Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-3 space-y-2">
                    {rows.map((req) => (
                      <DocReviewRow
                        key={req.id}
                        req={req as unknown as DocRequirementInput}
                        leadId={leadId}
                        lead={lead ?? null}
                        doc={docsByType[req.document_type_id] ?? null}
                        versionCount={versionCountByType[req.document_type_id] ?? 0}
                        onChanged={handleAfterUpload}
                      />
                    ))}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}

        {/* Collapsed "Not Applicable" section — operational visibility for admin.
            Excluded from readiness counts; uploaded files (if any) remain viewable. */}
        {!loading && naRequirements.length > 0 && (
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="not-applicable" className="border rounded-md mb-2 border-dashed">
              <AccordionTrigger className="px-3 py-2.5 hover:no-underline">
                <div className="flex items-center justify-between gap-3 flex-1 min-w-0">
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-semibold truncate text-muted-foreground">
                      Not Applicable based on highest qualification
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      Hidden from readiness — uploaded files (if any) remain viewable.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {naRequirements.length} hidden
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3 space-y-2">
                {naRequirements.map((req) => (
                  <DocReviewRow
                    key={req.id}
                    req={req as unknown as DocRequirementInput}
                    leadId={leadId}
                    lead={lead ?? null}
                    doc={docsByType[req.document_type_id] ?? null}
                    versionCount={versionCountByType[req.document_type_id] ?? 0}
                    onChanged={handleAfterUpload}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
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
  const [sampleOpen, setSampleOpen] = useState(false);
  const [guidanceOpen, setGuidanceOpen] = useState(false);

  const displayName = req.document_master?.display_name ?? null;
  const docName = req.document_master?.document_name ?? null;
  const helperText = getHelperText(displayName, docName);
  const sample: DocumentSample | null = findSampleForDocument(displayName, docName);
  const guidance: DocumentGuidance | null = findGuidanceForDocument(displayName, docName);

  const status = (doc?.verification_status ?? req.status) as EffectiveDocStatus;
  const badgeVariant = STATUS_BADGE_VARIANT[status] ?? STATUS_BADGE_VARIANT.not_uploaded;
  const badgeLabel = STATUS_LABEL[status] ?? STATUS_LABEL.not_uploaded;
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
      display_name: req.document_master?.display_name ?? null,
      sort_order: req.document_master?.sort_order ?? null,
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
            {req.document_master?.display_name ?? req.document_master?.document_name ?? "Document"}
          </span>
          {req.required_flag && <span className="text-[10px] text-muted-foreground">(required)</span>}
        </div>
        <Badge variant={badgeVariant} className="text-[10px] shrink-0">{badgeLabel}</Badge>
      </button>

      {(helperText || sample) && (
        <div className="px-2.5 pb-2 -mt-1 flex items-start gap-1.5 flex-wrap text-xs text-muted-foreground">
          {helperText && <span className="leading-snug">{helperText}</span>}
          {sample && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setSampleOpen(true); }}
              className="inline-flex items-center gap-1 text-primary hover:underline shrink-0"
            >
              <ImageIcon className="h-3 w-3" /> View Sample
            </button>
          )}
        </div>
      )}

      {/* Row-level upload action — nudge text removed in admin per spec; OCR / upload pipeline preserved */}
      {(() => {
        const isActionable = ["not_uploaded", "rejected", "reupload_needed"].includes(status);
        if (!isActionable) return null;
        const isReupload = status === "rejected" || status === "reupload_needed";
        return (
          <div className="px-2.5 pb-2.5 -mt-1 flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant={isReupload ? "destructive" : "outline"}
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

      <SampleDocumentModal
        open={sampleOpen}
        onOpenChange={setSampleOpen}
        sample={sample}
      />
    </div>
  );
}
