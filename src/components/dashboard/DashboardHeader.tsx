import { Button } from "@/components/ui/button";
import { Plus, Upload, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";

type AppUser = Tables<"users">;

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

interface Props {
  appUser: AppUser | null;
  partnerName: string | null;
}

export function DashboardHeader({ appUser, partnerName }: Props) {
  const navigate = useNavigate();
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {getGreeting()}, {appUser?.full_name ?? "User"}
        </h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
          {partnerName && (
            <span className="text-sm font-medium text-primary">{partnerName}</span>
          )}
          <span className="text-sm text-muted-foreground">{today}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Track leads, uploads, documents, and payouts in one place
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => navigate("/leads/new")}>
          <Plus className="mr-1 h-4 w-4" /> Add Lead
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate("/bulk-upload")}>
          <Upload className="mr-1 h-4 w-4" /> Bulk Upload
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate("/leads")}>
          <FileText className="mr-1 h-4 w-4" /> View Leads
        </Button>
      </div>
    </div>
  );
}
