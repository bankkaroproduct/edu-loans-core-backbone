import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Upload, Zap, FileText, Users, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  partnerName: string | null;
}

export function OnboardingEmptyState({ partnerName }: Props) {
  const navigate = useNavigate();

  const steps = [
    {
      icon: Zap,
      title: "Create your first lead",
      description: "Capture a student in under a minute with Quick Lead.",
      action: "Quick Lead",
      onClick: () => navigate("/leads/quick"),
      primary: true,
    },
    {
      icon: Plus,
      title: "Add a complete lead",
      description: "Use the 5-step wizard to submit full student details.",
      action: "Add Lead",
      onClick: () => navigate("/leads/new"),
    },
    {
      icon: Upload,
      title: "Bulk upload leads",
      description: "Import multiple students at once via CSV/Excel template.",
      action: "Bulk Upload",
      onClick: () => navigate("/bulk-upload"),
    },
  ];

  const tips = [
    { icon: FileText, label: "Documents auto-seed once a lead is submitted" },
    { icon: BookOpen, label: "Master Data shows lenders, universities, courses" },
    { icon: Users, label: "Track lead progress on the Submitted Leads page" },
  ];

  return (
    <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="p-6 sm:p-8 space-y-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            Welcome{partnerName ? `, ${partnerName}` : ""} 👋
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            You haven't submitted any leads yet. Pick the path that works for you to get started.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.title}
                className="rounded-lg border bg-card p-4 flex flex-col gap-3 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-primary/10 p-2">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm">{s.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground flex-1">{s.description}</p>
                <Button
                  size="sm"
                  variant={s.primary ? "default" : "outline"}
                  onClick={s.onClick}
                  className="w-full"
                >
                  {s.action}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="rounded-lg bg-muted/40 p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Good to know
          </p>
          <ul className="space-y-1.5">
            {tips.map((t) => {
              const Icon = t.icon;
              return (
                <li key={t.label} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{t.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
