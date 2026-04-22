import { CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Live indicator showing whether a bucket's parameter weights sum to 100. */
export function WeightSumIndicator({ sum }: { sum: number }) {
  const ok = sum === 100;
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium tabular-nums",
        ok
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-destructive/40 bg-destructive/10 text-destructive",
      )}
    >
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
      Weights sum: {sum} / 100
    </div>
  );
}
