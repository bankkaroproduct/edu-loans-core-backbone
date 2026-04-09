import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, FileWarning, UploadCloud, Pause, Clock, MessageSquare, CreditCard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

export interface AlertItem {
  id: string;
  leadId: string | null;
  studentName: string;
  reason: string;
  category: "docs_pending" | "reupload" | "on_hold" | "upload_error" | "attention" | "stuck" | "payout_clarification" | "admin_remark";
  updatedAt: string;
  entityId: string;
}

const categoryConfig: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  docs_pending: { icon: FileWarning, label: "Documents Pending", color: "text-orange-600" },
  reupload: { icon: FileWarning, label: "Reupload Needed", color: "text-rose-600" },
  on_hold: { icon: Pause, label: "On Hold", color: "text-yellow-600" },
  upload_error: { icon: UploadCloud, label: "Upload Error", color: "text-destructive" },
  attention: { icon: AlertTriangle, label: "Needs Attention", color: "text-amber-600" },
  stuck: { icon: Clock, label: "Stuck Lead", color: "text-orange-500" },
  payout_clarification: { icon: CreditCard, label: "Payout Clarification", color: "text-blue-600" },
  admin_remark: { icon: MessageSquare, label: "Admin Remark", color: "text-indigo-600" },
};

export function PriorityAlerts({ alerts, loading }: { alerts: AlertItem[]; loading: boolean }) {
  const navigate = useNavigate();

  const handleAlertClick = (alert: AlertItem) => {
    switch (alert.category) {
      case "upload_error":
        navigate("/bulk-upload");
        break;
      case "payout_clarification":
        navigate("/payouts");
        break;
      default:
        navigate(`/leads/${alert.entityId}`);
    }
  };

  return (
    <Card className="border-l-4 border-l-amber-500">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Action Center
          {!loading && alerts.length > 0 && (
            <span className="ml-auto text-xs font-normal bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
              {alerts.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">
              All clear! No actions required right now. Keep submitting leads and uploading documents.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {alerts.slice(0, 15).map((alert) => {
              const config = categoryConfig[alert.category] ?? categoryConfig.attention;
              const Icon = config.icon;
              return (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 p-2 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => handleAlertClick(alert)}
                >
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${config.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {alert.leadId && (
                        <span className="text-xs font-mono text-muted-foreground">{alert.leadId}</span>
                      )}
                      <span className="text-sm font-medium truncate">{alert.studentName}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{alert.reason}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap flex items-center gap-1">
                    {new Date(alert.updatedAt).toLocaleDateString()}
                    <span className="text-primary font-medium">Resolve →</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
