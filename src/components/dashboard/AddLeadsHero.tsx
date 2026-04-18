import { Card, CardContent } from "@/components/ui/card";
import { Zap, FilePlus, Upload, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const actions = [
  {
    label: "Quick Lead",
    subtext: "Add a lead in seconds",
    route: "/leads/quick",
    icon: Zap,
  },
  {
    label: "Add Lead",
    subtext: "Fill complete details",
    route: "/leads/new",
    icon: FilePlus,
  },
  {
    label: "Bulk Upload",
    subtext: "Upload multiple leads via file",
    route: "/bulk-upload",
    icon: Upload,
  },
];

export function AddLeadsHero() {
  const navigate = useNavigate();

  return (
    <section aria-labelledby="add-leads-title">
      <div className="mb-3">
        <h2 id="add-leads-title" className="text-lg font-semibold text-foreground">
          Add Leads
        </h2>
        <p className="text-sm text-muted-foreground">Choose how you want to add leads</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <Card
              key={a.label}
              role="button"
              tabIndex={0}
              onClick={() => navigate(a.route)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(a.route);
                }
              }}
              className="group cursor-pointer transition-all hover:border-primary hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground">{a.label}</div>
                  <div className="text-xs text-muted-foreground">{a.subtext}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
