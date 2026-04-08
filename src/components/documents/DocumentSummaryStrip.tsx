import { Card, CardContent } from "@/components/ui/card";
import { FileCheck, FileX, FileClock, FileUp, FileQuestion, ShieldCheck, Ban } from "lucide-react";
import type { DocRequirement } from "@/pages/LeadDocuments";

interface Props {
  requirements: DocRequirement[];
}

export function DocumentSummaryStrip({ requirements }: Props) {
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

  const activeRequired = counts.total - counts.waived;
  const completePct = activeRequired > 0
    ? Math.round((counts.verified / activeRequired) * 100)
    : 0;

  const hasBlockers = counts.rejected > 0 || counts.reupload > 0;

  const items = [
    { label: "Total Required", value: counts.total, icon: FileQuestion, color: "text-foreground" },
    { label: "Pending Upload", value: counts.pending, icon: FileUp, color: "text-orange-600" },
    { label: "Uploaded", value: counts.uploaded, icon: FileClock, color: "text-blue-600" },
    { label: "Under Review", value: counts.underReview, icon: FileClock, color: "text-amber-600" },
    { label: "Verified", value: counts.verified, icon: FileCheck, color: "text-green-600" },
    { label: "Rejected", value: counts.rejected, icon: FileX, color: "text-destructive" },
    { label: "Reupload Needed", value: counts.reupload, icon: FileX, color: "text-orange-600" },
  ];

  return (
    <Card>
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Document Readiness</span>
          <div className="flex items-center gap-2">
            {hasBlockers && (
              <span className="text-xs font-medium text-destructive">⚠ Action Required</span>
            )}
            <span className="text-xs text-muted-foreground">{completePct}% verified</span>
          </div>
        </div>
        <div className="w-full bg-secondary rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{ width: `${completePct}%` }}
          />
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
          {items.map(item => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="text-center p-1.5 rounded-md border">
                <Icon className={`h-4 w-4 mx-auto mb-0.5 ${item.color}`} />
                <p className="text-base font-bold">{item.value}</p>
                <p className="text-[9px] text-muted-foreground leading-tight">{item.label}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
