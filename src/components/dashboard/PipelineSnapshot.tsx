import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { formatStageLabel } from "./StageBadge";

const pipelineStages = [
  "draft", "submitted", "under_initial_review", "documents_pending",
  "documents_under_review", "bre_evaluated", "sent_to_lender",
  "login_submitted", "credit_query", "sanction_received",
  "disbursed", "rejected", "dropped", "on_hold",
] as const;

const stageBarColors: Record<string, string> = {
  draft: "bg-muted-foreground/40",
  submitted: "bg-primary",
  under_initial_review: "bg-amber-500",
  documents_pending: "bg-orange-500",
  documents_under_review: "bg-amber-500",
  bre_evaluated: "bg-blue-500",
  sent_to_lender: "bg-indigo-500",
  login_submitted: "bg-violet-500",
  credit_query: "bg-rose-500",
  sanction_received: "bg-emerald-500",
  disbursed: "bg-green-600",
  rejected: "bg-destructive",
  dropped: "bg-muted-foreground/30",
  on_hold: "bg-yellow-500",
};

interface Props {
  stageCounts: Record<string, number>;
  loading: boolean;
}

export function PipelineSnapshot({ stageCounts, loading }: Props) {
  const navigate = useNavigate();
  const total = Object.values(stageCounts).reduce((s, v) => s + v, 0) || 1;
  const disbursed = stageCounts["disbursed"] ?? 0;
  const actualTotal = Object.values(stageCounts).reduce((s, v) => s + v, 0);
  const convPct = actualTotal > 0 ? ((disbursed / actualTotal) * 100).toFixed(1) : "0";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Lead Pipeline</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="space-y-2">
            {pipelineStages.map((stage) => {
              const count = stageCounts[stage] ?? 0;
              if (count === 0) return null;
              const pct = Math.max((count / total) * 100, 2);
              return (
                <div
                  key={stage}
                  className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 transition-colors"
                  onClick={() => navigate(`/leads?stage=${stage}`)}
                >
                  <span className="text-xs text-muted-foreground w-36 truncate">
                    {formatStageLabel(stage)}
                  </span>
                  <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${stageBarColors[stage] ?? "bg-primary"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold w-8 text-right">{count}</span>
                </div>
              );
            })}
            {actualTotal <= 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No leads yet. Add your first lead to see pipeline data.
              </p>
            )}
            {actualTotal > 0 && (
              <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
                {disbursed} of {actualTotal} leads disbursed ({convPct}% conversion)
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
