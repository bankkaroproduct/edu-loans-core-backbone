import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BreResult } from "@/lib/bre/types";

function statusColor(s: BreResult["eligibility_status"]) {
  switch (s) {
    case "Approved": return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
    case "Approved with conditions": return "bg-sky-500/15 text-sky-700 border-sky-500/30";
    case "Borderline": return "bg-amber-500/15 text-amber-700 border-amber-500/30";
    case "Rejected": return "bg-rose-500/15 text-rose-700 border-rose-500/30";
  }
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export function ResultSummaryCard({ result }: { result: BreResult }) {
  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-start justify-between space-y-0">
        <CardTitle className="text-sm">Result summary</CardTitle>
        <Badge variant="outline" className={statusColor(result.eligibility_status)}>
          {result.eligibility_status}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Overall score</div>
            <div className="text-2xl font-semibold tabular-nums">{result.overall_score}<span className="text-muted-foreground text-base">/100</span></div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Band</div>
            <div className="text-2xl font-semibold">
              {result.overall_band ? result.overall_band.band : "—"}
            </div>
            <div className="text-[10px] text-muted-foreground">{result.overall_band?.label ?? ""}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Loan range</div>
            <div className="text-sm font-medium">
              {result.eligible_loan_range
                ? `${fmtMoney(result.eligible_loan_range.min)} – ${fmtMoney(result.eligible_loan_range.max)}`
                : "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Rate range</div>
            <div className="text-sm font-medium">
              {result.indicative_rate_range
                ? `${result.indicative_rate_range.min}% – ${result.indicative_rate_range.max}%`
                : "—"}
            </div>
            <div className="text-[10px] text-muted-foreground">
              Collateral route: <span className="font-medium">{result.collateral_route ?? "—"}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
