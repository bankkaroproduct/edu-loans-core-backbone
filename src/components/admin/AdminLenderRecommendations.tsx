import { useEffect, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Admin-only panel: shows lender recommendations for a lead, with a
 * "Premiere" pill next to lenders whose `bre_output_json.is_premiere`
 * is true. This component MUST stay under src/components/admin/* and
 * MUST NOT be imported into any partner- or student-facing screen —
 * the premiere flag is competitive intel.
 */

type Row = {
  id: string;
  lender_id: string;
  recommendation_rank: number | null;
  fit_category: string | null;
  recommendation_reason_summary: string | null;
  bre_output_json: { is_premiere?: boolean } | null;
  lender: { lender_name: string; lender_code: string } | null;
};

export function AdminLenderRecommendations({ leadId }: { leadId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("lead_lender_matches")
        .select(
          "id, lender_id, recommendation_rank, fit_category, recommendation_reason_summary, bre_output_json, lender:lenders(lender_name, lender_code)",
        )
        .eq("lead_id", leadId)
        .order("recommendation_rank", { ascending: true });
      if (cancelled) return;
      setRows((data ?? []) as unknown as Row[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Lender Recommendations
        </h3>
        <span className="text-xs text-muted-foreground">
          {rows.length} eligible
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading recommendations…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          No lender matches generated yet for this lead.
        </p>
      ) : (
        <ol className="space-y-2">
          {rows.map((r) => {
            const isPremiere = r.bre_output_json?.is_premiere === true;
            return (
              <li
                key={r.id}
                className="flex items-start justify-between gap-3 rounded-md border border-border/60 px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-muted-foreground">
                      #{r.recommendation_rank ?? "—"}
                    </span>
                    <span className="text-sm font-medium text-foreground truncate">
                      {r.lender?.lender_name ?? "Unknown lender"}
                    </span>
                    {isPremiere && (
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
                            This lender has premium consideration for this
                            institution.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {r.fit_category && (
                      <Badge variant="secondary" className="text-[10px]">
                        {r.fit_category.replace("_", " ")}
                      </Badge>
                    )}
                  </div>
                  {r.recommendation_reason_summary && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {r.recommendation_reason_summary}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
