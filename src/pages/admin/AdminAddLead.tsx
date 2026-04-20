import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Shield, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePartnerContext } from "@/hooks/usePartnerContext";
import { PageHeader } from "@/components/shared/PageHeader";
import AddLead from "@/pages/AddLead";

/**
 * Admin-native wrapper for the lead creation form.
 * - Renders under AdminLayout with admin-styled PageHeader.
 * - Forces admin to select a partner via the AdminPartnerSwitcher before the form is rendered.
 * - Reuses the existing AddLead form/business logic — zero duplication.
 */
export default function AdminAddLead() {
  const { effectivePartnerId, effectivePartnerName } = usePartnerContext();
  const navigate = useNavigate();

  if (!effectivePartnerId) {
    return (
      <div className="space-y-6 max-w-screen-2xl mx-auto">
        <PageHeader
          title="Add Lead — Admin Console"
          description="Create a lead on behalf of a partner organization."
        />
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
    <div className="space-y-4 max-w-screen-2xl mx-auto">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/leads")} className="mt-1">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <PageHeader
            title="Add Lead — Admin Console"
            description={`Creating on behalf of ${effectivePartnerName ?? "selected partner"} · This lead will appear in the partner's pipeline.`}
          />
        </div>
      </div>
      <Alert className="bg-primary/5 border-primary/20 [&>svg]:text-primary">
        <Shield className="h-4 w-4" />
        <AlertDescription className="text-xs">
          <strong>Admin context:</strong> Lead will be attributed to{" "}
          <span className="font-medium text-primary">{effectivePartnerName ?? "selected partner"}</span>.
        </AlertDescription>
      </Alert>
      <AddLead hideOwnHeader />
    </div>
  );
}
