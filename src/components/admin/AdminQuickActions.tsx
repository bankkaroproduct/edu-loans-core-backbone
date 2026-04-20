import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Building2, Banknote, FilePlus } from "lucide-react";

const actions = [
  { label: "Manage Leads", icon: FileText, to: "/admin/leads" },
  { label: "Add New Lead", icon: FilePlus, to: "/admin/leads/new" },
  { label: "Manage Partners", icon: Building2, to: "/admin/partners" },
  { label: "Manage Lenders", icon: Banknote, to: "/admin/lenders" },
];

export function AdminQuickActions() {
  const navigate = useNavigate();
  return (
    <Card className="p-6">
      <h3 className="text-base font-semibold mb-1">Quick Actions</h3>
      <p className="text-xs text-muted-foreground mb-4">Jump into admin management modules</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {actions.map((a) => (
          <Button
            key={a.label}
            variant="outline"
            className="justify-start h-auto py-3"
            onClick={() => navigate(a.to)}
          >
            <a.icon className="h-4 w-4 mr-2 text-primary" />
            <span className="text-sm">{a.label}</span>
          </Button>
        ))}
      </div>
    </Card>
  );
}
