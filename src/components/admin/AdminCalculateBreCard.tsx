import { useState } from "react";
import { Calculator, Loader2, AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { evaluate } from "@/lib/bre/engine";
import { loadActive } from "@/lib/bre/loader";
import { buildBreProfileFromLead } from "@/lib/bre/leadProfile";
import type { BreResult } from "@/lib/bre/types";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"student_leads">;

/**
 * Admin-only card: Calculate BRE on demand for a single lead.
 *
 * - Builds a `BreProfileInput` from the lead's stored fields (no fabrication).
 * - Loads the currently active BRE scoring config + active lender rules.
 * - Runs the same `evaluate()` engine the BRE Simulator uses.
 * - Renders the real eligibility status, overall band, eligible loan / rate
 *   ranges, and ranked eligible lenders.
 * - If the lead is missing fields the engine needs, surfaces an honest
 *   "incomplete data" warning instead of inventing values.
 *
 * IMPORTANT: This action does NOT write anything to the database — it does not
 * touch `lead_lender_matches`, does not change the manually assigned lender,
 * and does not alter lead status. It is a read-only recommendation view.
 */
export function AdminCalculateBreCard({ lead }: { lead: Lead }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BreResult | null>(null);
  const [missing, setMissing] = useState<{ field: string; label: string }[]>([]);
  const [scoringVersion, setScoringVersion] = useState<number | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    try {
      const { profile, missing: missingFields } = buildBreProfileFromLead(lead);
      setMissing(missingFields);

      const { cfg, rules } = await loadActive();
      const r = evaluate(profile, cfg, rules);
      setResult(r);
      setScoringVersion(cfg.version_number);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`BRE evaluation failed: ${msg}`);
    } finally {
      setRunning(false);
    }
  };

  const eligibleLenders = result?.eligible_lenders.filter((l) => l.eligible) ?? [];

  const statusVariant = (() => {
    if (!result) return "secondary" as const;
    switch (result.eligibility_status) {
      case "Approved":
        return "default" as const;
      case "Approved with conditions":
        return "secondary" as const;
      case "Borderline":
        return "outline" as const;
      case "Rejected":
        return "destructive" as const;
    }
  })();

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Calculator className="h-4 w-4" /> Calculate BRE
        </h3>
        <Button size="sm" onClick={handleRun} disabled={running}>
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
          {result ? "Re-run" : "Calculate"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Runs the active BRE engine against this lead's stored data. Read-only — does not change the assigned lender.
      </p>

      {result && (
        <div className="space-y-3 pt-2">
          {missing.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-900 dark:text-amber-200 flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">Incomplete data — result may be conservative.</div>
                <div className="mt-0.5">
                  Missing on lead: {missing.map((m) => m.label).join(", ")}. Engine treated unknown bands as 0; reasons below reflect real engine output.
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={statusVariant}>{result.eligibility_status}</Badge>
            <span className="text-xs text-muted-foreground">
              Score <span className="font-mono text-foreground">{result.overall_score}</span>
              {result.overall_band && (
                <>
                  {" "}
                  · Band <span className="font-mono text-foreground">{result.overall_band.band}</span>
                </>
              )}
              {scoringVersion != null && (
                <>
                  {" "}
                  · Config v<span className="font-mono">{scoringVersion}</span>
                </>
              )}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <BucketStat label="Student" value={result.buckets.student.total} passes={result.buckets.student.passes} />
            <BucketStat label="University" value={result.buckets.university.total} passes={result.buckets.university.passes} />
            <BucketStat label="Co-applicant" value={result.buckets.coapplicant.total} passes={result.buckets.coapplicant.passes} />
          </div>

          {result.eligible_loan_range && (
            <div className="text-xs text-muted-foreground">
              Eligible loan: ₹{result.eligible_loan_range.min.toLocaleString("en-IN")} – ₹
              {result.eligible_loan_range.max.toLocaleString("en-IN")}
              {result.indicative_rate_range && (
                <>
                  {" "}
                  · Indicative rate: {result.indicative_rate_range.min}% – {result.indicative_rate_range.max}%
                </>
              )}
            </div>
          )}

          {result.rejection_reasons.length > 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive space-y-1">
              {result.rejection_reasons.slice(0, 6).map((r, i) => (
                <div key={i}>• {r}</div>
              ))}
            </div>
          )}

          {eligibleLenders.length > 0 ? (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-foreground">Eligible lenders ({eligibleLenders.length})</div>
              <ol className="space-y-1.5">
                {eligibleLenders.slice(0, 8).map((l) => (
                  <li
                    key={l.lender_id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-muted-foreground">#{l.rank ?? "—"}</span>
                      <span className="font-medium text-foreground truncate">{l.lender_name}</span>
                      {l.badge && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {l.badge.replace("_", " ")}
                        </Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground tabular-nums">
                      {l.projected_rate != null && <>{l.projected_rate}%</>}
                      {l.projected_loan_amount != null && (
                        <>
                          {" "}
                          · ₹{Math.round(l.projected_loan_amount).toLocaleString("en-IN")}
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No eligible lenders for this profile.</p>
          )}
        </div>
      )}
    </div>
  );
}

function BucketStat({ label, value, passes }: { label: string; value: number; passes: boolean }) {
  return (
    <div
      className={`rounded-md border px-2 py-1.5 ${
        passes ? "border-border/60 bg-muted/30" : "border-destructive/30 bg-destructive/5"
      }`}
    >
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-mono ${passes ? "text-foreground" : "text-destructive"}`}>{value}</div>
    </div>
  );
}
