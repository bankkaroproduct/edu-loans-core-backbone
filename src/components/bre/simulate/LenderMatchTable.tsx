import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, Trophy, Inbox } from "lucide-react";
import type { BreResult, LenderMatchResult } from "@/lib/bre/types";

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function BadgePill({ badge }: { badge: LenderMatchResult["badge"] }) {
  if (badge === "best_match") {
    return (
      <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white">
        <Trophy className="mr-1 h-3 w-3" /> Best Match
      </Badge>
    );
  }
  if (badge === "strong") {
    return <Badge variant="secondary" className="bg-sky-500/15 text-sky-700 border-sky-500/30">Strong</Badge>;
  }
  if (badge === "backup") {
    return <Badge variant="outline" className="text-muted-foreground">Backup</Badge>;
  }
  return null;
}

export function LenderMatchTable({ result }: { result: BreResult }) {
  const [showIneligible, setShowIneligible] = useState(false);
  const eligible = result.eligible_lenders.filter((l) => l.eligible).sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999));
  const ineligible = result.eligible_lenders.filter((l) => !l.eligible);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>Lender ranking</span>
          <span className="text-xs font-normal text-muted-foreground">
            {eligible.length} eligible · {ineligible.length} ineligible
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {eligible.length === 0 ? (
          <div className="rounded-md border border-dashed py-10 px-4 text-center">
            <Inbox className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <div className="mt-3 text-sm font-medium">No eligible lenders</div>
            <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
              No lender matched this profile. {result.rejection_reasons.length > 0
                ? "See rejection reasons above. "
                : ""}
              Try adjusting loan amount, destination country, or collateral route to expand matches.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Lender</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Projected loan</TableHead>
                <TableHead className="text-right">Projected rate</TableHead>
                <TableHead className="text-right">Effective ROI</TableHead>
                <TableHead className="text-right">Payout</TableHead>
                <TableHead>Badge</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eligible.map((l) => (
                <TableRow key={l.lender_id}>
                  <TableCell className="font-medium tabular-nums">#{l.rank}</TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{l.lender_name}</div>
                    <div className="text-[10px] text-muted-foreground">{l.lender_code}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{l.product_type ?? "—"}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{fmtMoney(l.projected_loan_amount)}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{l.projected_rate != null ? `${l.projected_rate}%` : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{l.effective_rate_min != null && l.effective_rate_max != null ? `${l.effective_rate_min}% – ${l.effective_rate_max}%` : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{l.payout_pct != null ? `${l.payout_pct}%` : "—"}</TableCell>
                  <TableCell><BadgePill badge={l.badge} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {ineligible.length > 0 && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowIneligible((v) => !v)}
              className="text-xs"
            >
              {showIneligible ? <ChevronDown className="mr-1 h-3 w-3" /> : <ChevronRight className="mr-1 h-3 w-3" />}
              Ineligible lenders ({ineligible.length})
            </Button>
            {showIneligible && (
              <div className="mt-2 space-y-2">
                {ineligible.map((l) => (
                  <div key={l.lender_id} className="rounded-md border border-border/60 px-3 py-2 text-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{l.lender_name} <span className="text-muted-foreground">({l.lender_code})</span></div>
                        <ul className="mt-1 list-disc list-inside space-y-0.5 text-muted-foreground">
                          {l.reasons.length > 0 ? l.reasons.map((r, i) => <li key={i}>{r}</li>) : <li>No specific reason recorded</li>}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
