import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useState } from "react";
import {
  CheckCircle, Clock, XCircle, AlertTriangle, Upload, Eye,
  FileText, ShieldCheck, Ban, RotateCcw, Info, History, ShieldAlert, HelpCircle, ImageIcon
} from "lucide-react";
import { SampleDocumentModal } from "@/components/documents/SampleDocumentModal";
import { findSampleForDocument, getHelperText, type DocumentSample } from "@/lib/documentSamples";

type ValidationFlag = "ok" | "warn_name" | "warn_type" | "review_needed" | "inconclusive";

import { displayDocName } from "@/lib/docCopy";

function ValidationChip({ result }: { result: any }) {
  if (!result || typeof result !== "object") return null;
  const flag: ValidationFlag = result.overall_flag ?? "ok";
  const extracted = result.name_check?.extracted_name_candidate;
  const expected = result.name_check?.expected_name;
  const matched = result.name_check?.matched_name_tokens ?? [];
  const overridden = !!result.override;
  const expectedCode: string | null = result.type_check?.expected_code ?? null;
  const friendlyDoc = displayDocName(expectedCode, "document");

  const config: Record<ValidationFlag, { label: string; icon: typeof CheckCircle; cls: string; tip: string }> = {
    ok: {
      label: "Authenticated",
      icon: ShieldCheck,
      cls: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800",
      tip: "File contents match the expected document type and applicant name.",
    },
    warn_name: {
      label: "Name may not match",
      icon: AlertTriangle,
      cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
      tip: extracted && expected
        ? `Document shows "${extracted}" but application expects "${expected}". Matched ${matched.length} token(s). If correct, no action needed.`
        : `We couldn't confidently match the name on this ${friendlyDoc} to the application. If correct, no action needed.`,
    },
    warn_type: {
      label: `Type unconfirmed`,
      icon: AlertTriangle,
      cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
      tip: `We couldn't fully confirm this is a ${friendlyDoc}. If correct, no action needed.`,
    },
    review_needed: {
      label: overridden ? "Flagged for review" : `May not be a valid ${friendlyDoc}`,
      icon: ShieldAlert,
      cls: "bg-destructive/10 text-destructive border-destructive/30",
      tip: overridden
        ? "User confirmed upload despite a possible mismatch. Admin will review."
        : `This file doesn't show the markers we expect for a ${friendlyDoc}. Please review or upload a clearer copy.`,
    },
    inconclusive: {
      label: "Validation pending",
      icon: HelpCircle,
      cls: "bg-muted text-muted-foreground border-border",
      tip: result.extraction?.method === "skipped_image_phase1"
        ? "Image uploads will be auto-validated in a future update. The file is stored and visible to reviewers."
        : "We could not extract text from this file (e.g. scanned PDF). It is stored and will be reviewed manually.",
    },
  };

  const c = config[flag];
  const Icon = c.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium cursor-help ${c.cls}`}>
          <Icon className="h-3 w-3" /> {c.label}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{c.tip}</TooltipContent>
    </Tooltip>
  );
}
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMemo } from "react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  groupRequirementsBySection,
  computeSectionStatus,
  shouldDefaultOpen,
  SECTION_STATUS_LABEL,
  SECTION_STATUS_VARIANT,
} from "@/lib/documentSections";
import type { LeadDocFile } from "@/hooks/useLeadDocumentsData";
import type { DocRequirement, DocFile } from "@/pages/LeadDocuments";

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; bgClass: string; label: string; priority: number }> = {
  rejected:        { icon: XCircle,        color: "text-destructive",        bgClass: "bg-destructive/5 border-destructive/30 ring-1 ring-destructive/20", label: "Rejected", priority: 1 },
  reupload_needed: { icon: AlertTriangle,  color: "text-orange-600",         bgClass: "bg-orange-50 border-orange-300 ring-1 ring-orange-200 dark:bg-orange-950/20 dark:border-orange-800", label: "Reupload Needed", priority: 2 },
  not_uploaded:    { icon: Upload,         color: "text-muted-foreground",   bgClass: "border-dashed", label: "Pending Upload", priority: 3 },
  uploaded:        { icon: Clock,          color: "text-blue-600",           bgClass: "", label: "Uploaded", priority: 4 },
  under_review:    { icon: Clock,          color: "text-amber-600",          bgClass: "", label: "Under Review", priority: 5 },
  verified:        { icon: CheckCircle,    color: "text-green-600",          bgClass: "", label: "Verified", priority: 6 },
  waived:          { icon: ShieldCheck,    color: "text-muted-foreground",   bgClass: "opacity-60", label: "Waived", priority: 7 },
  not_applicable:  { icon: Ban,            color: "text-muted-foreground",   bgClass: "opacity-60", label: "N/A", priority: 8 },
};

interface Props {
  requirements: DocRequirement[];
  documents: DocFile[];
  onUpload: (req: DocRequirement) => void;
  leadId: string;
  /** When true, suppresses the extra yellow guidance/nudge bar — admin already has direct upload + OCR. */
  hideNudge?: boolean;
  /** Lead's highest_qualification — used to hide non-applicable academic docs. */
  highestQualification?: string | null;
}

export function DocumentChecklist({ requirements, documents, onUpload, leadId, hideNudge = false, highestQualification }: Props) {
  const [sampleOpen, setSampleOpen] = useState<DocumentSample | null>(null);
  // Group documents by document_type_id
  const docsByType = new Map<string, DocFile[]>();
  documents.forEach(doc => {
    if (doc.document_type_id) {
      const existing = docsByType.get(doc.document_type_id) ?? [];
      existing.push(doc);
      docsByType.set(doc.document_type_id, existing);
    }
  });

  // Group requirements into the 7 spec sections (frontend-only grouping by document_code).
  const grouped = useMemo(() => groupRequirementsBySection(requirements), [requirements]);

  const latestByType = useMemo(() => {
    const m = new Map<string, LeadDocFile | null | undefined>();
    for (const [k, arr] of docsByType) {
      const latest = arr.find((d) => d.is_latest) ?? arr[0] ?? null;
      m.set(k, latest as unknown as LeadDocFile | null);
    }
    return m;
  }, [docsByType]);

  const defaultOpen = useMemo(
    () =>
      grouped
        .filter(({ rows }) => shouldDefaultOpen(computeSectionStatus(rows, latestByType).status))
        .map(({ section }) => section.id),
    [grouped, latestByType],
  );

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

  const renderRow = (req: DocRequirement) => {
    const cfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.not_uploaded;
    const Icon = cfg.icon;
    const relatedDocs = docsByType.get(req.document_type_id) ?? [];
    const latestDoc = relatedDocs.find(d => d.is_latest) ?? relatedDocs[0];
    const versionCount = relatedDocs.length;
    const isActionable = ["not_uploaded", "rejected", "reupload_needed"].includes(req.status);
    const isReupload = ["rejected", "reupload_needed"].includes(req.status);
    const isBlocker = isReupload;

    return (
            <div
              key={req.id}
              className={`rounded-lg border p-3.5 transition-colors ${cfg.bgClass}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${cfg.color}`} />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {/* Document name + badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-medium ${isBlocker ? "text-destructive" : ""}`}>
                        {(req.document_master as { display_name?: string | null } | null | undefined)?.display_name ?? req.document_master?.document_name ?? "Document"}
                      </p>
                      {req.document_master?.document_category && (
                        <Badge variant="outline" className="text-[9px]">{req.document_master.document_category}</Badge>
                      )}
                      {req.required_flag ? (
                        <Badge variant="secondary" className="text-[9px]">Required</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] text-muted-foreground">Optional</Badge>
                      )}
                    </div>

                    {/* Helper text + View Sample (guidance only — no logic) */}
                    {(() => {
                      const displayName = (req.document_master as { display_name?: string | null } | null | undefined)?.display_name ?? null;
                      const docName = req.document_master?.document_name ?? null;
                      const helper = getHelperText(displayName, docName);
                      const sample = findSampleForDocument(displayName, docName);
                      if (!helper && !sample) return null;
                      return (
                        <div className="flex items-start gap-1.5 flex-wrap text-xs text-muted-foreground">
                          {helper && <span className="leading-snug">{helper}</span>}
                          {sample && (
                            <button
                              type="button"
                              onClick={() => setSampleOpen(sample)}
                              className="inline-flex items-center gap-1 text-primary hover:underline shrink-0"
                            >
                              <ImageIcon className="h-3 w-3" /> View Sample
                            </button>
                          )}
                        </div>
                      );
                    })()}

                    {/* Validation chip */}
                    {latestDoc?.validation_result && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <ValidationChip result={latestDoc.validation_result} />
                      </div>
                    )}

                    {/* Latest file info */}
                    {latestDoc && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <span className="truncate max-w-[200px]">{latestDoc.file_name}</span>
                        <span className="text-muted-foreground/50">·</span>
                        <span>v{latestDoc.version_number}</span>
                        <span className="text-muted-foreground/50">·</span>
                        <span>{new Date(latestDoc.uploaded_at).toLocaleDateString()}</span>
                        {versionCount > 1 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-0.5 text-primary cursor-help">
                                <History className="h-3 w-3" /> {versionCount} versions
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {versionCount} versions uploaded. Latest is v{latestDoc.version_number}.
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    )}

                    {/* No upload yet indicator */}
                    {!latestDoc && req.status === "not_uploaded" && (
                      <p className="text-xs text-muted-foreground italic">No file uploaded yet</p>
                    )}

                    {/* Partner-visible remarks — PROMINENT for rejections */}
                    {req.remarks && (
                      <div className={`flex items-start gap-1.5 text-xs rounded-md p-2 ${
                        isReupload
                          ? "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border border-orange-200 dark:border-orange-800"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <div>
                          {isReupload && <span className="font-semibold block mb-0.5">Reason: </span>}
                          <span>{req.remarks}</span>
                        </div>
                      </div>
                    )}

                    {/* No remark but rejected */}
                    {isReupload && !req.remarks && (
                      <div className="flex items-start gap-1.5 text-xs rounded-md p-2 bg-muted text-muted-foreground">
                        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>No specific remark available. Please upload a corrected version.</span>
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
                    variant={req.status === "verified" ? "default" : isBlocker ? "destructive" : "outline"}
                    className={`text-[10px] whitespace-nowrap ${
                      req.status === "verified" ? "bg-green-600" : ""
                    }`}
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
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> Document Checklist
          <span className="text-xs font-normal text-muted-foreground ml-auto">
            {requirements.length} document{requirements.length !== 1 ? "s" : ""}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Accordion type="multiple" defaultValue={defaultOpen} className="w-full">
          {grouped.map(({ section, rows }) => {
            const info = computeSectionStatus(rows, latestByType);
            const statusLabel = SECTION_STATUS_LABEL[info.status];
            const statusVariant = SECTION_STATUS_VARIANT[info.status];
            return (
              <AccordionItem key={section.id} value={section.id} className="border rounded-md mb-2">
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
                  {rows.map((req) => renderRow(req))}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
      <SampleDocumentModal
        open={!!sampleOpen}
        onOpenChange={(o) => { if (!o) setSampleOpen(null); }}
        sample={sampleOpen}
      />
    </Card>
  );
}
