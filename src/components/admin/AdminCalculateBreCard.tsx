import { useMemo, useState } from "react";
import {
  Calculator,
  Loader2,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  XCircle,
  MinusCircle,
  HelpCircle,
  TrendingDown,
  TrendingUp,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { evaluate } from "@/lib/bre/engine";
import { loadActive } from "@/lib/bre/loader";
import { buildBreProfileFromLeadAsync, type BuildProfileResolution } from "@/lib/bre/leadProfile";
import {
  applyRankModifier,
  resolveRankBandFromResolution,
  type RankModifierResult,
} from "@/lib/bre/rankModifier";
import type { BreLenderRule, BreResult, BucketKey, ParameterTrace } from "@/lib/bre/types";
import type { Tables } from "@/integrations/supabase/types";
import { formatINR } from "@/lib/formatCurrency";

type Lead = Tables<"student_leads">;

const BUCKET_LABEL: Record<BucketKey, string> = {
  student: "Student",
  university: "University",
  coapplicant: "Co-applicant",
};

/**
 * Admin-only card: Run BRE on demand for a single lead.
 *
 * Flow (per product spec):
 *  1. Score Student / University / Co-applicant buckets via the active BRE config.
 *  2. If ANY bucket fails the active threshold → "BRE Rejected".
 *     - Show rejection reasons + score breakdown.
 *     - HIDE lender options.
 *  3. If all buckets pass:
 *     a. If active lender rules return matches → "BRE Passed" + estimated lender options.
 *     b. If no lender rule matches → "BRE Passed, no lender matched" (NOT rejected).
 *
 * Important UI behavior:
 *  - The underlying engine treats "no eligible lender" as Rejected (hard-gate).
 *    For this card we DERIVE display status from bucket pass/fail directly so
 *    the user-facing distinction between "BRE Rejected" and "Passed but no
 *    lender matched" is preserved. Engine logic is NOT modified.
 *  - Read-only: never writes to DB, never assigns lender, never changes stage.
 */
export function AdminCalculateBreCard({ lead }: { lead: Lead }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BreResult | null>(null);
  const [missing, setMissing] = useState<{ field: string; label: string }[]>([]);
  const [resolution, setResolution] = useState<BuildProfileResolution | null>(null);
  const [scoringVersion, setScoringVersion] = useState<number | null>(null);
  const [bucketThreshold, setBucketThreshold] = useState<number | null>(null);
  const [activeRules, setActiveRules] = useState<BreLenderRule[]>([]);

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    try {
      const { profile, missing: missingFields, resolution: res } = await buildBreProfileFromLeadAsync(lead);
      setMissing(missingFields);
      setResolution(res ?? null);

      const { cfg, rules } = await loadActive();
      const r = evaluate(profile, cfg, rules);
      setResult(r);
      setScoringVersion(cfg.version_number);
      setBucketThreshold(cfg.bucket_threshold);
      setActiveRules(rules);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`BRE evaluation failed: ${msg}`);
    } finally {
      setRunning(false);
    }
  };

  // ---- Derived UI state (does not mutate engine result) ----
  const derived = useMemo(() => {
    if (!result) return null;
    const allBucketsPass =
      result.buckets.student.passes &&
      result.buckets.university.passes &&
      result.buckets.coapplicant.passes;
    const eligibleLenders = result.eligible_lenders.filter((l) => l.eligible);

    let displayStatus: "passed_with_lenders" | "passed_no_lender" | "rejected";
    if (!allBucketsPass) {
      displayStatus = "rejected";
    } else if (eligibleLenders.length > 0) {
      displayStatus = "passed_with_lenders";
    } else {
      displayStatus = "passed_no_lender";
    }

    // Bucket-level rejection reasons only (filter out engine's lender-derived
    // "hard gate" / "no eligible lender" reasons when buckets actually passed).
    const bucketReasons = result.rejection_reasons.filter((r) =>
      /below threshold|age cap|destination country|loan amount/i.test(r),
    );

    // Phase 2 — university rank modifier overlay (display-only, post-eligibility).
    const rankInfo = resolveRankBandFromResolution(resolution?.university_match);
    const rankModifiers = new Map<string, RankModifierResult>();
    for (const l of eligibleLenders) {
      const rule = activeRules.find((r) => r.lender_id === l.lender_id) ?? null;
      const mod = applyRankModifier({
        band: rankInfo.band,
        globalRank: rankInfo.globalRank,
        baseProjectedLoan: l.projected_loan_amount,
        baseProjectedRate: l.projected_rate,
        requestedLoan: lead.loan_amount_required != null ? Number(lead.loan_amount_required) : null,
        productType: l.product_type,
        rule,
        roiRangeMin: l.roi_range_min ?? null,
        roiRangeMax: l.roi_range_max ?? null,
      });
      rankModifiers.set(l.lender_id, mod);
    }
    // Headline modifier (any lender — band/rank are lead-level, all lenders share band)
    const headlineModifier =
      eligibleLenders.length > 0 ? rankModifiers.get(eligibleLenders[0].lender_id) ?? null : null;

    return { allBucketsPass, eligibleLenders, displayStatus, bucketReasons, rankModifiers, headlineModifier };
  }, [result, resolution, activeRules, lead.loan_amount_required]);

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Calculator className="h-4 w-4" /> BRE Diagnostic
        </h3>
        <Button size="sm" onClick={handleRun} disabled={running}>
          {running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 mr-1" />
          )}
          {result ? "Re-run" : "Run BRE"}
        </Button>
      </div>

      {!result && (
        <p className="text-xs text-muted-foreground">
          Scores Student / University / Co-applicant buckets first. Lender options shown only if all
          buckets clear the active threshold. Read-only — does not change the assigned lender.
        </p>
      )}

      {result && derived && (
        <div className="space-y-4 pt-2">
          {/* ---------- Status banner ---------- */}
          <StatusBanner
            status={derived.displayStatus}
            overallScore={result.overall_score}
            band={result.overall_band?.band ?? null}
            scoringVersion={scoringVersion}
            threshold={bucketThreshold}
            hasApproximateData={missing.length > 0}
          />

          {/* ---------- Approximate-data notice ---------- */}
          {missing.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-900 dark:text-amber-200 flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">
                  {derived.displayStatus !== "rejected"
                    ? "Estimated based on available lead details. Final eligibility may change after document verification."
                    : "Needs Manual Review — lender options limited due to incomplete lead data."}
                </div>
                <div className="mt-0.5 text-[11px] opacity-90">
                  Not provided: {missing.map((m) => m.label).join(", ")}.
                </div>
              </div>
            </div>
          )}

          {/* ---------- Resolution notes (fuzzy match / derived fields) ---------- */}
          <ResolutionNotes resolution={resolution} />

          {/* ---------- University rank impact (Phase 2) ---------- */}
          {derived.headlineModifier && (
            <div className="rounded-md border border-sky-500/30 bg-sky-500/5 p-2 text-xs text-foreground flex gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-sky-600 dark:text-sky-300" />
              <div>{derived.headlineModifier.explanation}</div>
            </div>
          )}

          {/* ---------- BRE Eligibility Scorecard ---------- */}
          <div>
            <div className="text-xs font-medium text-foreground mb-1.5">
              BRE Eligibility Scorecard
            </div>
            <div className="grid grid-cols-3 gap-2">
              <BucketScorecard
                label="Student"
                value={result.buckets.student.total}
                passes={result.buckets.student.passes}
                threshold={bucketThreshold}
              />
              <BucketScorecard
                label="University"
                value={result.buckets.university.total}
                passes={result.buckets.university.passes}
                threshold={bucketThreshold}
              />
              <BucketScorecard
                label="Co-applicant"
                value={result.buckets.coapplicant.total}
                passes={result.buckets.coapplicant.passes}
                threshold={bucketThreshold}
              />
            </div>
          </div>

          {/* ---------- Rejection summary (only when actually rejected by buckets) ---------- */}
          {derived.displayStatus === "rejected" && derived.bucketReasons.length > 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs space-y-1.5">
              <div className="font-medium text-destructive flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5" /> Primary rejection reasons
              </div>
              <ul className="space-y-0.5 text-destructive/90">
                {derived.bucketReasons.slice(0, 6).map((r, i) => (
                  <li key={i}>• {r}</li>
                ))}
              </ul>
            </div>
          )}

          {/* ---------- Highlights (top contributors / detractors) ---------- */}
          <ScoreHighlights result={result} />

          {/* ---------- Detailed breakdown (expandable) ---------- */}
          <Accordion type="single" collapsible>
            <AccordionItem value="breakdown" className="border rounded-md px-3">
              <AccordionTrigger className="text-xs font-medium py-2.5 hover:no-underline">
                View detailed BRE breakdown ({result.buckets.student.trace.length + result.buckets.university.trace.length + result.buckets.coapplicant.trace.length} parameters)
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="space-y-4">
                  {(["student", "university", "coapplicant"] as BucketKey[]).map((bk) => (
                    <BucketTraceTable
                      key={bk}
                      title={BUCKET_LABEL[bk]}
                      trace={result.buckets[bk].trace}
                      total={result.buckets[bk].total}
                      passes={result.buckets[bk].passes}
                      threshold={bucketThreshold}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* ---------- Lender options (gated) ---------- */}
          {derived.displayStatus === "rejected" ? (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground flex gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Lender options are not shown because this profile did not clear BRE eligibility.
              </span>
            </div>
          ) : derived.displayStatus === "passed_no_lender" ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 flex gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>BRE passed, but no active lender rule currently matches this profile.</span>
            </div>
          ) : (
            <LenderOptionsList
              eligibleLenders={derived.eligibleLenders}
              loanRange={result.eligible_loan_range}
              rateRange={result.indicative_rate_range}
              rankModifiers={derived.rankModifiers}
            />
          )}
        </div>
      )}
    </div>
  );
}

// =================== Sub-components ===================

function StatusBanner({
  status,
  overallScore,
  band,
  scoringVersion,
  threshold,
  hasApproximateData,
}: {
  status: "passed_with_lenders" | "passed_no_lender" | "rejected";
  overallScore: number;
  band: string | null;
  scoringVersion: number | null;
  threshold: number | null;
  hasApproximateData: boolean;
}) {
  const cfg = (() => {
    switch (status) {
      case "passed_with_lenders":
        return {
          label: "BRE Passed",
          variant: "default" as const,
          Icon: CheckCircle2,
          tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200",
        };
      case "passed_no_lender":
        return {
          label: "BRE Passed · No lender matched",
          variant: "secondary" as const,
          Icon: AlertTriangle,
          tone: "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200",
        };
      case "rejected":
        return {
          label: hasApproximateData ? "Needs Manual Review" : "BRE Rejected",
          variant: "destructive" as const,
          Icon: XCircle,
          tone: "border-destructive/40 bg-destructive/5 text-destructive",
        };
    }
  })();

  const { Icon } = cfg;
  return (
    <div className={`rounded-md border p-2.5 flex items-start gap-2 ${cfg.tone}`}>
      <Icon className="h-4 w-4 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">{cfg.label}</span>
          <span className="text-[11px] opacity-80">
            Score <span className="font-mono">{overallScore}</span>
            {band && (
              <>
                {" · "}Band <span className="font-mono">{band}</span>
              </>
            )}
            {threshold != null && (
              <>
                {" · "}Bucket threshold <span className="font-mono">{threshold}</span>
              </>
            )}
            {scoringVersion != null && (
              <>
                {" · "}Config v<span className="font-mono">{scoringVersion}</span>
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

function BucketScorecard({
  label,
  value,
  passes,
  threshold,
}: {
  label: string;
  value: number;
  passes: boolean;
  threshold: number | null;
}) {
  return (
    <div
      className={`rounded-md border px-2.5 py-2 ${
        passes ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/40 bg-destructive/5"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
        <Badge
          variant="outline"
          className={`text-[9px] px-1 py-0 ${
            passes
              ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
              : "border-destructive/40 text-destructive"
          }`}
        >
          {passes ? "PASS" : "FAIL"}
        </Badge>
      </div>
      <div
        className={`text-base font-mono mt-1 ${passes ? "text-foreground" : "text-destructive"}`}
      >
        {value}
        <span className="text-muted-foreground text-xs">/100</span>
      </div>
      {threshold != null && (
        <div className="text-[10px] text-muted-foreground">Threshold {threshold}</div>
      )}
    </div>
  );
}

type TraceStatus = "Pass" | "Partial" | "Failed" | "Not Provided";

function classifyTrace(t: ParameterTrace): TraceStatus {
  if (t.input == null || t.input === "") return "Not Provided";
  if (t.matched_band == null) return "Failed";
  if (t.band_score >= 80) return "Pass";
  if (t.band_score > 0) return "Partial";
  return "Failed";
}

function statusBadge(s: TraceStatus) {
  switch (s) {
    case "Pass":
      return (
        <Badge
          variant="outline"
          className="text-[10px] px-1 py-0 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
        >
          <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Pass
        </Badge>
      );
    case "Partial":
      return (
        <Badge
          variant="outline"
          className="text-[10px] px-1 py-0 border-amber-500/40 text-amber-700 dark:text-amber-300"
        >
          <MinusCircle className="h-2.5 w-2.5 mr-0.5" /> Partial
        </Badge>
      );
    case "Failed":
      return (
        <Badge
          variant="outline"
          className="text-[10px] px-1 py-0 border-destructive/40 text-destructive"
        >
          <XCircle className="h-2.5 w-2.5 mr-0.5" /> Failed
        </Badge>
      );
    case "Not Provided":
      return (
        <Badge
          variant="outline"
          className="text-[10px] px-1 py-0 border-muted-foreground/30 text-muted-foreground"
        >
          <HelpCircle className="h-2.5 w-2.5 mr-0.5" /> Not provided
        </Badge>
      );
  }
}

function bandLabel(t: ParameterTrace): string {
  const b = t.matched_band;
  if (!b) return "— no band matched";
  if ("value" in b) return b.label ?? b.value;
  return `${b.from}–${b.to}${b.label ? ` · ${b.label}` : ""}`;
}

function reasonText(t: ParameterTrace, s: TraceStatus): string {
  switch (s) {
    case "Not Provided":
      return "Lead data not provided — scored as 0.";
    case "Failed":
      return t.matched_band
        ? "Input falls in a low-scoring band."
        : "Input did not match any configured band.";
    case "Partial":
      return "Input matched a mid-tier band; partial contribution.";
    case "Pass":
      return "Input matched a high-scoring band.";
  }
}

function BucketTraceTable({
  title,
  trace,
  total,
  passes,
  threshold,
}: {
  title: string;
  trace: ParameterTrace[];
  total: number;
  passes: boolean;
  threshold: number | null;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-foreground">{title}</div>
        <div className="text-[11px] text-muted-foreground">
          Total <span className="font-mono text-foreground">{total}</span>
          {threshold != null && (
            <>
              {" "}
              / threshold {threshold} ·{" "}
              <span className={passes ? "text-emerald-600" : "text-destructive"}>
                {passes ? "PASS" : "FAIL"}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px] h-8">Parameter</TableHead>
              <TableHead className="text-[10px] h-8">Lead input</TableHead>
              <TableHead className="text-[10px] h-8">Rule / band</TableHead>
              <TableHead className="text-[10px] h-8 text-right">Score</TableHead>
              <TableHead className="text-[10px] h-8">Status</TableHead>
              <TableHead className="text-[10px] h-8">Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trace.map((t) => {
              const s = classifyTrace(t);
              return (
                <TableRow key={t.param_key}>
                  <TableCell className="text-[11px] font-medium py-1.5">{t.label}</TableCell>
                  <TableCell className="text-[11px] py-1.5">
                    {t.input == null || t.input === "" ? (
                      <span className="text-muted-foreground italic">Not provided</span>
                    ) : (
                      String(t.input)
                    )}
                  </TableCell>
                  <TableCell className="text-[11px] py-1.5 text-muted-foreground">
                    {bandLabel(t)}
                  </TableCell>
                  <TableCell className="text-[11px] py-1.5 text-right tabular-nums">
                    +{t.contribution}
                    <span className="text-muted-foreground"> / {t.weight}</span>
                  </TableCell>
                  <TableCell className="py-1.5">{statusBadge(s)}</TableCell>
                  <TableCell className="text-[11px] py-1.5 text-muted-foreground">
                    {reasonText(t, s)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ScoreHighlights({ result }: { result: BreResult }) {
  const allTrace: ParameterTrace[] = [
    ...result.buckets.student.trace,
    ...result.buckets.university.trace,
    ...result.buckets.coapplicant.trace,
  ];
  if (allTrace.length === 0) return null;

  const reducers = [...allTrace]
    .filter((t) => t.weight > 0)
    .map((t) => ({ t, lost: round2((t.weight * (100 - t.band_score)) / 100) }))
    .filter((x) => x.lost > 0)
    .sort((a, b) => b.lost - a.lost)
    .slice(0, 3);

  const positives = [...allTrace]
    .filter((t) => t.band_score >= 80 && t.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3);

  if (reducers.length === 0 && positives.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {reducers.length > 0 && (
        <div className="rounded-md border border-border bg-muted/20 p-2.5 text-xs space-y-1">
          <div className="font-medium text-foreground flex items-center gap-1.5">
            <TrendingDown className="h-3.5 w-3.5 text-destructive" /> Top factors reducing score
          </div>
          <ul className="space-y-0.5 text-muted-foreground">
            {reducers.map(({ t, lost }) => (
              <li key={`${t.bucket}-${t.param_key}`}>
                • {t.label}{" "}
                <span className="text-destructive/80">(−{lost})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {positives.length > 0 && (
        <div className="rounded-md border border-border bg-muted/20 p-2.5 text-xs space-y-1">
          <div className="font-medium text-foreground flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> Positive highlights
          </div>
          <ul className="space-y-0.5 text-muted-foreground">
            {positives.map((t) => (
              <li key={`${t.bucket}-${t.param_key}`}>
                • {t.label}{" "}
                <span className="text-emerald-700 dark:text-emerald-400">(+{t.contribution})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function LenderOptionsList({
  eligibleLenders,
  loanRange,
  rateRange,
  rankModifiers,
}: {
  eligibleLenders: BreResult["eligible_lenders"];
  loanRange: BreResult["eligible_loan_range"];
  rateRange: BreResult["indicative_rate_range"];
  rankModifiers: Map<string, RankModifierResult>;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-foreground">
          Estimated Lender Options Based on BRE ({eligibleLenders.length})
        </div>
        {(loanRange || rateRange) && (
          <div className="text-[11px] text-muted-foreground">
            {loanRange && (
              <>
                {formatINR(loanRange.min)} – {formatINR(loanRange.max)}
              </>
            )}
            {rateRange && (
              <>
                {" · "}
                {rateRange.min}% – {rateRange.max}%
              </>
            )}
          </div>
        )}
      </div>
      <ol className="space-y-1.5">
        {[...eligibleLenders]
          .sort((a, b) => {
            const ra = a.rank ?? Number.POSITIVE_INFINITY;
            const rb = b.rank ?? Number.POSITIVE_INFINITY;
            if (ra !== rb) return ra - rb;
            // Display-only tiebreaker: rank-adjusted projection.
            const ma = rankModifiers.get(a.lender_id);
            const mb = rankModifiers.get(b.lender_id);
            const la = ma?.adjustedProjectedLoan ?? a.projected_loan_amount ?? 0;
            const lb = mb?.adjustedProjectedLoan ?? b.projected_loan_amount ?? 0;
            if (lb !== la) return lb - la;
            const rta = ma?.adjustedProjectedRate ?? a.projected_rate ?? Number.POSITIVE_INFINITY;
            const rtb = mb?.adjustedProjectedRate ?? b.projected_rate ?? Number.POSITIVE_INFINITY;
            return rta - rtb;
          })
          .slice(0, 8)
          .map((l) => {
          const mod = rankModifiers.get(l.lender_id);
          const adjLoan = mod?.adjustedProjectedLoan ?? l.projected_loan_amount;
          const adjRate = mod?.adjustedProjectedRate ?? l.projected_rate;
          const changedLoan = mod && adjLoan !== l.projected_loan_amount && l.projected_loan_amount != null;
          const changedRate = mod && adjRate !== l.projected_rate && l.projected_rate != null;
          const fmtMoney = (n: number | null | undefined) =>
            n == null ? "—" : formatINR(Math.round(n));
          const fmtRate = (n: number | null | undefined) => (n == null ? "—" : `${n}%`);
          const loanPctLabel =
            mod && mod.loanModifierPct !== 0
              ? `${mod.loanModifierPct > 0 ? "+" : ""}${(mod.loanModifierPct * 100).toFixed(0)}%`
              : "0%";
          const ratePctLabel =
            mod && mod.rateModifierPct !== 0
              ? `${mod.rateModifierPct > 0 ? "+" : ""}${mod.rateModifierPct.toFixed(2)}%`
              : "0.00%";
          return (
          <li
            key={l.lender_id}
            className="rounded-md border border-border/60 px-2.5 py-2 text-xs space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="inline-flex h-5 min-w-[1.5rem] items-center justify-center rounded bg-muted px-1.5 text-[11px] font-mono font-semibold text-foreground"
                  aria-label={`Rank ${l.rank ?? "unranked"}`}
                >
                  {l.rank != null ? `#${l.rank}` : "—"}
                </span>
                <span className="font-medium text-foreground truncate" title={l.lender_name}>{l.lender_name}</span>
                <FitBadge badge={l.badge} />
                {l.product_type && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                    {l.product_type}
                  </Badge>
                )}
              </div>
              <div className="text-muted-foreground tabular-nums whitespace-nowrap">
                {adjRate != null && (
                  <span className={changedRate ? "text-foreground font-medium" : ""}>{adjRate}%</span>
                )}
                {adjLoan != null && (
                  <span className={changedLoan ? "text-foreground font-medium" : ""}>
                    {" · "}{formatINR(Math.round(adjLoan))}
                  </span>
                )}
              </div>
            </div>
            {mod && (
              <div className="rounded border border-border/50 bg-muted/30 px-2 py-1.5 space-y-1">
                <div className="flex flex-wrap items-center gap-1">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    University rank impact
                  </Badge>
                  {mod.globalRank != null && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      Rank #{mod.globalRank}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {mod.bandLabel}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    loan {loanPctLabel}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    rate {ratePctLabel}
                  </Badge>
                  {mod.clampApplied && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                      Clamp: {mod.clampApplied}
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground tabular-nums">
                  <div>
                    Loan: {fmtMoney(mod.baseProjectedLoan)}
                    {changedLoan ? <> → <span className="text-foreground font-medium">{fmtMoney(adjLoan)}</span></> : <span className="ml-1 italic">no change</span>}
                  </div>
                  <div>
                    Rate: {fmtRate(mod.baseProjectedRate)}
                    {changedRate ? <> → <span className="text-foreground font-medium">{fmtRate(adjRate)}</span></> : <span className="ml-1 italic">no change</span>}
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground italic">{mod.explanation}</div>
              </div>
            )}
          </li>
          );
        })}
      </ol>
      <p className="text-[11px] text-muted-foreground italic">
        Estimates only. Ordering uses engine rank; rank-adjusted projection breaks ties. No lender is auto-assigned and lead stage is not changed.
      </p>
    </div>
  );
}

function FitBadge({ badge }: { badge: BreResult["eligible_lenders"][number]["badge"] }) {
  if (!badge) return null;
  const map = {
    best_match: { label: "Best fit", cls: "border-emerald-500/40 text-emerald-700 dark:text-emerald-300" },
    strong: { label: "Good fit", cls: "border-sky-500/40 text-sky-700 dark:text-sky-300" },
    backup: { label: "Backup", cls: "border-muted-foreground/30 text-muted-foreground" },
  } as const;
  const m = map[badge];
  return (
    <Badge variant="outline" className={`text-[10px] px-1 py-0 ${m.cls}`}>
      {m.label}
    </Badge>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function ResolutionNotes({ resolution }: { resolution: BuildProfileResolution | null }) {
  if (!resolution) return null;
  const um = resolution.university_match;
  const cl = resolution.course_level_derivation;

  const items: { label: string; tone: "ok" | "warn" | "muted"; text: import("react").ReactNode }[] = [];

  if (um && "kind" in um) {
    const sourceLabel = (s: string | undefined): string => {
      switch (s) {
        case "global_rank": return "exact global rank";
        case "ranking_bucket_fallback": return "ranking_bucket fallback";
        case "unranked_fallback": return "unranked fallback";
        case "no_match": return "no master match";
        default: return "—";
      }
    };
    if (um.kind === "fuzzy" || um.kind === "by_id") {
      const u = um as Extract<typeof um, { kind: "fuzzy" | "by_id" }>;
      const formatBand = (b: string | null | undefined): string | null => {
        if (!b) return null;
        if (b === "premium") return "Premium";
        if (b === "unranked") return "Unranked";
        const m = /^tier_(\d+)$/.exec(b);
        return m ? `Tier ${m[1]}` : b;
      };
      const bandLabel = formatBand((u as any).effective_band ?? u.rank_band);
      items.push({
        label: u.kind === "fuzzy" ? "University matched from raw name" : "University resolved from master",
        tone: "ok",
        text: (
          <>
            {u.kind === "fuzzy" && (<><span className="italic">"{u.raw}"</span> → </>)}
            <span className="font-medium">{u.master_name}</span>
            {u.global_rank != null && (
              <>{" · "}<span className="font-mono">Global Rank #{u.global_rank}</span></>
            )}
            {bandLabel && (
              <>{" · "}<span className="font-mono">{bandLabel}</span></>
            )}
            {" · "}<span className="text-muted-foreground">Resolved via: {sourceLabel(u.source)}</span>
            {" · "}ranking_bucket fallback: <span className="font-mono">{u.ranking_bucket ?? "Unranked"}</span>
            {" · "}employability_outlook: <span className="font-mono">{u.employability_outlook ?? "—"}</span>
          </>
        ),
      });
    } else if (um.kind === "ambiguous") {
      items.push({
        label: "University name ambiguous — manual review",
        tone: "warn",
        text: (
          <>
            <span className="italic">"{um.raw}"</span> matched {um.candidates.length} candidates:{" "}
            {um.candidates.join(", ")}
          </>
        ),
      });
    } else if (um.kind === "no_match") {
      items.push({
        label: "University not found in master",
        tone: "warn",
        text: (
          <>
            <span className="italic">"{um.raw}"</span>
            {" · "}<span className="text-muted-foreground">resolved via: no master match</span>
          </>
        ),
      });
    }
  }

  if (cl && "source" in cl) {
    items.push({
      label: "Course level derived from course name",
      tone: "ok",
      text: (
        <>
          <span className="italic">"{cl.raw}"</span> → <span className="font-mono">{cl.derived}</span>
        </>
      ),
    });
  }

  const ep = resolution.english_proficiency;
  if (ep && ep.source === "other_test_scores") {
    items.push({
      label:
        ep.detected_exam === "generic"
          ? `English proficiency captured from Other Test Scores: ${ep.ielts_equivalent} — captured for reference only, not used in BRE scoring`
          : "English proficiency captured from Other Test Scores — captured for reference only, not used in BRE scoring",
      tone: "ok",
      text:
        ep.detected_exam === "generic" ? (
          <>
            <span className="italic">"{ep.raw}"</span> → IELTS-equivalent{" "}
            <span className="font-mono">{ep.ielts_equivalent}</span>
          </>
        ) : (
          <>
            <span className="italic">"{ep.raw}"</span> → detected{" "}
            <span className="font-mono">{ep.detected_exam.toUpperCase()}</span> · IELTS-equivalent{" "}
            <span className="font-mono">{ep.ielts_equivalent}</span>
          </>
        ),
    });
  } else if (ep && ep.source === "other_test_scores_unparseable") {
    items.push({
      label: "Other Test Scores present (captured for reference only, not used in BRE scoring)",
      tone: "warn",
      text: <span className="italic">"{ep.raw}"</span>,
    });
  } else if (ep && (ep.source === "ielts" || ep.source === "toefl" || ep.source === "duolingo" || ep.source === "pte")) {
    items.push({
      label: `${ep.source.toUpperCase()} captured — captured for reference only, not used in BRE scoring`,
      tone: "ok",
      text: (
        <>
          IELTS-equivalent <span className="font-mono">{ep.value}</span>
        </>
      ),
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="rounded-md border border-border bg-muted/20 p-2.5 text-xs space-y-1.5">
      <div className="font-medium text-foreground flex items-center gap-1.5">
        <Info className="h-3.5 w-3.5" /> Resolution notes
      </div>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-muted-foreground">
            <span
              className={
                it.tone === "warn"
                  ? "text-amber-700 dark:text-amber-300 font-medium"
                  : "text-foreground font-medium"
              }
            >
              {it.label}:
            </span>{" "}
            {it.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
