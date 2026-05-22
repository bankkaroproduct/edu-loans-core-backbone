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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import type { BreLenderRule, BreResult, BucketKey, LenderMatchResult, ParameterTrace } from "@/lib/bre/types";
import { formatEmploymentLabel, isEmploymentTypeParam } from "@/lib/bre/employmentDisplay";
import { displayLenderCode } from "@/lib/lenderDisplay";
import {
  computeDisplayRanking,
  type DisplayRankingOutput,
} from "@/lib/bre/displayRanking";
import { getPremiereMatches } from "@/lib/premiere/lookup";
import { getSeedForLender } from "@/lib/bre/lenderScorecard/seeds";
import type { Tables } from "@/integrations/supabase/types";
import { formatINR } from "@/lib/formatCurrency";
import { formatDisplayLabel } from "@/lib/formatDisplayLabel";


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
  const [refreshing, setRefreshing] = useState(false);
  const handleRefreshSaved = async () => {
    setRefreshing(true);
    try {
      const { refreshLeadRecommendations } = await import("@/lib/bre/refreshRecommendations");
      const r = await refreshLeadRecommendations(lead.id);
      if (r.skippedReason) {
        toast.error(`Could not refresh: ${r.skippedReason.replace(/_/g, " ")}`);
      } else {
        toast.success(
          `Saved recommendations refreshed — ${r.inserted} lender${r.inserted === 1 ? "" : "s"} written` +
            (r.preservedLocks > 0 ? `, ${r.preservedLocks} locked row${r.preservedLocks === 1 ? "" : "s"} preserved.` : "."),
        );
        // Refreshing saved rows should also refresh the visible card order; otherwise
        // the page can keep showing the previous in-memory ranking until Re-run/page reload.
        await handleRun();
      }
    } catch (e) {
      toast.error(`Refresh failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRefreshing(false);
    }
  };
  const [result, setResult] = useState<BreResult | null>(null);
  const [missing, setMissing] = useState<{ field: string; label: string }[]>([]);
  const [resolution, setResolution] = useState<BuildProfileResolution | null>(null);
  const [scoringVersion, setScoringVersion] = useState<number | null>(null);
  const [bucketThreshold, setBucketThreshold] = useState<number | null>(null);
  // Stored recommendation_rank + fit_category from lead_lender_matches.
  // Used only to display saved metadata; live card order remains engine rank first.
  // Does not affect BRE engine, scores, rates, loan amounts, coverage chips, or eligibility.
  type StoredMatch = {
    rank: number | null;
    fit: "best_fit" | "good_fit" | "backup" | null;
    reason: string | null;
    score: number | null;
    processingTimeDays: number | null;
  };
  const [storedMatches, setStoredMatches] = useState<Map<string, StoredMatch>>(new Map());
  // Phase 3 — live display ranking computed from engine output + premiere lookup.
  // Display-only. Does not mutate lead_lender_matches or stored ranks.
  const [displayRanking, setDisplayRanking] = useState<Map<string, DisplayRankingOutput>>(new Map());
  // Phase 2 — keep active lender rules around so the rank modifier can read
  // per-lender loan caps + ROI policy when adjusting projected loan/rate.
  // Display-only; not used by sorting, eligibility, or any engine logic.
  const [activeRules, setActiveRules] = useState<BreLenderRule[]>([]);

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
      setActiveRules(rules);

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

      // Phase 3 — compute display ranking from live engine output + premiere lookup.
      const eligibleForRanking = r.eligible_lenders.filter((l) => l.eligible);
      const lenderIds = eligibleForRanking.map((l) => l.lender_id);
      let premiereMap: Record<string, { is_premiere: boolean }> = {};
      let premiereKnown = true;
      try {
        premiereMap = await getPremiereMatches(
          lead.university_name_raw ?? null,
          lead.intended_study_country ?? null,
          lenderIds,
        );
      } catch (err) {
        premiereKnown = false;
        console.warn("[Phase3] premiere lookup failed", err);
      }
      const ruleById = new Map(rules.map((rl) => [rl.lender_id, rl] as const));
      const collateralState = res?.collateral_state ?? null;
      const rankingInputs = eligibleForRanking.map((l) => {
        const rule = ruleById.get(l.lender_id);
        const cap = l.product_type === "secured" ? rule?.loan_caps?.secured : rule?.loan_caps?.unsecured;
        return {
          lender: l,
          isPremiere: premiereMap[l.lender_id]?.is_premiere === true,
          premiereKnown,
          processingTimeDays: ptByLender.get(l.lender_id) ?? null,
          loanAmountRequested: profile.loan_amount ?? null,
          loanCapMin: cap?.min ?? null,
          loanCapMax: cap?.max ?? null,
        };
      });
      const ranked = computeDisplayRanking(rankingInputs, collateralState);
      setDisplayRanking(new Map(ranked.map((x) => [x.lender_id, x] as const)));
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

    // When BRE is rejected, the engine flags every lender row `eligible: false`
    // even though hard rules (active flag, country, collateral, loan amount,
    // product type) already filtered the candidate set in `result.eligible_lenders`.
    // For BRE-failed leads we surface those candidate rows as TENTATIVE /
    // manual-review options so the admin still has a starting point. This is
    // display-only — eligibility, scoring, ranking, and rates are untouched.
    const tentativeLenders =
      displayStatus === "rejected" && eligibleLenders.length === 0
        ? result.eligible_lenders
        : [];
    const lendersToShow =
      tentativeLenders.length > 0 ? tentativeLenders : eligibleLenders;

    // Phase 2 — university rank modifier overlay (display-only, post-eligibility).
    // Computed per-lender so each card can show base → adjusted projected loan/rate.
    // Does NOT affect sort order, eligibility, scores, or assignment.
    const rankInfo = resolveRankBandFromResolution(resolution?.university_match);
    const rankModifiers = new Map<string, RankModifierResult>();
    for (const l of lendersToShow) {
      const rule = activeRules.find((rl) => rl.lender_id === l.lender_id) ?? null;
      const mod = applyRankModifier({
        band: rankInfo.band,
        globalRank: rankInfo.globalRank,
        baseProjectedLoan: l.projected_loan_amount,
        baseProjectedRate: l.projected_rate,
        requestedLoan:
          lead.loan_amount_required != null ? Number(lead.loan_amount_required) : null,
        productType: l.product_type,
        rule,
        roiRangeMin: l.roi_range_min ?? null,
        roiRangeMax: l.roi_range_max ?? null,
      });
      rankModifiers.set(l.lender_id, mod);
    }
    // Headline modifier — band/rank are lead-level, so any displayed lender's
    // explanation works as the section-level summary line.
    const headlineModifier =
      lendersToShow.length > 0
        ? rankModifiers.get(lendersToShow[0].lender_id) ?? null
        : null;

    return {
      allBucketsPass,
      eligibleLenders,
      lendersToShow,
      isTentative: tentativeLenders.length > 0,
      displayStatus,
      bucketReasons,
      rankModifiers,
      headlineModifier,
    };
  }, [result, resolution, activeRules, lead.loan_amount_required]);

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Calculator className="h-4 w-4" /> BRE &amp; Lender Recommendation
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleRun} disabled={running || refreshing}>
            {running ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 mr-1" />
            )}
            {result ? "Re-run" : "Run BRE"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefreshSaved}
            disabled={running || refreshing}
            title="Overwrite saved lender recommendations with the live BRE result. Locked manual assignments are preserved."
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 mr-1" />
            )}
            Refresh saved recommendations
          </Button>
        </div>
      </div>

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

            {/* Phase 2 — section-level university rank impact summary.
                Display-only; same rank/band applies to every lender on this lead. */}
            {derived.displayStatus === "passed_with_lenders" && derived.headlineModifier && (
              <div className="rounded-md border border-sky-500/30 bg-sky-500/5 p-2 text-xs text-foreground flex gap-2">
                <Info className="h-4 w-4 shrink-0 mt-0.5 text-sky-600 dark:text-sky-300" />
                <div>{derived.headlineModifier.explanation}</div>
              </div>
            )}

            {derived.displayStatus === "passed_no_lender" ? (
              <LenderMatchFailureSummary
                lenders={result.eligible_lenders}
                lead={lead}
                resolution={resolution}
                activeRuleCount={activeRules.length}
              />
            ) : derived.lendersToShow.length === 0 ? (
              <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground flex gap-2">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  No active lender rule currently matches this profile, so tentative options cannot be shown.
                </span>
              </div>
            ) : (
              <>
                {derived.displayStatus === "rejected" && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 flex gap-2">
                    <Info className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold mb-0.5">Tentative Manual Review Lender Options</div>
                      <div>
                        Profile could not clear BRE thresholds. These are tentative lender options based on available profile data and require manual lender validation. Final approval, loan amount, and interest rate may vary.
                      </div>
                    </div>
                  </div>
                )}
                <LenderOptionCards
                  eligibleLenders={derived.lendersToShow}
                  loanRange={result.eligible_loan_range}
                  storedMatches={storedMatches}
                  scoringVersion={scoringVersion}
                  activeRuleCount={result.eligible_lenders.length}
                  collateralState={resolution?.collateral_state ?? null}
                  displayRanking={displayRanking}
                  rankModifiers={derived.rankModifiers}
                />
              </>
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

/**
 * LenderMatchFailureSummary
 * -------------------------
 * Display-only panel shown when BRE scoring passes but no active lender rule
 * matches the profile. Aggregates the existing per-lender `reasons[]` already
 * produced by the engine — does NOT re-evaluate, re-score, or change any
 * lender, rule, commercial, ROI, loan amount, or eligibility logic.
 *
 * Inactive lenders are already excluded upstream by the engine (only active
 * `bre_lender_rules` rows reach `result.eligible_lenders`), so they will not
 * appear here.
 */
type FailureCategory =
  | "relationship"
  | "coapp_income"
  | "coapp_age"
  | "coapp_cibil"
  | "loan_amount"
  | "country_geo"
  | "course"
  | "academics"
  | "student_age"
  | "collateral"
  | "other";

const CATEGORY_META: Record<FailureCategory, { label: string; helper: string }> = {
  relationship: {
    label: "Co-applicant relationship mismatch",
    helper: "The co-applicant relationship is not accepted by the active lender rules.",
  },
  coapp_income: {
    label: "Co-applicant income below lender minimums",
    helper: "Co-applicant income/ITR is below the minimums required by the active lender rules.",
  },
  coapp_age: {
    label: "Co-applicant age out of policy range",
    helper: "Co-applicant age sits outside the min/max bands set by the active lender rules.",
  },
  coapp_cibil: {
    label: "Co-applicant CIBIL below lender minimums",
    helper: "Co-applicant CIBIL is below the minimums required by the active lender rules.",
  },
  loan_amount: {
    label: "Requested loan amount outside lender caps",
    helper: "The requested loan amount is above (or below) the caps set by the active lender rules.",
  },
  country_geo: {
    label: "Destination country / region not in coverage",
    helper: "The destination country/state/city is not in the coverage list of the active lender rules.",
  },
  course: {
    label: "Course not in lender accepted list",
    helper: "The course is not in the accepted list of the active lender rules.",
  },
  academics: {
    label: "Academic marks below lender minimums",
    helper: "Academic marks are below the minimums set by the active lender rules.",
  },
  student_age: {
    label: "Student age out of policy range",
    helper: "Student age sits outside the bands permitted by the active lender rules.",
  },
  collateral: {
    label: "Collateral route not supported",
    helper: "The chosen collateral route (secured / unsecured) is not offered by the active lender rules.",
  },
  other: {
    label: "Other lender-rule gaps",
    helper: "One or more other lender-specific gates blocked this profile.",
  },
};

function classifyReason(raw: string): FailureCategory {
  const r = raw.toLowerCase();
  if (r.includes("relationship")) return "relationship";
  if (r.includes("cibil")) return "coapp_cibil";
  if (r.includes("co-applicant") && r.includes("age")) return "coapp_age";
  if (r.includes("co-applicant") && (r.includes("income") || r.includes("salary") || r.includes("itr"))) return "coapp_income";
  if (r.includes("salaried co-applicant") || r.includes("self-employed co-applicant")) return "coapp_income";
  if (r.startsWith("requested loan") || r.includes("loan amount")) return "loan_amount";
  if (r.includes("country") || r.includes("state ") || r.startsWith("city ")) return "country_geo";
  if (r.includes("course")) return "course";
  if (r.includes("academic marks")) return "academics";
  if (r.includes("student age")) return "student_age";
  if (r.includes("collateral") || r.includes("secured loans") || r.includes("unsecured loans")) return "collateral";
  return "other";
}

/**
 * Re-format quoted snake_case / lowercase tokens inside an existing reason
 * string (e.g. `"relative"` → `Relative`) without changing other content.
 */
function humanizeReason(raw: string): string {
  return raw.replace(/"([^"]+)"/g, (_, inner) => `"${formatDisplayLabel(inner, inner)}"`);
}

interface LenderMatchFailureSummaryProps {
  lenders: LenderMatchResult[];
  lead: Lead;
  resolution: BuildProfileResolution | null;
  activeRuleCount: number;
}

function LenderMatchFailureSummary({
  lenders,
  lead,
  resolution,
  activeRuleCount,
}: LenderMatchFailureSummaryProps) {
  // Categorize per-lender unique reasons → distinct lender count per category.
  const categories = useMemo(() => {
    const lendersByCategory = new Map<FailureCategory, Set<string>>();
    const sampleByCategory = new Map<FailureCategory, string>();
    for (const l of lenders) {
      const seenCats = new Set<FailureCategory>();
      for (const r of l.reasons ?? []) {
        if (!r) continue;
        const cat = classifyReason(r);
        if (!seenCats.has(cat)) {
          seenCats.add(cat);
          if (!lendersByCategory.has(cat)) lendersByCategory.set(cat, new Set());
          lendersByCategory.get(cat)!.add(l.lender_id);
          if (!sampleByCategory.has(cat)) sampleByCategory.set(cat, humanizeReason(r));
        }
      }
    }
    return Array.from(lendersByCategory.entries())
      .map(([cat, set]) => ({
        cat,
        count: set.size,
        sample: sampleByCategory.get(cat) ?? "",
      }))
      .sort((a, b) => b.count - a.count || a.cat.localeCompare(b.cat));
  }, [lenders]);

  const topCategories = categories.slice(0, 6);
  const presentCats = new Set(categories.map((c) => c.cat));

  // Operational Match Explanation — business-language bullets that combine
  // actual lender rejection categories with available lead/resolution facts.
  // Each bullet only renders when its source data exists. No invented facts.
  const explanation = useMemo(() => {
    const out: string[] = [];
    const countByCat = new Map(categories.map((c) => [c.cat, c.count] as const));

    // Relationship mismatch
    if (presentCats.has("relationship")) {
      const n = countByCat.get("relationship") ?? 0;
      const rel = lead.coapplicant_relation
        ? `"${formatDisplayLabel(lead.coapplicant_relation)}"`
        : "the selected co-applicant relation";
      out.push(
        `Co-applicant relationship mismatch: ${rel} is not accepted by ${n} active lender ${n === 1 ? "rule" : "rules"}.`,
      );
    }

    // Course level (UG / Bachelors)
    const cl = resolution?.course_level_derivation;
    const derivedLevel = cl && "derived" in cl ? (cl.derived ?? null) : null;
    const levelLower = (derivedLevel ?? "").toLowerCase();
    const isUG = levelLower.includes("bachelor") || levelLower === "ug" || levelLower.includes("under");
    if (isUG) {
      out.push(
        `Course level is ${formatDisplayLabel(derivedLevel)}. Active education-loan rules are often PG / Masters-focused for overseas study, which can reduce automated lender matches.`,
      );
    }

    // Healthcare / Nursing course category
    const courseBlob = `${lead.course_name ?? ""} ${lead.course_category ?? ""}`.toLowerCase();
    const isHealthcare = /nurs|health|medic|pharma/.test(courseBlob);
    if (isHealthcare) {
      const label = lead.course_category
        ? formatDisplayLabel(lead.course_category)
        : formatDisplayLabel(lead.course_name);
      out.push(
        `Course category is ${label}. If active lender coverage does not include this category, automated lender matching may fail.`,
      );
    }

    // Loan vs co-applicant income
    const loan = Number(lead.loan_amount_required);
    const inc = Number(lead.coapplicant_income);
    const loanIncomeFlag =
      Number.isFinite(loan) && loan > 0 && Number.isFinite(inc) && inc > 0 && loan / inc > 60;
    if (
      loanIncomeFlag ||
      presentCats.has("loan_amount") ||
      presentCats.has("coapp_income")
    ) {
      if (Number.isFinite(loan) && loan > 0 && Number.isFinite(inc) && inc > 0) {
        out.push(
          `Requested loan of ${formatINR(loan)} against co-applicant income of ${formatINR(inc)}/month is a difficult combination for automated lender thresholds — most rules expect stronger income support.`,
        );
      } else {
        out.push(
          "Requested loan amount appears high relative to co-applicant income — this can fail lender income / repayment-comfort checks.",
        );
      }
    }

    // Country coverage
    if (presentCats.has("country_geo") && lead.intended_study_country) {
      const n = countByCat.get("country_geo") ?? 0;
      out.push(
        `Destination country ${formatDisplayLabel(lead.intended_study_country)} is not in the coverage list of ${n} active lender ${n === 1 ? "rule" : "rules"}.`,
      );
    }

    // University coverage / premiere-list nuance
    const um = resolution?.university_match;
    if (um && (um.kind === "by_id" || um.kind === "fuzzy")) {
      const bits: string[] = [];
      if (um.global_rank != null) bits.push(`Rank #${um.global_rank}`);
      if (um.ranking_bucket) bits.push(formatDisplayLabel(um.ranking_bucket));
      const suffix = bits.length > 0 ? ` (${bits.join(" · ")})` : "";
      out.push(
        `University ${um.master_name}${suffix}: BRE may accept this profile, but lender-specific university coverage, premiere-list, or tier rules can still restrict automated matching.`,
      );
    }

    // Collateral route
    if (resolution?.collateral_state) {
      const route = formatDisplayLabel(resolution.collateral_state.replace("_review_needed", ""));
      out.push(
        `Collateral route is ${route}. Worth reviewing against each lender's collateral policy before manual discussion.`,
      );
    }

    // Combined summary (only if we actually produced multiple bullets)
    if (out.length >= 2) {
      const parts: string[] = [];
      if (derivedLevel) parts.push(formatDisplayLabel(derivedLevel));
      if (lead.course_category) parts.push(formatDisplayLabel(lead.course_category));
      else if (lead.course_name) parts.push(formatDisplayLabel(lead.course_name));
      if (lead.intended_study_country) parts.push(formatDisplayLabel(lead.intended_study_country));
      if (Number.isFinite(loan) && loan > 0) parts.push(`${formatINR(loan)} loan`);
      if (Number.isFinite(inc) && inc > 0) parts.push(`${formatINR(inc)}/month income`);
      if (lead.coapplicant_relation) parts.push(`${formatDisplayLabel(lead.coapplicant_relation)} co-applicant`);
      if (parts.length >= 2) {
        out.push(
          `Combined view: no active lender currently accepts this combination of ${parts.join(" + ")} under automated rules.`,
        );
      }
    }

    return out;
  }, [lead, resolution, categories, presentCats]);

  // Suggested next actions — only when a relevant category is present.
  const actions = useMemo(() => {
    const out: string[] = [];
    if (presentCats.has("relationship"))
      out.push("Check if a parent / spouse / sibling co-applicant can be added — many lenders restrict accepted relationships.");
    if (presentCats.has("coapp_income") || presentCats.has("loan_amount"))
      out.push("Consider reducing the requested loan amount, or add a higher-income co-applicant to clear lender income/EMI gates.");
    if (presentCats.has("country_geo") || presentCats.has("course"))
      out.push("Destination country / course may sit outside current lender coverage — manual lender discussion recommended.");
    if (presentCats.has("collateral"))
      out.push("Explore the alternate collateral route (secured ⇌ unsecured) if the profile supports it.");
    if (presentCats.has("coapp_cibil"))
      out.push("Improve / re-check co-applicant CIBIL, or add a co-applicant with a stronger bureau score.");
    if (presentCats.has("academics") || presentCats.has("student_age"))
      out.push("Verify academic marks and student age fields — small data corrections sometimes restore lender eligibility.");
    out.push("Review lender coverage / rules in BRE → Lender Rules if this profile should be commercially accepted.");
    return out;
  }, [presentCats]);

  const perLender = useMemo(
    () =>
      lenders
        .filter((l) => (l.reasons?.length ?? 0) > 0)
        .sort((a, b) => a.lender_name.localeCompare(b.lender_name)),
    [lenders],
  );

  if (lenders.length === 0 || activeRuleCount === 0) {
    return (
      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 flex gap-2">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          No active lender rules are configured. Please configure lender rules to enable automated matching.
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 space-y-4">
      <div className="flex gap-2">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-300" />
        <div className="text-xs text-amber-900 dark:text-amber-200">
          <div className="font-semibold mb-0.5">BRE Passed · No Automated Lender Match</div>
          <div>
            This profile cleared BRE scoring, but no active lender currently matches all
            lender-specific rules. Manual lender discussion may still be possible — review
            the rule gaps below.
          </div>
        </div>
      </div>

      {/* Block A — Primary lender-rule blockers (categorized) */}
      {topCategories.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-amber-900/80 dark:text-amber-200/80">
            Primary lender-rule blockers
          </div>
          <ul className="space-y-2">
            {topCategories.map(({ cat, count, sample }) => {
              const meta = CATEGORY_META[cat];
              return (
                <li key={cat} className="text-xs text-foreground flex items-start gap-2">
                  <Badge variant="outline" className="shrink-0 h-5 px-1.5 text-[10px] font-mono mt-0.5">
                    {count} {count === 1 ? "lender" : "lenders"}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{meta.label}</div>
                    <div className="mt-0.5 text-muted-foreground leading-relaxed">
                      {sample || meta.helper}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Block B — Operational match explanation (business-language reasoning) */}
      {explanation.length > 0 && (
        <div className="space-y-1.5 border-t border-amber-500/30 pt-3">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-amber-900/80 dark:text-amber-200/80">
            Operational Match Explanation
          </div>
          <ul className="space-y-1 text-xs text-foreground list-disc pl-4">
            {explanation.map((line, i) => (
              <li key={i} className="leading-relaxed">{line}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Block C — Suggested admin next actions */}
      {actions.length > 0 && (
        <div className="space-y-1.5 border-t border-amber-500/30 pt-3">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-amber-900/80 dark:text-amber-200/80">
            Suggested next actions
          </div>
          <ul className="space-y-1 text-xs text-foreground list-disc pl-4">
            {actions.map((a) => (
              <li key={a} className="leading-relaxed">{a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Block D — Per-lender details intentionally hidden from UI.
          Backend reasons remain available in result.eligible_lenders for debug/future use. */}
    </div>
  );
}

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
  if ("value" in b) {
    if (isEmploymentTypeParam(t.param_key)) return formatEmploymentLabel(b.value);
    return b.label ?? b.value;
  }
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
                    ) : isEmploymentTypeParam(t.param_key) ? (
                      formatEmploymentLabel(t.input)
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
  collateralState,
  displayRanking,
  rankModifiers,
}: {
  eligibleLenders: BreResult["eligible_lenders"];
  loanRange: BreResult["eligible_loan_range"];
  storedMatches: Map<string, StoredMatchValue>;
  scoringVersion: number | null;
  activeRuleCount: number;
  collateralState: "secured" | "secured_review_needed" | "unsecured" | null;
  displayRanking: Map<string, DisplayRankingOutput>;
  rankModifiers: Map<string, RankModifierResult>;
}) {
  // Keep live engine rank as the primary order. Adjusted display score is only
  // a deterministic tiebreaker when two lenders have the same engine rank.
  const ordered = [...eligibleLenders].sort((a, b) => {
    const ra = a.rank ?? Number.POSITIVE_INFINITY;
    const rb = b.rank ?? Number.POSITIVE_INFINITY;
    if (ra !== rb) return ra - rb;
    const da = displayRanking.get(a.lender_id)?.displayRank ?? Number.POSITIVE_INFINITY;
    const db = displayRanking.get(b.lender_id)?.displayRank ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return a.lender_code.localeCompare(b.lender_code);
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs text-muted-foreground">
          {ordered.length} {ordered.length === 1 ? "lender" : "lenders"} match this profile
        </div>
        {loanRange && (
          <div className="text-[11px] text-muted-foreground tabular-nums">
            {formatINR(loanRange.min)} – {formatINR(loanRange.max)}
          </div>
        )}
      </div>


      <ol className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {ordered.slice(0, 8).map((l, idx) => {
          return (
            <LenderCard
              key={l.lender_id}
              l={l}
              stored={storedMatches.get(l.lender_id) ?? null}
              displayPosition={idx + 1}
              collateralState={collateralState}
              ranking={displayRanking.get(l.lender_id) ?? null}
              rankModifier={rankModifiers.get(l.lender_id) ?? null}
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
  collateralState,
  ranking,
  rankModifier,
}: {
  l: BreResult["eligible_lenders"][number];
  stored: StoredMatchValue | null;
  displayPosition: number;
  collateralState: "secured" | "secured_review_needed" | "unsecured" | null;
  ranking: DisplayRankingOutput | null;
  rankModifier: RankModifierResult | null;
}) {
  const isSecured = l.product_type === "secured";
  const isUnsecured = l.product_type === "unsecured";

  // Visible serial badge — always reflects the current visible order (#1, #2, #3, ...).
  // Stored recommendation_rank is not used for the visible order; this avoids stale
  // saved rows showing a different first lender than the live BRE engine.
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

  // Phase 2 — show "Collateral review needed" chip only when this card actually
  // uses the secured route AND the lead recorded collateral_available=true with
  // no notes. Never invented; never shown for unsecured cards.
  const showCollateralReviewChip =
    isSecured && collateralState === "secured_review_needed";

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
        <div className="flex items-center gap-1.5 shrink-0">
          <RiskBandBadge band={l.lender_risk_band ?? null} />
          <FitBadge badge={l.badge} storedFit={stored?.fit ?? null} liveFit={ranking?.fitLabel ?? null} />
        </div>
      </div>

      {/* Lender-specific score (Layer 2 — additive, display only) */}
      {typeof l.lender_specific_score === "number" && (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-muted-foreground">
            {l.lender_name}-specific score:
          </span>
          <span className="font-semibold text-foreground tabular-nums">
            {Math.round(l.lender_specific_score)}/100
          </span>
          <ProvenancePill tag={l.scorecard_provenance ?? null} />
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center text-muted-foreground hover:text-foreground"
                  aria-label="What is the lender-specific score?"
                >
                  <Info className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs leading-snug">
                This score is calculated using this lender's own scorecard.
                Different lenders may weigh academics, income, collateral,
                university/course, and loan fit differently. This is separate
                from the Global BRE score.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {/* Primary visible rate: source-backed route ROI range from the lender sheet.
          Indicative midpoint (formerly "Projected ROI") is shown as a smaller
          secondary line. Effective ROI, if available, is surfaced only inside
          the midpoint tooltip as informational text — never as a visible chip. */}
      {hasRoiRange && (
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {l.roi_range_source === "secured"
              ? "Secured Loan ROI"
              : l.roi_range_source === "unsecured"
              ? "Unsecured Loan ROI"
              : "ROI Range"}
          </span>
          <span className="text-base font-semibold text-foreground tabular-nums">
            {l.roi_range_min}% – {l.roi_range_max}%
          </span>
          {showCollateralReviewChip && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-amber-500/40 text-amber-700 dark:text-amber-300"
            >
              Collateral review needed
            </Badge>
          )}
        </div>
      )}

      {(l.risk_based_indicative_roi != null || l.projected_rate != null) && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {l.risk_based_indicative_roi != null ? (
            <span>
              Profile-based indicative ROI:{" "}
              <span className="font-medium tabular-nums text-foreground">
                ~{round2(l.risk_based_indicative_roi)}%
              </span>
            </span>
          ) : (
            <span>
              Indicative midpoint:{" "}
              <span className="font-medium tabular-nums text-foreground">~{l.projected_rate}%</span>
            </span>
          )}
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center text-muted-foreground hover:text-foreground"
                  aria-label="About indicative ROI"
                >
                  <Info className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                {l.risk_based_indicative_roi != null ? (
                  <p>
                    Calculated within the source-backed ROI range using lender-specific risk
                    factors. This is not a final lender offer.
                  </p>
                ) : (
                  <p>
                    Calculated as the midpoint of the selected route ROI range. Use the
                    source-backed ROI range for decisioning. Final lender offer may vary.
                  </p>
                )}
                {l.risk_based_indicative_roi != null && l.projected_rate != null && (
                  <p className="mt-1.5 opacity-90">
                    Simple midpoint reference: ~{l.projected_rate}%.
                  </p>
                )}
                {l.effective_rate_min != null && l.effective_rate_max != null && (
                  <p className="mt-1.5 opacity-90">
                    Effective ROI from lender sheet, for reference only:{" "}
                    {l.effective_rate_min}% – {l.effective_rate_max}%.
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {/* Secondary metrics row — loan amount, PF, route badges. ROI chips intentionally
          removed: the source-backed route ROI is now the primary visible value above. */}
      <div className="flex flex-wrap items-center gap-1.5">

        {l.projected_loan_amount != null && (
          <Chip
            icon={<IndianRupee className="h-3 w-3" />}
            label={formatINR(Math.round(l.projected_loan_amount))}
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

      {/* Phase 2 — university rank impact (display-only).
          Shows the resolved rank/band, the loan/rate modifier, base → adjusted
          projected loan, base → adjusted projected rate, and any clamp applied.
          Does NOT change ordering, eligibility, or engine output. */}
      {rankModifier && <RankImpactPanel mod={rankModifier} />}

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

      {/* Phase 3 rationale chips — only real factors derived from live ranking */}
      {ranking && ranking.rationale.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {ranking.rationale.map((r) => (
            <span
              key={r}
              className="inline-flex items-center rounded-md border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[10px] text-foreground/80"
            >
              {r}
            </span>
          ))}
        </div>
      )}

      {/* Lender-specific rationale chips (Layer 2) — deduped against existing chips */}
      <LenderSpecificRationaleChips
        chips={l.lender_specific_rationale ?? l.lender_rationale_chips ?? []}
        existingPhase3={ranking?.rationale ?? []}
        coverageCount={coverageItems.length}
        loanFitsRange={l.projected_loan_amount != null && l.projected_loan_amount > 0}
        showCollateralReviewChip={showCollateralReviewChip}
      />

      {/* Recommendation rationale — bullets shown only when backed by real data */}
      <RecommendationRationale
        storedReason={stored?.reason ?? null}
        projectedLoanAmount={l.projected_loan_amount}
        productType={l.product_type}
        coverageCount={coverageItems.length}
        processingTimeDays={stored?.processingTimeDays ?? null}
      />

      {/* Score breakdown — collapsible, collapsed by default */}
      {Array.isArray(l.score_breakdown) && l.score_breakdown.length > 0 && (
        <ScoreBreakdown
          rows={l.score_breakdown}
          lenderName={l.lender_name}
          lenderCode={l.lender_code}
          score={l.lender_specific_score ?? null}
          riskBand={l.lender_risk_band ?? null}
          provenance={l.scorecard_provenance ?? null}
          version={l.scorecard_version ?? null}
        />
      )}
    </li>
  );
}

function RankImpactPanel({ mod }: { mod: RankModifierResult }) {
  const baseLoan = mod.baseProjectedLoan;
  const adjLoan = mod.adjustedProjectedLoan;
  const baseRate = mod.baseProjectedRate;
  const adjRate = mod.adjustedProjectedRate;
  const changedLoan = baseLoan != null && adjLoan != null && adjLoan !== baseLoan;
  const changedRate = baseRate != null && adjRate != null && adjRate !== baseRate;

  const fmtMoney = (n: number | null | undefined) =>
    n == null ? "—" : formatINR(Math.round(n));
  const fmtRate = (n: number | null | undefined) => (n == null ? "—" : `${n}%`);

  const loanPctLabel =
    mod.loanModifierPct === 0
      ? "0%"
      : `${mod.loanModifierPct > 0 ? "+" : ""}${(mod.loanModifierPct * 100).toFixed(0)}%`;
  const ratePctLabel =
    mod.rateModifierPct === 0
      ? "0.00%"
      : `${mod.rateModifierPct > 0 ? "+" : ""}${mod.rateModifierPct.toFixed(2)}%`;

  // If neither rate nor loan moves AND there's no clamp, still surface the
  // band/rank (e.g. Tier 5 = no adjustment) so admins can see why nothing changed.
  return (
    <div className="rounded-md border border-sky-500/25 bg-sky-500/5 p-2 space-y-1.5">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground tabular-nums">
        <div>
          Loan: {fmtMoney(baseLoan)}
          {changedLoan ? (
            <>
              {" "}→ <span className="text-foreground font-medium">{fmtMoney(adjLoan)}</span>
            </>
          ) : (
            <span className="ml-1 italic">no change</span>
          )}
        </div>
        <div>
          Rate: {fmtRate(baseRate)}
          {changedRate ? (
            <>
              {" "}→ <span className="text-foreground font-medium">{fmtRate(adjRate)}</span>
            </>
          ) : (
            <span className="ml-1 italic">no change</span>
          )}
        </div>
      </div>
      <div className="text-[10px] text-muted-foreground italic">{mod.explanation}</div>
    </div>
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
      `Loan amount ${formatINR(Math.round(projectedLoanAmount))} fits lender range`,
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
  liveFit,
}: {
  badge: BreResult["eligible_lenders"][number]["badge"];
  storedFit: "best_fit" | "good_fit" | "backup" | null;
  liveFit: "best_fit" | "good_fit" | "backup" | null;
}) {
  // Phase 3 — live displayScore-derived fit label wins when available.
  // Falls back to stored fit_category, then to engine badge.
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
  const key: keyof typeof map | null =
    liveFit ?? storedFit ?? (badge ? engineMap[badge] : null);
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
    return `PF: ${formatINR(Math.round(l.pf_flat))}${gst}`;
  }
  return null;
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
    const formatBand = (b: string | null | undefined): string | null => {
      if (!b) return null;
      if (b === "premium") return "Premium";
      if (b === "unranked") return "Unranked";
      const m = /^tier_(\d+)$/.exec(b);
      return m ? `Tier ${m[1]}` : b;
    };

    if (um.kind === "fuzzy" || um.kind === "by_id") {
      const u = um as Extract<typeof um, { kind: "fuzzy" | "by_id" }>;
      const bandLabel = formatBand(u.effective_band ?? u.rank_band);
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

// ============================================================================
// Layer 2 — Lender-specific BRE display helpers (UI-only, additive).
// No mutation of engine output, ranking, fit, or stored data.
// ============================================================================

type ProvTag = "source_backed" | "inferred" | "proposed" | "needs_business_validation";

function ProvenancePill({ tag }: { tag: ProvTag | null | undefined }) {
  if (!tag) return null;
  const map: Record<ProvTag, { label: string; cls: string }> = {
    source_backed: {
      label: "Source-backed",
      cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    },
    inferred: {
      label: "Inferred",
      cls: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    },
    proposed: {
      label: "Proposed",
      cls: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    },
    needs_business_validation: {
      label: "Needs validation",
      cls: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    },
  };
  const m = map[tag];
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0 text-[10px] ${m.cls}`}>
      {m.label}
    </span>
  );
}

function RiskBandBadge({
  band,
}: {
  band: BreResult["eligible_lenders"][number]["lender_risk_band"] | null;
}) {
  if (!band) return null;
  const map = {
    "Low Risk": "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    "Medium Risk": "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    "High Risk": "border-destructive/40 bg-destructive/10 text-destructive",
    "Needs Review": "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
    "Not Eligible": "border-destructive/40 bg-destructive/10 text-destructive",
  } as const;
  const cls = map[band as keyof typeof map] ?? map["Needs Review"];
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${cls}`}>
      {band}
    </Badge>
  );
}

function LenderSpecificRationaleChips({
  chips,
  existingPhase3,
  coverageCount,
  loanFitsRange,
  showCollateralReviewChip,
}: {
  chips: Array<{
    key: string;
    label: string;
    tone: "positive" | "neutral" | "negative";
    provenance: ProvTag;
  }>;
  existingPhase3: string[];
  coverageCount: number;
  loanFitsRange: boolean;
  showCollateralReviewChip: boolean;
}) {
  if (!chips || chips.length === 0) return null;

  // Build dedup set: normalized labels of chips/bullets already shown elsewhere.
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const taken = new Set<string>();
  existingPhase3.forEach((r) => taken.add(norm(r)));
  if (loanFitsRange) taken.add(norm("Loan amount fits lender range"));
  if (coverageCount > 0) taken.add(norm(`Covers ${coverageCount} expense categories`));
  if (showCollateralReviewChip) taken.add(norm("Collateral review needed"));

  const filtered = chips.filter((c) => !taken.has(norm(c.label)));
  if (filtered.length === 0) return null;

  const toneCls: Record<"positive" | "neutral" | "negative", string> = {
    positive: "border-emerald-500/30 bg-emerald-500/5 text-foreground/90",
    neutral: "border-border bg-muted/40 text-foreground/80",
    negative: "border-destructive/30 bg-destructive/5 text-foreground/90",
  };

  return (
    <div className="space-y-1 pt-0.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        Lender-specific factors
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {filtered.map((c) => (
          <span
            key={c.key}
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] ${toneCls[c.tone]}`}
            title={c.provenance.replace(/_/g, " ")}
          >
            {c.label}
            <ProvenancePill tag={c.provenance} />
          </span>
        ))}
      </div>
    </div>
  );
}

const FACTOR_LABELS: Record<string, string> = {
  academics: "Academics",
  backlogs: "Backlogs",
  university_course: "University / course",
  cibil: "CIBIL",
  income: "Income",
  emi_foir: "EMI / FOIR",
  income_stability: "Income stability",
  collateral_route: "Collateral / route",
  loan_amount_fit: "Loan amount fit",
  coverage: "Coverage",
  processing_ops: "Processing / ops",
};

function ScoreBreakdown({
  rows,
  lenderName,
  lenderCode,
  score,
  riskBand,
  provenance,
  version,
}: {
  rows: NonNullable<BreResult["eligible_lenders"][number]["score_breakdown"]>;
  lenderName: string;
  lenderCode: string;
  score: number | null;
  riskBand: BreResult["eligible_lenders"][number]["lender_risk_band"] | null;
  provenance: ProvTag | null;
  version: string | null;
}) {
  const [open, setOpen] = useState(false);
  // seeds.ts is a fallback only — used here for display label/notes when DB
  // scorecard metadata isn't surfaced in the result object yet.
  const seed = getSeedForLender(lenderCode);
  const totalWeighted = rows.reduce((sum, r) => sum + (r.weighted ?? 0), 0);
  return (
    <div className="pt-0.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        aria-expanded={open}
      >
        {open ? "Hide" : "View"} how this lender score was calculated
      </button>
      {open && (
        <div className="mt-1.5 rounded-md border border-border bg-muted/20 overflow-hidden">
          {/* Summary header */}
          <div className="px-2.5 py-2 bg-muted/40 border-b border-border space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap text-[11px]">
              <span className="text-muted-foreground">{lenderName}-specific score:</span>
              {score != null && (
                <span className="font-semibold text-foreground tabular-nums">
                  {Math.round(score)}/100
                </span>
              )}
              <RiskBandBadge band={riskBand} />
              <ProvenancePill tag={provenance} />
            </div>
            <div className="text-[10px] text-muted-foreground">
              Scorecard: <span className="text-foreground/80">{seed.display_label}</span>
              {version ? <span className="ml-1 font-mono">· v{version}</span> : null}
            </div>
            {seed.notes && (
              <div className="text-[10px] text-muted-foreground italic">{seed.notes}</div>
            )}
            <div className="text-[10px] text-muted-foreground leading-snug pt-1 border-t border-border/60">
              Global BRE checks base eligibility. This lender-specific score
              shows how this profile fits this lender's own scorecard.
            </div>
          </div>
          <table className="w-full text-[11px]">
            <thead className="bg-muted/30 text-muted-foreground">
              <tr>
                <th className="text-left px-2 py-1 font-medium">Factor</th>
                <th className="text-right px-2 py-1 font-medium">Weight</th>
                <th className="text-right px-2 py-1 font-medium">Score</th>
                <th className="text-right px-2 py-1 font-medium">Weighted</th>
                <th className="text-left px-2 py-1 font-medium">Reason</th>
                <th className="text-left px-2 py-1 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.factor} className="border-t border-border/60">
                  <td className="px-2 py-1 text-foreground/90">
                    {FACTOR_LABELS[r.factor] ?? r.factor}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">
                    {r.weight}%
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">{Math.round(r.raw_score)}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">
                    {round2(r.weighted)}
                  </td>
                  <td className="px-2 py-1 text-muted-foreground">{r.note ?? "—"}</td>
                  <td className="px-2 py-1">
                    <ProvenancePill tag={r.provenance} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-muted/30">
                <td className="px-2 py-1 text-[10px] text-muted-foreground" colSpan={3}>
                  Total = sum of weighted contributions
                </td>
                <td className="px-2 py-1 text-right tabular-nums font-semibold text-foreground">
                  {round2(totalWeighted)}
                </td>
                <td className="px-2 py-1" colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
