import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Shown to partner-role users whose organization status is anything other
 * than 'active'. Used as a soft gate on new-lead submission surfaces
 * (Add Lead, Quick Lead, Bulk Upload). Existing leads remain accessible
 * elsewhere in the portal — this component does NOT block reads.
 *
 * Copy is fixed and intentional; do not vary per surface.
 */
export function PartnerInactiveNotice({ surface }: { surface: "add_lead" | "quick_lead" | "bulk_upload" }) {
  const surfaceLabel: Record<typeof surface, string> = {
    add_lead: "Add Lead",
    quick_lead: "Quick Lead",
    bulk_upload: "Bulk Upload",
  } as const;

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10">
        <CardContent className="flex gap-3 p-5">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="space-y-2 text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              New lead submission is paused for your account.
            </p>
            <p className="text-amber-800/90 dark:text-amber-200/90 leading-relaxed">
              Your partner organization is currently marked inactive, so {surfaceLabel[surface]} is
              temporarily unavailable. Existing leads remain fully accessible — viewing, document uploads,
              and ongoing application workflows continue as normal.
            </p>
            <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
              Please contact your EduLoans relationship manager to restore new-lead access.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
