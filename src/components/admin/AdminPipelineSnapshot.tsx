import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { GitBranch, AlertCircle, RefreshCw } from "lucide-react";
import type { PipelineStage } from "@/hooks/useAdminDashboard";

interface Props {
  data: PipelineStage[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function AdminPipelineSnapshot({ data, loading, error, onRetry }: Props) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold">Pipeline Snapshot</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Lead distribution across lifecycle stages (master-driven)</p>
        </div>
      </div>

      {loading && (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <div>
              <p className="font-medium text-sm">Pipeline failed to load</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
        </div>
      )}

      {!loading && !error && data.length === 0 && (
        <EmptyState icon={GitBranch} title="Pipeline empty" description="No lifecycle stages configured." />
      )}

      {!loading && !error && data.length > 0 && (() => {
        const active = data.filter((s) => !s.is_terminal);
        const terminal = data.filter((s) => s.is_terminal);
        const max = Math.max(1, ...data.map((s) => s.count));

        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              {active.map((s) => (
                <div key={s.stage_key} className="grid grid-cols-[160px_1fr_48px] items-center gap-3 text-sm">
                  <span className="text-foreground truncate">{s.stage_label}</span>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${(s.count / max) * 100}%` }}
                    />
                  </div>
                  <span className="text-right font-semibold tabular-nums">{s.count}</span>
                </div>
              ))}
            </div>

            {terminal.length > 0 && (
              <div className="pt-3 border-t">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Closed</p>
                <div className="flex flex-wrap gap-2">
                  {terminal.map((s) => (
                    <div key={s.stage_key} className="inline-flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1 text-xs">
                      <span className="text-muted-foreground">{s.stage_label}</span>
                      <span className="font-semibold tabular-nums">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </Card>
  );
}
