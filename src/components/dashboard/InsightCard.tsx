import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { KPIData } from "./KPICards";

interface Props {
  kpiData: KPIData;
  loading: boolean;
}

export function InsightCard({ kpiData, loading }: Props) {
  const navigate = useNavigate();

  if (loading) return null;

  let message = "";
  let cta = "";
  let route = "";

  if (kpiData.needsAttention > 0) {
    message = `You have ${kpiData.needsAttention} lead${kpiData.needsAttention > 1 ? "s" : ""} needing attention — review and resolve them to keep your pipeline moving.`;
    cta = "Review Now";
    route = "/leads?attention=true";
  } else if (kpiData.documentsPending > 3) {
    message = `${kpiData.documentsPending} documents are pending upload. Clearing the backlog will speed up processing.`;
    cta = "View Pending";
    route = "/leads?stage=documents_pending";
  } else if (kpiData.disbursed > 0 && kpiData.pendingPayout > 0) {
    message = `You have pending payouts worth ₹${kpiData.pendingPayout.toLocaleString("en-IN")}. Track their status.`;
    cta = "View Payouts";
    route = "/payouts?status=pending";
  } else if (kpiData.totalLeads === 0) {
    message = "Get started by submitting your first lead. The pipeline will populate as you add cases.";
    cta = "Add Lead";
    route = "/leads/new";
  } else {
    message = "Your pipeline is healthy. Keep submitting leads and uploading documents to grow your earnings.";
    cta = "Add Lead";
    route = "/leads/new";
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 flex items-start gap-3">
        <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground">{message}</p>
        </div>
        <Button size="sm" variant="outline" className="shrink-0" onClick={() => navigate(route)}>
          {cta}
        </Button>
      </CardContent>
    </Card>
  );
}
