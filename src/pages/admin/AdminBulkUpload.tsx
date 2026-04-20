import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { ShieldAlert, Shield } from "lucide-react";
import { usePartnerContext } from "@/hooks/usePartnerContext";
import BulkUpload from "@/pages/BulkUpload";

/**
 * Admin-native wrapper for bulk lead upload.
 * - Renders under AdminLayout.
 * - Requires admin to select a partner so uploaded leads attribute correctly.
 * - Reuses the existing BulkUpload page — zero logic duplication.
 */
export default function AdminBulkUpload() {
  const { effectivePartnerId, effectivePartnerName } = usePartnerContext();

  if (!effectivePartnerId) {
    return (
      <div className="space-y-6 max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Bulk Upload — Admin</h1>
        </div>
        <Card className="p-8">
          <Alert className="bg-amber-50 border-amber-200 text-amber-900 [&>svg]:text-amber-600">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription className="text-sm leading-relaxed">
              <strong>Select a partner first.</strong> Use the <em>"Test as Partner"</em> picker in the admin sidebar
              to choose which partner organization the uploaded leads will be attributed to.
            </AlertDescription>
          </Alert>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-screen-2xl mx-auto">
      <Alert className="bg-primary/5 border-primary/20 [&>svg]:text-primary">
        <Shield className="h-4 w-4" />
        <AlertDescription className="text-xs">
          <strong>Admin context:</strong> Uploading leads on behalf of{" "}
          <span className="font-medium text-primary">{effectivePartnerName ?? "selected partner"}</span>.
        </AlertDescription>
      </Alert>
      <BulkUpload />
    </div>
  );
}
