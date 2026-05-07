// Lender-Specific Scorecard detail (view-only v1).
// Reads the active bre_lender_rules row for the given lender. DB scorecard
// is the primary source; falls back to seeds.ts when missing/invalid.

import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, AlertTriangle, Database, FileWarning } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ProvenanceBadge } from "@/components/bre/lender-scorecard/ProvenanceBadge";
import { factorLabel } from "@/components/bre/lender-scorecard/BreLenderScorecardList";
import { aggregateProvenance, normalizeScorecard, type NormalizedScorecard } from "@/lib/bre/lenderScorecard/normalizeScorecard";

interface RuleData {
  rule_id: string;
  lender_id: string;
  lender_name: string;
  lender_code: string;
  version_number: number;
  scorecard: NormalizedScorecard;
  hard_thresholds: Record<string, unknown> | null;
  loan_caps: Record<string, unknown> | null;
  coverage: Record<string, unknown> | null;
}

const FACTOR_DESCRIPTIONS: Record<string, string> = {
  cibil: "Credit bureau score band — primary credit risk signal.",
  income: "Co-applicant monthly income vs lender floor.",
  emi_foir: "Existing EMI burden as a fraction of income.",
  income_stability: "Salaried/PSU vs self-employed; ITR continuity.",
  academics: "Average of Class X / XII / Graduation marks.",
  backlogs: "Active backlogs in academic record.",
  university_course: "University tier and premiere-list match.",
  collateral_route: "Secured vs unsecured route fit and collateral confirmation.",
  loan_amount_fit: "Requested amount vs lender min/max caps.",
  coverage: "Country and course coverage support.",
  processing_ops: "Operational throughput / processing time.",
};

export default function BreLenderScorecardDetail() {
  const { lenderId } = useParams<{ lenderId: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RuleData | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!lenderId) return;
    (async () => {
      setLoading(true);
      const { data: row, error } = await supabase
        .from("bre_lender_rules")
        .select("*")
        .eq("lender_id", lenderId)
        .eq("is_active", true)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        toast({ title: "Failed to load scorecard", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }
      if (!row) {
        setData(null);
        setLoading(false);
        return;
      }
      const bi = (row.basic_info ?? {}) as { lender_name?: string; lender_code?: string };
      const code = bi.lender_code ?? "";
      setData({
        rule_id: row.id as string,
        lender_id: row.lender_id as string,
        lender_name: bi.lender_name ?? "Unknown",
        lender_code: code,
        version_number: Number(row.version_number ?? 0),
        scorecard: normalizeScorecard((row as { scorecard?: unknown }).scorecard, code),
        hard_thresholds: (row.hard_thresholds as Record<string, unknown>) ?? null,
        loan_caps: (row.loan_caps as Record<string, unknown>) ?? null,
        coverage: (row.coverage as Record<string, unknown>) ?? null,
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [lenderId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/bre/scoring"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
        <Card><CardContent className="p-6 text-sm text-muted-foreground">No active scorecard found for this lender.</CardContent></Card>
      </div>
    );
  }

  const { scorecard: sc } = data;
  const overall = aggregateProvenance(sc.weights, sc.income_floor_provenance, sc.needs_business_validation);

  return (
    <div className="space-y-6 pb-24">
      <PageHeader title={`${data.lender_name} — Scorecard`} description={sc.display_label}>
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/bre/scoring"><ArrowLeft className="mr-1 h-4 w-4" /> Back to Scoring Config</Link>
        </Button>
        <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300">Read-only v1</Badge>
      </PageHeader>

      {/* Overview */}
      <Card>
        <CardHeader><CardTitle className="text-base">Overview</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 text-sm">
          <KV k="Lender" v={data.lender_name} />
          <KV k="Lender code" v={<span className="font-mono">{data.lender_code || "—"}</span>} />
          <KV k="Active rule version" v={`v${data.version_number}`} />
          <KV k="Scorecard label" v={sc.display_label} />
          <KV k="Source" v={
            sc.source === "db" ? (
              <Badge variant="outline" className="bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30">
                <Database className="mr-1 h-3 w-3" /> DB scorecard
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300">
                <FileWarning className="mr-1 h-3 w-3" /> Fallback (seed default)
              </Badge>
            )
          } />
          <KV k="Overall provenance" v={<ProvenanceBadge tag={overall} />} />
        </CardContent>
      </Card>

      {/* Factor Weights */}
      <FactorWeightsTable sc={sc} />

      {/* Scoring Bands */}
      <ScoringBandsPanel />

      {/* Risk Band Thresholds */}
      <RiskBandPanel />

      {/* Hard Knockout Rules */}
      <KnockoutRulesPanel
        hardThresholds={data.hard_thresholds}
        loanCaps={data.loan_caps}
        coverage={data.coverage}
        incomeFloor={sc.income_floor_monthly}
        incomeFloorProv={sc.income_floor_provenance}
      />

      {/* Provenance & Validation */}
      <Card>
        <CardHeader><CardTitle className="text-base">Provenance &amp; Validation</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Aggregate:</span>
            <ProvenanceBadge tag={overall} />
          </div>
          {sc.needs_business_validation && (
            <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-red-700 dark:text-red-300">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <div>This scorecard is flagged as <strong>needs business validation</strong>. Treat outputs as indicative only.</div>
            </div>
          )}
          {overall === "proposed" && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <div>One or more weights / floors are <strong>proposed defaults</strong>. Not confirmed by lender source documentation.</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {sc.notes && (
        <Card>
          <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap text-muted-foreground">{sc.notes}</CardContent>
        </Card>
      )}
    </div>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b py-1.5 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span>{v}</span>
    </div>
  );
}

function FactorWeightsTable({ sc }: { sc: NormalizedScorecard }) {
  const total = useMemo(() => sc.weights.reduce((a, w) => a + (Number(w.weight) || 0), 0), [sc.weights]);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Factor Weights</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Factor</TableHead>
              <TableHead className="w-20 text-right">Weight</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-40">Provenance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sc.weights.map((w) => (
              <TableRow key={w.factor}>
                <TableCell className="font-medium">{factorLabel(w.factor)}</TableCell>
                <TableCell className="text-right tabular-nums">{w.weight}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{FACTOR_DESCRIPTIONS[w.factor] ?? "—"}</TableCell>
                <TableCell><ProvenanceBadge tag={w.provenance} /></TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t-2">
              <TableCell className="font-semibold">Total</TableCell>
              <TableCell className={`text-right tabular-nums font-semibold ${total === 100 ? "" : "text-red-600"}`}>{total}</TableCell>
              <TableCell colSpan={2} className="text-xs text-muted-foreground">
                {total === 100 ? "Sums to 100." : "Does not sum to 100 — check configuration."}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function EngineDefaultsBadge() {
  return (
    <Badge variant="outline" className="bg-slate-500/10 text-slate-700 border-slate-500/30 dark:text-slate-300">
      Engine defaults — not lender-overridable in v1
    </Badge>
  );
}

function ScoringBandsPanel() {
  const rows: { factor: string; bands: { range: string; raw: number }[] }[] = [
    { factor: "CIBIL", bands: [
      { range: "≥ 780", raw: 100 }, { range: "750–779", raw: 90 }, { range: "720–749", raw: 75 },
      { range: "700–719", raw: 60 }, { range: "680–699", raw: 40 }, { range: "650–679", raw: 25 }, { range: "< 650", raw: 5 },
    ]},
    { factor: "Income (× of floor)", bands: [
      { range: "Below floor", raw: 0 }, { range: "1.0–1.2×", raw: 40 }, { range: "1.2–1.5×", raw: 55 },
      { range: "1.5–2×", raw: 70 }, { range: "2–3×", raw: 85 }, { range: "≥ 3×", raw: 100 },
    ]},
    { factor: "FOIR", bands: [
      { range: "≤ 25%", raw: 100 }, { range: "26–35%", raw: 85 }, { range: "36–45%", raw: 65 },
      { range: "46–55%", raw: 35 }, { range: "> 55%", raw: 10 },
    ]},
    { factor: "Academics (avg %)", bands: [
      { range: "≥ 80", raw: 100 }, { range: "70–79", raw: 80 }, { range: "60–69", raw: 60 },
      { range: "50–59", raw: 35 }, { range: "< 50", raw: 10 },
    ]},
    { factor: "Backlogs", bands: [
      { range: "0", raw: 100 }, { range: "1–2", raw: 75 }, { range: "3–5", raw: 50 },
      { range: "6–10", raw: 25 }, { range: "> 10", raw: 5 },
    ]},
  ];
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Scoring Bands</CardTitle>
          <EngineDefaultsBadge />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((r) => (
          <div key={r.factor}>
            <div className="text-sm font-medium mb-1.5">{r.factor}</div>
            <div className="flex flex-wrap gap-1.5">
              {r.bands.map((b) => (
                <Badge key={b.range} variant="secondary" className="font-normal">
                  {b.range} <span className="ml-1.5 text-muted-foreground">→ {b.raw}</span>
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RiskBandPanel() {
  const bands = [
    { name: "Low Risk", range: "≥ 75", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
    { name: "Medium Risk", range: "55–74", cls: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30" },
    { name: "High Risk", range: "35–54", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30" },
    { name: "Needs Review", range: "< 35", cls: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30" },
    { name: "Not Eligible", range: "Knockout fail", cls: "bg-red-700/10 text-red-800 dark:text-red-300 border-red-700/30" },
  ];
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Risk Band Thresholds</CardTitle>
          <EngineDefaultsBadge />
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {bands.map((b) => (
          <Badge key={b.name} variant="outline" className={b.cls}>
            {b.name} <span className="ml-1.5 opacity-70">{b.range}</span>
          </Badge>
        ))}
      </CardContent>
    </Card>
  );
}

function KnockoutRulesPanel({
  hardThresholds, loanCaps, coverage, incomeFloor, incomeFloorProv,
}: {
  hardThresholds: Record<string, unknown> | null;
  loanCaps: Record<string, unknown> | null;
  coverage: Record<string, unknown> | null;
  incomeFloor: number;
  incomeFloorProv: NormalizedScorecard["income_floor_provenance"];
}) {
  const ht = hardThresholds ?? {};
  const lc = (loanCaps ?? {}) as { secured?: { min?: number | null; max?: number | null }; unsecured?: { min?: number | null; max?: number | null } };
  const cov = (coverage ?? {}) as { supported_countries?: string[]; excluded_states?: string[] };
  const fmt = (v: unknown) => v == null || v === "" ? "—" : String(v);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Hard Knockout Rules</CardTitle></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 text-sm">
        <KV k="Min co-applicant income" v={fmt(ht["min_coapplicant_income"])} />
        <KV k="Min CIBIL" v={fmt(ht["min_cibil"])} />
        <KV k="Min age" v={fmt(ht["min_age"])} />
        <KV k="Max age" v={fmt(ht["max_age"])} />
        <KV k="Max DPD months" v={fmt(ht["max_dpd_months"])} />
        <KV k="Min ITR years" v={fmt(ht["min_itr_years"])} />
        <KV k="Secured cap" v={`${fmt(lc.secured?.min)} – ${fmt(lc.secured?.max)}`} />
        <KV k="Unsecured cap" v={`${fmt(lc.unsecured?.min)} – ${fmt(lc.unsecured?.max)}`} />
        <KV k="Supported countries" v={cov.supported_countries?.length ? cov.supported_countries.join(", ") : "—"} />
        <KV k="Excluded states" v={cov.excluded_states?.length ? cov.excluded_states.join(", ") : "—"} />
        <KV
          k="Scorecard income floor"
          v={<span className="flex items-center gap-2">₹{incomeFloor.toLocaleString("en-IN")} <ProvenanceBadge tag={incomeFloorProv} /></span>}
        />
      </CardContent>
    </Card>
  );
}
