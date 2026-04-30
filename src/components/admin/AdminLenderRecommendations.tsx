import { useEffect, useState } from "react";
import { Sparkles, Loader2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { evaluate } from "@/lib/bre/engine";
import { loadActive } from "@/lib/bre/loader";
import { buildBreProfileFromLeadAsync } from "@/lib/bre/leadProfile";
import type { Tables } from "@/integrations/supabase/types";

/**
 * Admin-only panel: shows lender recommendations for a lead.
 *
 * Strict gating rules (intentional, do NOT relax):
 *  1. Profile basis — required BRE-input fields must be present on the lead.
 *  2. Document readiness — the lead must have at least one uploaded document
 *     so recommendations are not shown before any evidence exists.
 *  3. Real indicative rate % — only lenders whose live BRE evaluation yields a
 *     real `projected_rate` are rendered. Rows with no rate are dropped.
 *  4. Locked rows are NOT force-shown here — Assign Lender already surfaces
 *     locked manual assignments. A locked row only appears here if it also
 *     has a real indicative rate from the live BRE evaluation.
 *
 * If gating fails OR no lender survives the rate filter, render the subtle
 * completion prompt instead of an empty / `—` list.
 */

type Row = {
  id: string;
  lender_id: string;
  recommendation_rank: number | null;
  fit_category: string | null;
  recommendation_reason_summary: string | null;
  bre_output_json: { is_premiere?: boolean } | null;
  lock_status: boolean | null;
  lender: { lender_name: string; lender_code: string } | null;
};

type Lead = Tables<"student_leads">;

interface DisplayRow {
  key: string;
  lenderId: string;
  lenderName: string;
  rank: number | null;
  fitCategory: string | null;
  reason: string | null;
  isPremiere: boolean;
  isLocked: boolean;
  projectedRate: number;
}

export function AdminLenderRecommendations({ leadId }: { leadId: string }) {
  const [rows, setRows] = useState<DisplayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [gateReason, setGateReason] = useState<"profile" | "documents" | "no_rate" | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setGateReason(null);

      // 1. Pull lead + persisted matches + document count in parallel.
      const [leadRes, matchRes, docRes] = await Promise.all([
        supabase.from("student_leads").select("*").eq("id", leadId).maybeSingle(),
        supabase
          .from("lead_lender_matches")
          .select(
            "id, lender_id, recommendation_rank, fit_category, recommendation_reason_summary, bre_output_json, lock_status, lender:lenders(lender_name, lender_code)",
          )
          .eq("lead_id", leadId)
          .order("recommendation_rank", { ascending: true }),
        supabase
          .from("lead_documents")
          .select("id", { count: "exact", head: true })
          .eq("lead_id", leadId)
          .eq("is_latest", true),
      ]);

      if (cancelled) return;
      const lead = leadRes.data as Lead | null;
      const persisted = (matchRes.data ?? []) as unknown as Row[];
      const docCount = docRes.count ?? 0;

      if (!lead) {
        setRows([]);
        setLoading(false);
        return;
      }

      // Gate 1: profile basis — use the same `missing` list the BRE Calculate
      // card surfaces. If any required field is missing, hide the block.
      const { profile, missing } = await buildBreProfileFromLeadAsync(lead);
      if (missing.length > 0) {
        setGateReason("profile");
        setRows([]);
        setLoading(false);
        return;
      }

      // Gate 2: document readiness. No uploaded documents → no credible basis.
      if (docCount === 0) {
        setGateReason("documents");
        setRows([]);
        setLoading(false);
        return;
      }

      // Gate 3: live BRE evaluation → real indicative rates per lender.
      let rateByLenderId = new Map<string, number>();
      try {
        const { cfg, rules } = await loadActive();
        const result = evaluate(profile, cfg, rules);
        for (const l of result.eligible_lenders) {
          if (l.eligible && l.projected_rate != null) {
            rateByLenderId.set(l.lender_id, l.projected_rate);
          }
        }
      } catch {
        rateByLenderId = new Map();
      }
      if (cancelled) return;

      // Map persisted rows → display rows, dropping any without a real rate.
      // Locked rows follow the same rule: shown only if they have a real rate.
      const display: DisplayRow[] = persisted
        .map((r): DisplayRow | null => {
          const rate = rateByLenderId.get(r.lender_id);
          if (rate == null) return null;
          return {
            key: r.id,
            lenderId: r.lender_id,
            lenderName: r.lender?.lender_name ?? "Unknown lender",
            rank: r.recommendation_rank,
            fitCategory: r.fit_category,
            reason: r.recommendation_reason_summary,
            isPremiere: r.bre_output_json?.is_premiere === true,
            isLocked: r.lock_status === true,
            projectedRate: rate,
          };
        })
        .filter((x): x is DisplayRow => x !== null);

      if (display.length === 0) {
        setGateReason("no_rate");
      }
      setRows(display);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  const emptyCopy =
    gateReason === "profile"
      ? "Complete the lead profile to evaluate lender fit."
      : gateReason === "documents"
      ? "Upload at least one document to evaluate lender fit."
      : gateReason === "no_rate"
      ? "No active lender currently produces an indicative rate for this profile."
      : "Upload documents and complete the profile to assess lender fit and indicative rate.";

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Lender Recommendations
        </h3>
        {!loading && rows.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {rows.length} {rows.length === 1 ? "lender" : "lenders"}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading recommendations">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 rounded-md bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex items-start gap-2 text-sm text-muted-foreground py-2">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <p>{emptyCopy}</p>
        </div>
      ) : (
        <ol className="space-y-2">
          {rows.map((r) => (
            <RecommendationRow key={r.key} row={r} />
          ))}
        </ol>
      )}

      {/* gateReason is intentionally not surfaced as separate copy — the single
          subtle prompt above is the agreed UX for all gated states. */}
      <span className="hidden" data-gate-reason={gateReason ?? "ok"} />
    </div>
  );
}

function RecommendationRow({ row: r }: { row: DisplayRow }) {
  const [expanded, setExpanded] = useState(false);
  const reasonIsLong = (r.reason?.length ?? 0) > 140;

  return (
    <li className="flex items-start justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="inline-flex h-5 min-w-[1.5rem] items-center justify-center rounded bg-muted px-1.5 text-[11px] font-mono font-semibold text-foreground"
            aria-label={`Rank ${r.rank ?? "unranked"}`}
          >
            {r.rank != null ? `#${r.rank}` : "—"}
          </span>
          <span className="text-sm font-medium text-foreground truncate" title={r.lenderName}>
            {r.lenderName}
          </span>
          {r.isPremiere && (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 gap-1 px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide"
                  >
                    <Sparkles className="h-3 w-3" />
                    Premiere
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top">
                  This lender has premium consideration for this institution.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {r.fitCategory && (
            <Badge variant="secondary" className="text-[10px]">
              {r.fitCategory.replace("_", " ")}
            </Badge>
          )}
          {r.isLocked && (
            <Badge variant="outline" className="text-[10px]">
              locked
            </Badge>
          )}
        </div>
        {r.reason && (
          <div className="text-xs text-muted-foreground">
            <p className={expanded ? "" : "line-clamp-2"}>{r.reason}</p>
            {reasonIsLong && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-0.5 text-[11px] font-medium text-primary hover:underline"
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-semibold tabular-nums text-foreground">
          {r.projectedRate}%
        </div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">rate</div>
      </div>
    </li>
  );
}
