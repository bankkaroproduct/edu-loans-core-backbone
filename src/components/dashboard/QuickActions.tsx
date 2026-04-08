import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Upload, FileText, CreditCard, FileSearch, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    { label: "Add Quick Lead", icon: Plus, action: () => navigate("/leads/new?mode=quick") },
    { label: "Add New Lead", icon: Plus, action: () => navigate("/leads/new") },
    { label: "Bulk Upload Leads", icon: Upload, action: () => navigate("/bulk-upload") },
    { label: "View Submitted Leads", icon: FileText, action: () => navigate("/leads") },
    { label: "Download Bulk Template", icon: Download, action: () => {} },
    { label: "View Payout Summary", icon: CreditCard, action: () => navigate("/payouts") },
    { label: "View Pending Documents", icon: FileSearch, action: () => navigate("/leads?stage=documents_pending") },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <Button key={a.label} variant="outline" size="sm" onClick={a.action}>
                <Icon className="mr-1 h-3.5 w-3.5" /> {a.label}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
