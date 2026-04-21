import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, ArrowLeft, Building2, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePartnerContext } from "@/hooks/usePartnerContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import BulkUpload from "@/pages/BulkUpload";

/**
 * Admin-native wrapper for bulk lead upload.
 * - Renders under AdminLayout with admin-styled PageHeader.
 * - Shows a compact Partner Attribution status card (mirrors AdminAddLead pattern for visual consistency).
 * - Reuses the existing BulkUpload page — zero logic duplication.
 */
export default function AdminBulkUpload() {
  const { effectivePartnerId, effectivePartnerName } = usePartnerContext();
  const navigate = useNavigate();
  const noPartner = !effectivePartnerId;

  return (
    <div className="space-y-4 max-w-screen-2xl mx-auto">
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

      {/* Partner Attribution status card — mirrors AdminAddLead visual rhythm */}
      <Card className="p-4 sm:p-5 space-y-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="rounded-md bg-primary/10 p-2 shrink-0">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div className="space-y-0.5 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-semibold leading-tight">Partner Attribution</h2>
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                Required
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Every uploaded row will be attributed to the partner currently selected in the admin sidebar.
            </p>
          </div>
        </div>

        {noPartner ? (
          <div className="flex items-center gap-2 text-xs bg-muted/50 border border-border rounded-md px-2.5 py-1.5 text-muted-foreground">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
            <span>
              No partner selected. Use the <span className="font-medium text-foreground">Test as Partner</span> picker in the sidebar to choose one.
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 border border-primary/20 rounded-md px-2.5 py-1.5">
            <Check className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              Uploading on behalf of <span className="font-medium">{effectivePartnerName ?? "selected partner"}</span>.
            </span>
          </div>
        )}
      </Card>

      {!noPartner && <BulkUpload hideOwnHeader />}
    </div>
  );
}
