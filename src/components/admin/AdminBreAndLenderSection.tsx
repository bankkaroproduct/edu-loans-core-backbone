import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  Percent,
  IndianRupee,
  ShieldCheck,
  Unlock,
  GraduationCap,
  Home,
  Plane,
  Wallet,
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
import type { BreResult, BucketKey, ParameterTrace } from "@/lib/bre/types";
import { displayLenderCode } from "@/lib/lenderDisplay";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"student_leads">;

const BUCKET_LABEL: Record<BucketKey, string> = {
  student: "Student",
  university: "University",
  coapplicant: "Co-applicant",
};

/**
 * Admin-only merged section: BRE Diagnostic + Recommended Lender Options.
 *
 * Composition rule: this is a thin wrapper that runs the SAME BRE evaluation
 * as the legacy AdminCalculateBreCard (handleRun is a verbatim copy) and
 * displays its result alongside the eligible-lender list. We do NOT mutate
 * BRE output, lender ranking, rate, amount, fit, or secured/unsecured logic.
 *
 * Manual lender assignment lives in AdminAssignLenderCard and is independent.
 */
export function AdminBreAndLenderSection({ lead }: { lead: Lead }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BreResult | null>(null);
  const [missing, setMissing] = useState<{ field: string; label: string }[]>([]);
  const [resolution, setResolution] = useState<BuildProfileResolution | null>(null);
  const [scoringVersion, setScoringVersion] = useState<number | null>(null);
  const [bucketThreshold, setBucketThreshold] = useState<number | null>(null);
  // Stored recommendation_rank + fit_category from lead_lender_matches (premiere-aware
  // source of truth). Used only to display rank badge, fit label, and ORDER the cards.
  // Does not affect BRE engine, scores, rates, loan amounts, coverage chips, or eligibility.
  type StoredMatch = {
    rank: number | null;
    fit: "best_fit" | "good_fit" | "backup" | null;
    reason: string | null;
    score: number | null;
    processingTimeDays: number | null;
  };
  const [storedMatches, setStoredMatches] = useState<Map<string, StoredMatch>>(new Map());

  // VERBATIM copy of AdminCalculateBreCard.handleRun — no logic changes.
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

      // Fetch stored recommendation_rank + fit_category snapshot for display only.
      const { data: stored } = await supabase
        .from("lead_lender_matches")
        .select("lender_id, recommendation_rank, fit_category, recommendation_reason_summary, score")
        .eq("lead_id", lead.id);
      const m = new Map<string, StoredMatch>();
      // Build lender_id -> processing_time_days lookup from already-loaded active rules.
      // Read-only: only surfaces value when rule already provides policy.processing_time_days.
      const ptByLender = new Map<string, number>();
      for (const rule of rules) {
        const pt = rule.policy?.processing_time_days;
        if (typeof pt === "number" && pt > 0) ptByLender.set(rule.lender_id, pt);
      }
      for (const row of stored ?? []) {
        m.set(row.lender_id, {
          rank: row.recommendation_rank ?? null,
          fit: (row.fit_category as StoredMatch["fit"]) ?? null,
          reason: (row.recommendation_reason_summary as string | null) ?? null,
          score: row.score != null ? Number(row.score) : null,
          processingTimeDays: ptByLender.get(row.lender_id) ?? null,
        });
      }
      // Also include lenders that are eligible but have no stored match row,
      // so their cards still get the processing-time bullet.
      for (const lr of rules) {
        if (!m.has(lr.lender_id)) {
          const pt = ptByLender.get(lr.lender_id) ?? null;
          if (pt != null) {
            m.set(lr.lender_id, { rank: null, fit: null, reason: null, score: null, processingTimeDays: pt });
          }
        }
      }
      setStoredMatches(m);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`BRE evaluation failed: ${msg}`);
    } finally {
      setRunning(false);
    }
  };

  // VERBATIM derived state from AdminCalculateBreCard.
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

    const bucketReasons = result.rejection_reasons.filter((r) =>
      /below threshold|age cap|destination country|loan amount/i.test(r),
    );

    return { allBucketsPass, eligibleLenders, displayStatus, bucketReasons };
  }, [result]);

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Calculator className="h-4 w-4" /> BRE &amp; Lender Recommendation
          </h3>
          <p className="text-xs text-muted-foreground">
            Internal eligibility diagnostic and the lenders we can move forward with.
          </p>
        </div>
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
          Run BRE to see the diagnostic and recommended lender options. Read-only — does not change
          the assigned lender.
        </p>
      )}

      {result && derived && (
        <>
          {/* ============ 1) BRE DIAGNOSTIC ============ */}
          <section className="space-y-4">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
              BRE Diagnostic
            </div>

            <StatusBanner
              status={derived.displayStatus}
              overallScore={result.overall_score}
              band={result.overall_band?.band ?? null}
              scoringVersion={scoringVersion}
              threshold={bucketThreshold}
              hasApproximateData={missing.length > 0}
            />

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

            <ResolutionNotes resolution={resolution} />

            <div>
              <div className="text-xs font-medium text-foreground mb-1.5">Bucket scores</div>
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

            <ScoreHighlights result={result} />

            <Accordion type="single" collapsible>
              <AccordionItem value="breakdown" className="border rounded-md px-3">
                <AccordionTrigger className="text-xs font-medium py-2.5 hover:no-underline">
                  View detailed BRE breakdown (
                  {result.buckets.student.trace.length +
                    result.buckets.university.trace.length +
                    result.buckets.coapplicant.trace.length}{" "}
                  parameters)
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
          </section>

          {/* ============ 2) RECOMMENDED LENDER OPTIONS ============ */}
          <section className="space-y-3 pt-2 border-t border-border/60">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
              Recommended Lender Options
            </div>

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
              <LenderOptionCards
                eligibleLenders={derived.eligibleLenders}
                loanRange={result.eligible_loan_range}
                storedMatches={storedMatches}
                scoringVersion={scoringVersion}
                activeRuleCount={result.eligible_lenders.length}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Sub-components (local to this file — no shared abstractions)
// ============================================================================

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
          Icon: CheckCircle2,
          tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200",
        };
      case "passed_no_lender":
        return {
          label: "BRE Passed · No lender matched",
          Icon: AlertTriangle,
          tone: "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200",
        };
      case "rejected":
        return {
          label: hasApproximateData ? "Needs Manual Review" : "BRE Rejected",
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

// ---------------- Premium lender card list ----------------

type StoredMatchValue = {
  rank: number | null;
  fit: "best_fit" | "good_fit" | "backup" | null;
  reason: string | null;
  score: number | null;
  processingTimeDays: number | null;
};

function LenderOptionCards({
  eligibleLenders,
  loanRange,
  storedMatches,
  scoringVersion,
  activeRuleCount,
}: {
  eligibleLenders: BreResult["eligible_lenders"];
  loanRange: BreResult["eligible_loan_range"];
  storedMatches: Map<string, StoredMatchValue>;
  scoringVersion: number | null;
  activeRuleCount: number;
}) {
  const ordered = [...eligibleLenders].sort((a, b) => {
    const sa = storedMatches.get(a.lender_id)?.rank ?? null;
    const sb = storedMatches.get(b.lender_id)?.rank ?? null;
    if (sa != null && sb != null) return sa - sb;
    if (sa != null) return -1;
    if (sb != null) return 1;
    return (a.rank ?? Number.POSITIVE_INFINITY) - (b.rank ?? Number.POSITIVE_INFINITY);
  });

  const hasStoredRanks = ordered.some((l) => storedMatches.get(l.lender_id)?.rank != null);
  const engineOrderById = new Map<string, number>();
  [...eligibleLenders]
    .sort((a, b) => (a.rank ?? Number.POSITIVE_INFINITY) - (b.rank ?? Number.POSITIVE_INFINITY))
    .forEach((l, i) => engineOrderById.set(l.lender_id, i + 1));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs text-muted-foreground">
          {ordered.length} {ordered.length === 1 ? "lender" : "lenders"} match this profile
        </div>
        {/* Header aggregate ROI range intentionally hidden — it blended secured + unsecured
            across lenders. Per-card, route-specific ROI ranges remain. */}
        {loanRange && (
          <div className="text-[11px] text-muted-foreground tabular-nums">
            ₹{loanRange.min.toLocaleString("en-IN")} – ₹{loanRange.max.toLocaleString("en-IN")}
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground italic flex items-start gap-1.5">
        <Info className="h-3 w-3 shrink-0 mt-0.5" />
        <span>
          Order reflects BRE recommendation rank (overall fit). ROI shown is the live indicative rate.
        </span>
      </p>

      <ol className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {ordered.slice(0, 8).map((l, idx) => {
          const storedRank = storedMatches.get(l.lender_id)?.rank ?? null;
          const engineRank = engineOrderById.get(l.lender_id) ?? null;
          const isStale =
            hasStoredRanks &&
            storedRank != null &&
            engineRank != null &&
            storedRank !== engineRank;
          return (
            <LenderCard
              key={l.lender_id}
              l={l}
              stored={storedMatches.get(l.lender_id) ?? null}
              displayPosition={idx + 1}
              staleRank={isStale}
            />
          );
        })}
      </ol>

      <p className="text-[11px] text-muted-foreground italic">
        Estimates only. No lender is auto-assigned and lead stage is not changed.
      </p>
      <p className="text-[10px] text-muted-foreground/80 tabular-nums pt-1 border-t border-border/40">
        Rule snapshot: scoring v{scoringVersion ?? "—"} · {activeRuleCount} active lender rule
        {activeRuleCount === 1 ? "" : "s"} · live BRE estimate
      </p>
    </div>
  );
}

function LenderCard({
  l,
  stored,
  displayPosition,
  staleRank = false,
}: {
  l: BreResult["eligible_lenders"][number];
  stored: StoredMatchValue | null;
  displayPosition: number;
  staleRank?: boolean;
}) {
  const isSecured = l.product_type === "secured";
  const isUnsecured = l.product_type === "unsecured";

  // Visible serial badge — always reflects the current visible order (#1, #2, #3, ...).
  // Stored recommendation_rank is still used to ORDER the list (in LenderOptionCards),
  // but is NOT mutated and not shown as the badge number. This avoids gaps caused by
  // filtered-out lenders occupying low stored ranks.
  const displayRank = displayPosition;

  // User-facing code subtitle: hide only the Credila/HDFC mismatch.
  // Internal lender_code is preserved in DB and admin/internal screens.
  const codeSubtitle = displayLenderCode(l.lender_name, l.lender_code);

  // Coverage chips: render only items explicitly set to true.
  const exp = l.coverage_expenses;
  type CovItem = { key: keyof NonNullable<typeof exp>; label: string; icon: React.ReactNode };
  const ALL_ITEMS: CovItem[] = [
    { key: "tuition", label: "Tuition Fee", icon: <GraduationCap className="h-3 w-3" /> },
    { key: "living", label: "Living / Accommodation", icon: <Home className="h-3 w-3" /> },
    { key: "travel", label: "Travel", icon: <Plane className="h-3 w-3" /> },
    { key: "insurance", label: "Insurance", icon: <ShieldCheck className="h-3 w-3" /> },
    { key: "other_education_expenses", label: "Other education expenses", icon: <Wallet className="h-3 w-3" /> },
  ];
  const coverageItems = ALL_ITEMS.filter((it) => exp?.[it.key] === true);

  // "Not covered" inference rule (UI-only, no DB writes):
  //   - exp must be a non-null object (i.e. lender has source-backed coverage data)
  //   - AND at least one item is explicitly true (proves the object is populated, not empty)
  // Otherwise we render NOTHING — never assume "Not covered" for unknown / null data.
  const hasCoverageSource =
    exp != null && typeof exp === "object" && coverageItems.length > 0;
  const notCoveredItems = hasCoverageSource
    ? ALL_ITEMS.filter((it) => exp?.[it.key] !== true)
    : [];

  // ROI range display (pass-through values from engine; no recompute here).
  const hasRoiRange =
    typeof l.roi_range_min === "number" &&
    typeof l.roi_range_max === "number" &&
    l.roi_range_min != null &&
    l.roi_range_max != null;

  // PF chip text — pass-through from engine. Hidden entirely if no PF source.
  const pfLabel = formatPfLabel(l);

  return (
    <li className="group relative rounded-lg border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all p-3 flex flex-col gap-2.5">
      {/* Top row: rank + name + fit */}
      <div className="flex items-start gap-2">
        <span
          className="inline-flex h-6 min-w-[1.75rem] shrink-0 items-center justify-center rounded-md bg-muted px-1.5 text-[11px] font-mono font-semibold text-foreground"
          aria-label={`Rank ${displayRank}`}
        >
          {`#${displayRank}`}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground truncate" title={l.lender_name}>
            {l.lender_name}
          </div>
          {codeSubtitle && (
            <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{codeSubtitle}</div>
          )}
        </div>
        <FitBadge badge={l.badge} storedFit={stored?.fit ?? null} />
      </div>

      {/* Projected ROI — primary metric, displayed prominently */}
      {l.projected_rate != null && (
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Projected ROI
          </span>
          <span className="text-base font-semibold text-foreground tabular-nums">
            ~{l.projected_rate}%
          </span>
          {staleRank && (
            <Badge
              variant="outline"
              className="text-[9px] px-1 py-0 border-amber-500/40 text-amber-700 dark:text-amber-300"
              title="Stored recommendation rank differs from live rate-based order"
            >
              Stale rank
            </Badge>
          )}
        </div>
      )}

      {/* Secondary metrics row */}
      <div className="flex flex-wrap items-center gap-1.5">
        {hasRoiRange && (
          <Chip
            icon={<Percent className="h-3 w-3" />}
            label={`ROI Range: ${l.roi_range_min}% – ${l.roi_range_max}%`}
          />
        )}
        {l.projected_loan_amount != null && (
          <Chip
            icon={<IndianRupee className="h-3 w-3" />}
            label={`₹${Math.round(l.projected_loan_amount).toLocaleString("en-IN")}`}
            accent
          />
        )}
        {pfLabel && <Chip icon={<Wallet className="h-3 w-3" />} label={pfLabel} />}
        {isSecured && (
          <Chip icon={<ShieldCheck className="h-3 w-3" />} label="Secured" />
        )}
        {isUnsecured && (
          <Chip icon={<Unlock className="h-3 w-3" />} label="Unsecured" />
        )}
      </div>

      {/* Coverage row — shown only when at least one expense is explicitly true */}
      {coverageItems.length > 0 && (
        <div className="space-y-1 pt-0.5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Coverage</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {coverageItems.map((item) => (
              <Chip key={item.label} icon={item.icon} label={item.label} />
            ))}
          </div>
        </div>
      )}

      {/* Not covered row — shown only for lenders with source-backed coverage data
          (i.e. coverage_expenses object exists AND has at least one true value). */}
      {hasCoverageSource && notCoveredItems.length > 0 && (
        <div className="space-y-1 pt-0.5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Not covered</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {notCoveredItems.map((item) => (
              <span
                key={item.label}
                className="inline-flex items-center gap-1 rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 px-1.5 py-0.5 text-[11px] text-muted-foreground line-through decoration-muted-foreground/40"
              >
                {item.icon}
                {item.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recommendation rationale — bullets shown only when backed by real data */}
      <RecommendationRationale
        storedReason={stored?.reason ?? null}
        projectedLoanAmount={l.projected_loan_amount}
        productType={l.product_type}
        coverageCount={coverageItems.length}
        processingTimeDays={stored?.processingTimeDays ?? null}
      />
    </li>
  );
}

function RecommendationRationale({
  storedReason,
  projectedLoanAmount,
  productType,
  coverageCount,
  processingTimeDays,
}: {
  storedReason: string | null;
  projectedLoanAmount: number | null;
  productType: "secured" | "unsecured" | null;
  coverageCount: number;
  processingTimeDays: number | null;
}) {
  const bullets: string[] = [];

  const reason = storedReason?.trim();
  if (reason) bullets.push(reason);

  if (projectedLoanAmount != null && projectedLoanAmount > 0) {
    bullets.push(
      `Loan amount ₹${Math.round(projectedLoanAmount).toLocaleString("en-IN")} fits lender range`,
    );
  }

  if (productType === "secured") {
    bullets.push("Secured route available");
  } else if (productType === "unsecured") {
    bullets.push("Unsecured route available");
  }

  if (coverageCount > 0) {
    bullets.push(
      `Covers ${coverageCount} expense ${coverageCount === 1 ? "category" : "categories"}`,
    );
  }

  if (processingTimeDays != null && processingTimeDays > 0) {
    bullets.push(
      `Processing time ~${processingTimeDays} day${processingTimeDays === 1 ? "" : "s"}`,
    );
  }

  if (bullets.length === 0) return null;

  return (
    <div className="space-y-1 pt-0.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        Recommendation rationale
      </div>
      <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-muted-foreground">
        {bullets.map((b, i) => (
          <li key={i} className="leading-snug">
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Chip({
  icon,
  label,
  accent = false,
}: {
  icon: React.ReactNode;
  label: string;
  accent?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] tabular-nums ${
        accent
          ? "border-primary/30 bg-primary/5 text-foreground font-medium"
          : "border-border bg-muted/40 text-muted-foreground"
      }`}
    >
      {icon}
      {label}
    </span>
  );
}

function FitBadge({
  badge,
  storedFit,
}: {
  badge: BreResult["eligible_lenders"][number]["badge"];
  storedFit: "best_fit" | "good_fit" | "backup" | null;
}) {
  // Stored fit_category from lead_lender_matches wins over engine badge when present.
  // Engine badges map: best_match→Best fit, strong→Good fit, backup→Backup.
  const map = {
    best_fit: {
      label: "Best fit",
      cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    },
    good_fit: {
      label: "Good fit",
      cls: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    },
    backup: {
      label: "Backup",
      cls: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
    },
  } as const;
  const engineMap: Record<NonNullable<BreResult["eligible_lenders"][number]["badge"]>, keyof typeof map> = {
    best_match: "best_fit",
    strong: "good_fit",
    backup: "backup",
  };
  const key: keyof typeof map | null = storedFit ?? (badge ? engineMap[badge] : null);
  if (!key) return null;
  const m = map[key];
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${m.cls}`}>
      {m.label}
    </Badge>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Formats a Processing Fee chip label from a lender match result.
 * Returns null when no PF data is configured (chip is then hidden entirely).
 * Display precedence: range → single % → flat ₹. Pass-through only — never
 * used by ranking, scoring, eligibility, or any backend logic.
 */
function formatPfLabel(l: BreResult["eligible_lenders"][number]): string | null {
  const gst = l.pf_gst_applicable === true ? " + GST" : "";
  if (l.pf_pct_min != null && l.pf_pct_max != null) {
    return `PF: ${l.pf_pct_min}%–${l.pf_pct_max}%${gst}`;
  }
  if (l.pf_pct != null) {
    return `PF: ${l.pf_pct}%${gst}`;
  }
  if (l.pf_flat != null) {
    return `PF: ₹${Math.round(l.pf_flat).toLocaleString("en-IN")}${gst}`;
  }
  return null;
}

function ResolutionNotes({ resolution }: { resolution: BuildProfileResolution | null }) {
  if (!resolution) return null;
  const um = resolution.university_match;
  const cl = resolution.course_level_derivation;

  const items: { label: string; tone: "ok" | "warn" | "muted"; text: import("react").ReactNode }[] = [];

  if (um && "kind" in um) {
    if (um.kind === "fuzzy") {
      items.push({
        label: "University matched from raw name",
        tone: "ok",
        text: (
          <>
            <span className="italic">"{um.raw}"</span> → <span className="font-medium">{um.master_name}</span>
            {" · "}ranking_bucket: <span className="font-mono">{um.ranking_bucket ?? "Unranked"}</span>
            {" · "}employability_outlook: <span className="font-mono">{um.employability_outlook ?? "—"}</span>
          </>
        ),
      });
    } else if (um.kind === "by_id") {
      items.push({
        label: "University resolved from master",
        tone: "ok",
        text: (
          <>
            <span className="font-medium">{um.master_name}</span>
            {" · "}ranking_bucket: <span className="font-mono">{um.ranking_bucket ?? "Unranked"}</span>
            {" · "}employability_outlook: <span className="font-mono">{um.employability_outlook ?? "—"}</span>
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
        text: <span className="italic">"{um.raw}"</span>,
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

  // Effective Academic Score (Graduation ± Highest Qualification)
  const ac = resolution.academic;
  if (ac && ac.source !== "none") {
    const grad = ac.graduation;
    const hq = ac.highestQualification;
    items.push({
      label: "Effective academic score used in BRE",
      tone: "ok",
      text: (
        <>
          {grad.percentage != null ? (
            <>Graduation: <span className="font-mono">{grad.scoreNum}{grad.totalNum != null ? `/${grad.totalNum}` : ""} → {grad.percentage}%</span>{" · "}</>
          ) : null}
          {hq.percentage != null ? (
            <>Highest Qualification: <span className="font-mono">{hq.scoreNum}{hq.totalNum != null ? `/${hq.totalNum}` : ""} → {hq.percentage}%</span>{" · "}</>
          ) : null}
          Effective: <span className="font-mono font-semibold">{ac.effective}%</span>
          <div className="text-[11px] mt-0.5 text-muted-foreground">{ac.reason}</div>
        </>
      ),
    });
  }

  // Co-applicant work experience → income_stability_years.
  // Distinguish missing (null on BOTH years and months) vs explicit 0/0.
  const cw = resolution.coapplicant_work_experience;
  if (cw) {
    const provided = cw.years != null || cw.months != null;
    if (!provided) {
      items.push({
        label: "Co-applicant work experience",
        tone: "muted",
        text: (
          <>
            Lead input: <span className="font-mono">Not provided</span>
            {" · "}Status: <span className="font-mono">Not provided</span>
            {" · "}Reason: Co-applicant work experience was not provided.
          </>
        ),
      });
    } else {
      items.push({
        label: "Co-applicant work experience",
        tone: cw.mapped_to === "income_stability_years" ? "ok" : "muted",
        text: (
          <>
            Input: <span className="font-mono">{cw.years ?? 0} years {cw.months ?? 0} months</span>
            {" · "}BRE value: <span className="font-mono">{cw.decimal_years ?? "—"} years</span>
            {" · "}Mapped to: <span className="font-mono">{cw.mapped_to}</span>
          </>
        ),
      });
    }
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
