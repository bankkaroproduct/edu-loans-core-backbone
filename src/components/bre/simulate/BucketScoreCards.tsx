import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BreResult } from "@/lib/bre/types";

const LABELS: Record<keyof BreResult["buckets"], string> = {
  student: "Student",
  university: "University",
  coapplicant: "Co-applicant",
};

export function BucketScoreCards({ result, threshold }: { result: BreResult; threshold: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {(Object.keys(result.buckets) as (keyof BreResult["buckets"])[]).map((b) => {
        const bucket = result.buckets[b];
        const passes = bucket.passes;
        return (
          <Card key={b} className={passes ? "" : "border-rose-500/40"}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{LABELS[b]}</div>
                  <div className="text-2xl font-semibold tabular-nums mt-1">{bucket.total}<span className="text-muted-foreground text-base">/100</span></div>
                </div>
                <Badge variant="outline" className={passes ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" : "bg-rose-500/15 text-rose-700 border-rose-500/30"}>
                  {passes ? "PASS" : "FAIL"}
                </Badge>
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground">
                Threshold: {threshold}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
