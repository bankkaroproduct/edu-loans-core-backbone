import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileCheck, FileX, FileClock, FileUp, FileQuestion, AlertTriangle, CheckCircle, Info } from "lucide-react";
import type { DocRequirement } from "@/pages/LeadDocuments";

interface Props {
  requirements: DocRequirement[];
  /** Hide action-oriented nudge copy (used in admin context). Status badges + counts still render. */
  hideNudge?: boolean;
}

export function DocumentSummaryStrip({ requirements, hideNudge = false }: Props) {
  const counts = {
    total: requirements.length,
    pending: requirements.filter(r => r.status === "not_uploaded").length,
    uploaded: requirements.filter(r => r.status === "uploaded").length,
    underReview: requirements.filter(r => r.status === "under_review").length,
    verified: requirements.filter(r => r.status === "verified").length,
    rejected: requirements.filter(r => r.status === "rejected").length,
    reupload: requirements.filter(r => r.status === "reupload_needed").length,
    waived: requirements.filter(r => ["waived", "not_applicable"].includes(r.status)).length,
  };

  const requiredOnly = requirements.filter(r => r.required_flag && !["waived", "not_applicable"].includes(r.status));
  const requiredVerified = requiredOnly.filter(r => r.status === "verified").length;
  const requiredTotal = requiredOnly.length;
  const completePct = requiredTotal > 0 ? Math.round((requiredVerified / requiredTotal) * 100) : 100;

  const hasBlockers = counts.rejected > 0 || counts.reupload > 0;
  const hasPending = counts.pending > 0;
  const allVerified = requiredTotal > 0 && requiredVerified === requiredTotal;
  const allUploaded = counts.pending === 0 && !hasBlockers;

  // Contextual guidance message
  let guidanceMessage = "";
  let guidanceVariant: "blocker" | "info" | "success" = "info";

  if (allVerified) {
    guidanceMessage = "All required documents are verified. No action needed.";
    guidanceVariant = "success";
  } else if (hasBlockers) {
    const blockerParts: string[] = [];
    if (counts.rejected > 0) blockerParts.push(`${counts.rejected} rejected`);
    if (counts.reupload > 0) blockerParts.push(`${counts.reupload} need reupload`);
    guidanceMessage = `Lead is blocked: ${blockerParts.join(" and ")}. Reupload the highlighted documents before review can continue.`;
    guidanceVariant = "blocker";
  } else if (hasPending) {
    guidanceMessage = `${counts.pending} required document${counts.pending > 1 ? "s are" : " is"} still pending upload. Upload them to move this lead forward.`;
    guidanceVariant = "info";
  } else if (allUploaded) {
    guidanceMessage = "All documents have been uploaded and are under review. No action required right now.";
    guidanceVariant = "success";
  }

  const items = [
    { label: "Total Required", value: counts.total, icon: FileQuestion, color: "text-foreground" },
    { label: "Pending Upload", value: counts.pending, icon: FileUp, color: "text-orange-600", highlight: counts.pending > 0 },
    { label: "Uploaded", value: counts.uploaded, icon: FileClock, color: "text-blue-600" },
    { label: "Under Review", value: counts.underReview, icon: FileClock, color: "text-amber-600" },
    { label: "Verified", value: counts.verified, icon: FileCheck, color: "text-green-600" },
    { label: "Rejected", value: counts.rejected, icon: FileX, color: "text-destructive", highlight: counts.rejected > 0 },
    { label: "Reupload Needed", value: counts.reupload, icon: FileX, color: "text-orange-600", highlight: counts.reupload > 0 },
  ];

  return (
    <Card>
      <CardContent className="pt-4 pb-4 space-y-3">
        {/* Header with progress */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Document Readiness</span>
          <div className="flex items-center gap-2">
            {allVerified && (
              <Badge variant="default" className="bg-green-600 text-xs">
                <CheckCircle className="h-3 w-3 mr-1" /> Complete
              </Badge>
            )}
            {hasBlockers && (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" /> Action Required
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">{completePct}% verified ({requiredVerified}/{requiredTotal})</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-secondary rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all ${allVerified ? "bg-green-600" : hasBlockers ? "bg-destructive" : "bg-primary"}`}
            style={{ width: `${completePct}%` }}
          />
        </div>

        {/* Count cards */}
        <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
          {items.map(item => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className={`text-center p-2 rounded-md border transition-colors ${
                  item.highlight
                    ? "border-destructive/40 bg-destructive/5"
                    : ""
                }`}
              >
                <Icon className={`h-4 w-4 mx-auto mb-0.5 ${item.color}`} />
                <p className="text-base font-bold">{item.value}</p>
                <p className="text-[9px] text-muted-foreground leading-tight">{item.label}</p>
              </div>
            );
          })}
        </div>

        {/* Contextual guidance */}
        {guidanceMessage && (
          <div className={`flex items-start gap-2 rounded-md p-3 text-sm ${
            guidanceVariant === "blocker"
              ? "bg-destructive/10 text-destructive border border-destructive/20"
              : guidanceVariant === "success"
              ? "bg-green-50 text-green-800 border border-green-200 dark:bg-green-950/20 dark:text-green-300 dark:border-green-800"
              : "bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-800"
          }`}>
            {guidanceVariant === "blocker" && <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
            {guidanceVariant === "success" && <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />}
            {guidanceVariant === "info" && <Info className="h-4 w-4 shrink-0 mt-0.5" />}
            <span>{guidanceMessage}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
