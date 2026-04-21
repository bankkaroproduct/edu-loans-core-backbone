import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ShieldAlert, ArrowLeft, Building2, Check, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePartnerContext } from "@/hooks/usePartnerContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import BulkUpload from "@/pages/BulkUpload";

/**
 * Admin-native wrapper for bulk lead upload.
 * - Compact Partner Attribution strip mirroring AdminAddLead.
 * - Reuses the existing BulkUpload page — zero logic duplication.
 */
export default function AdminBulkUpload() {
  const { effectivePartnerId, effectivePartnerName } = usePartnerContext();
  const navigate = useNavigate();
  const noPartner = !effectivePartnerId;

  return (
    <div className="space-y-5 max-w-screen-2xl mx-auto">
      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/admin/leads")}
          className="mt-1"
          aria-label="Back to leads"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <PageHeader
            title="Bulk Upload — Admin Console"
            description="Bulk-import leads on behalf of a partner organization."
          />
        </div>
      </div>

      {/* Compact Partner Attribution strip */}
      <div className="flex items-center gap-3 flex-wrap rounded-md border bg-card px-3 py-2.5">
        <div className="flex items-center gap-2 shrink-0">
          <Building2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Partner</span>
          <Badge variant="secondary" className="text-[10px] uppercase tracking-wide h-5">
            Required
          </Badge>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {noPartner ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldAlert className="h-3.5 w-3.5" />
              No partner selected. Use <span className="font-medium text-foreground">Test as Partner</span> in the sidebar.
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-primary">
              <Check className="h-3.5 w-3.5" /> Uploading on behalf of {effectivePartnerName ?? "selected partner"}
            </span>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Why is partner required?"
                className="text-muted-foreground/60 hover:text-muted-foreground"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs text-xs">
              Every uploaded row must be attributed to a partner. Admin-owned leads require a future schema change.
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {!noPartner && <BulkUpload hideOwnHeader />}
    </div>
  );
}
