import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { ShieldAlert, Shield } from "lucide-react";
import { usePartnerContext } from "@/hooks/usePartnerContext";
import AddLead from "@/pages/AddLead";

/**
 * Admin-native wrapper for the lead creation form.
 * - Renders under AdminLayout (no partner sidebar).
 * - Forces admin to select a partner via the AdminPartnerSwitcher (in admin sidebar)
 *   before the form is rendered, so the lead is correctly attributed.
 * - Reuses the existing AddLead form/business logic — zero duplication.
 */
export default function AdminAddLead() {
  const { effectivePartnerId, effectivePartnerName, isSimulating } = usePartnerContext();

  if (!effectivePartnerId) {
    return (
      <div className="space-y-6 max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Add Lead — Admin</h1>
        </div>
        <Card className="p-8">
          <Alert className="bg-amber-50 border-amber-200 text-amber-900 [&>svg]:text-amber-600">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription className="text-sm leading-relaxed">
              <strong>Select a partner first.</strong> Use the <em>"Test as Partner"</em> picker in the admin sidebar
              to choose which partner organization this new lead will be attributed to. Admins cannot create unattributed leads.
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
          <strong>Admin context:</strong> Creating lead on behalf of{" "}
          <span className="font-medium text-primary">{effectivePartnerName ?? "selected partner"}</span>. The lead will be attributed to this partner organization.
        </AlertDescription>
      </Alert>
      {/* Reuse the partner-portal lead form — already admin-aware via useRoleAccess */}
      <AddLead />
    </div>
  );
}
