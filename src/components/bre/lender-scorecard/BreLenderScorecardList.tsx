// Lender-Specific Scorecard list (view-only v1).
// Reads bre_lender_rules (active) directly. Uses DB scorecard JSONB as the
// primary source; falls back to seeds.ts when DB scorecard is missing/invalid.

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, Database, FileWarning } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ProvenanceBadge } from "./ProvenanceBadge";
import { aggregateProvenance, normalizeScorecard, type NormalizedScorecard } from "@/lib/bre/lenderScorecard/normalizeScorecard";

interface Row {
  rule_id: string;
  lender_id: string;
  lender_name: string;
  lender_code: string;
  version_number: number;
  scorecard: NormalizedScorecard;
}

export function BreLenderScorecardList() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("bre_lender_rules")
        .select("id, lender_id, version_number, basic_info, scorecard")
        .eq("is_active", true);
      if (cancelled) return;
      if (error) {
        toast({ title: "Failed to load lender scorecards", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }
      const mapped: Row[] = (data ?? []).map((r) => {
        const bi = (r.basic_info ?? {}) as { lender_name?: string; lender_code?: string };
        const code = bi.lender_code ?? "";
        return {
          rule_id: r.id as string,
          lender_id: r.lender_id as string,
          lender_name: bi.lender_name ?? "Unknown",
          lender_code: code,
          version_number: Number(r.version_number ?? 0),
          scorecard: normalizeScorecard(r.scorecard, code),
        };
      });
      // Sort: source-backed first, then by name.
      const score = (sc: NormalizedScorecard) =>
        aggregateProvenance(sc.weights, sc.income_floor_provenance, sc.needs_business_validation) === "source_backed" ? 0 : 1;
      mapped.sort((a, b) => score(a.scorecard) - score(b.scorecard) || a.lender_name.localeCompare(b.lender_name));
      setRows(mapped);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">No active lender rules found.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        View-only v1. Scoring/risk bands are engine defaults and are not lender-overridable in this version.
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => <ScorecardRowCard key={r.rule_id} row={r} />)}
      </div>
    </div>
  );
}

function ScorecardRowCard({ row }: { row: Row }) {
  const { scorecard: sc } = row;
  const top = useMemo(() => [...sc.weights].sort((a, b) => b.weight - a.weight).slice(0, 3), [sc.weights]);
  const overall = aggregateProvenance(sc.weights, sc.income_floor_provenance, sc.needs_business_validation);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base truncate">{row.lender_name}</CardTitle>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
              <span className="font-mono">{row.lender_code || "—"}</span>
              <span>•</span>
              <span>v{row.version_number}</span>
            </div>
          </div>
          <ProvenanceBadge tag={overall} />
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        <div className="flex items-center gap-1.5 text-xs">
          {sc.source === "db" ? (
            <Badge variant="outline" className="bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30">
              <Database className="mr-1 h-3 w-3" /> DB scorecard
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300">
              <FileWarning className="mr-1 h-3 w-3" /> Fallback (seed default)
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">{sc.display_label}</div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Top weights</div>
          <div className="flex flex-wrap gap-1.5">
            {top.map((w) => (
              <Badge key={w.factor} variant="secondary" className="text-xs font-normal">
                {factorLabel(w.factor)} {w.weight}
              </Badge>
            ))}
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link to={`/admin/bre/scoring/lenders/${row.lender_id}`}>
            View scorecard <ChevronRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function factorLabel(f: string): string {
  const map: Record<string, string> = {
    academics: "Academics",
    backlogs: "Backlogs",
    university_course: "University/Course",
    cibil: "CIBIL",
    income: "Income",
    emi_foir: "EMI/FOIR",
    income_stability: "Income stability",
    collateral_route: "Collateral route",
    loan_amount_fit: "Loan amount fit",
    coverage: "Coverage",
    processing_ops: "Processing ops",
  };
  return map[f] ?? f;
}
