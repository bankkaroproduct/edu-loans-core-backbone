import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle,
  FileClock,
  FileQuestion,
  FileText,
  FileUp,
  Info,
} from "lucide-react";
import { AdminDocumentReviewPanel } from "@/components/admin/AdminDocumentReviewPanel";
import { buildAdminDocViewModel } from "@/lib/leadDocumentViewModel";
import { partitionRequirementsByApplicability } from "@/lib/documentApplicability";
import type {
  LeadDocFile,
  LeadDocRequirement,
  LeadDocRow,
} from "@/hooks/useLeadDocumentsData";

interface Props {
  leadId: string;
  lead: LeadDocRow | null;
  requirements: LeadDocRequirement[];
  documents: LeadDocFile[];
  onChanged: () => void;
}

/**
 * The shared admin "documents body" used in TWO places:
 *  - Embedded inside Admin Lead Detail
 *  - Inside the full /admin/leads/:id/documents page
 *
 * Both surfaces render through this component so requirement counts, status
 * meaning, upload/reupload affordances, terminology and empty-state behavior
 * are identical for the same lead.
 *
 * Upload/OCR/validation/review/versioning/audit logic is unchanged — those
 * paths remain in DocumentUploadDialog and reviewDocument().
 */
export function AdminLeadDocumentsView({
  leadId,
  lead,
  requirements,
  documents,
  onChanged,
}: Props) {
  const vm = useMemo(
    () => buildAdminDocViewModel(requirements, documents),
    [requirements, documents],
  );

  const { counts, hasRequirements } = vm;

  const hasBlockers = counts.rejected > 0 || counts.reupload_needed > 0;
  const allRequiredVerified =
    counts.requiredTotal > 0 && counts.requiredVerified === counts.requiredTotal;
  const completePct =
    counts.requiredTotal > 0
      ? Math.round((counts.requiredVerified / counts.requiredTotal) * 100)
      : 0;

  // Same wording on both surfaces
  let guidanceMessage = "";
  let guidanceVariant: "blocker" | "info" | "success" = "info";
  if (!hasRequirements) {
    guidanceMessage = "No document requirements have been added for this lead yet.";
    guidanceVariant = "info";
  } else if (allRequiredVerified) {
    guidanceMessage = "All required documents are verified. No action needed.";
    guidanceVariant = "success";
  } else if (hasBlockers) {
    const parts: string[] = [];
    if (counts.rejected > 0) parts.push(`${counts.rejected} rejected`);
    if (counts.reupload_needed > 0)
      parts.push(`${counts.reupload_needed} need reupload`);
    guidanceMessage = `Lead is blocked: ${parts.join(" and ")}. Reupload the highlighted documents before review can continue.`;
    guidanceVariant = "blocker";
  } else if (counts.not_uploaded > 0) {
    guidanceMessage = `${counts.not_uploaded} required document${counts.not_uploaded > 1 ? "s are" : " is"} still pending upload.`;
    guidanceVariant = "info";
  } else {
    guidanceMessage = "All documents have been uploaded and are under review.";
    guidanceVariant = "success";
  }

  const tiles = [
    { label: "Total Required", value: counts.total, icon: FileQuestion, color: "text-foreground" },
    { label: "Pending Upload", value: counts.not_uploaded, icon: FileUp, color: "text-orange-600", highlight: counts.not_uploaded > 0 },
    { label: "Uploaded", value: counts.uploaded, icon: FileClock, color: "text-blue-600" },
    {
      label: "Under Review",
      value: counts.under_review + counts.rejected + counts.reupload_needed,
      icon: FileClock,
      color: "text-amber-600",
      highlight: counts.rejected > 0 || counts.reupload_needed > 0,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Shared readiness summary — derived from the SAME view-model used by the rows below. */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Document Readiness</span>
            <div className="flex items-center gap-2">
              {allRequiredVerified && (
                <Badge variant="default" className="bg-green-600 text-xs">
                  <CheckCircle className="h-3 w-3 mr-1" /> Complete
                </Badge>
              )}
              {hasBlockers && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Action Required
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {!hasRequirements
                  ? "No required documents configured"
                  : `${completePct}% verified (${counts.requiredVerified}/${counts.requiredTotal})`}
              </span>
            </div>
          </div>

          <div className="w-full bg-secondary rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all ${
                allRequiredVerified
                  ? "bg-green-600"
                  : hasBlockers
                  ? "bg-destructive"
                  : "bg-primary"
              }`}
              style={{ width: `${completePct}%` }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {tiles.map((tile) => {
              const Icon = tile.icon;
              return (
                <div
                  key={tile.label}
                  className={`text-center p-2 rounded-md border transition-colors ${
                    tile.highlight ? "border-destructive/40 bg-destructive/5" : ""
                  }`}
                >
                  <Icon className={`h-4 w-4 mx-auto mb-0.5 ${tile.color}`} />
                  <p className="text-base font-bold">{tile.value}</p>
                  <p className="text-[9px] text-muted-foreground leading-tight">{tile.label}</p>
                </div>
              );
            })}
          </div>

          {guidanceMessage && guidanceVariant !== "blocker" && (
            <div
              className={`flex items-start gap-2 rounded-md p-3 text-sm ${
                guidanceVariant === "success"
                  ? "bg-green-50 text-green-800 border border-green-200 dark:bg-green-950/20 dark:text-green-300 dark:border-green-800"
                  : "bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-800"
              }`}
            >
              {guidanceVariant === "success" && <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />}
              {guidanceVariant === "info" && <Info className="h-4 w-4 shrink-0 mt-0.5" />}
              <span>{guidanceMessage}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Body — shared empty state OR the same review panel used embedded in lead detail */}
      {!hasRequirements ? (
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <FileText className="h-8 w-8 mx-auto text-muted-foreground" />
            <h3 className="font-medium text-foreground">No Document Requirements</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              No document requirements have been added for this lead yet. Use “Add Document” to create the first requirement, then upload on behalf of the lead.
            </p>
          </CardContent>
        </Card>
      ) : (
        <AdminDocumentReviewPanel
          leadId={leadId}
          lead={lead}
          requirements={requirements as never[]}
          documents={documents as never[]}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}
