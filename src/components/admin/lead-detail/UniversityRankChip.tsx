// Read-only ranking chip shown next to the University field on Admin Lead
// Detail. Renders nothing when the lead has no resolvable university or when
// no rank data exists. Phase 1 visibility only — no engine logic here.
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface RankInfo {
  global_rank: number | null;
  rank_band: string | null;
  rank_score: number | null;
}

const BAND_LABEL: Record<string, string> = {
  premium: "Premium",
  tier_1: "Tier 1",
  tier_2: "Tier 2",
  tier_3: "Tier 3",
  tier_4: "Tier 4",
  tier_5: "Tier 5",
  tier_6: "Tier 6",
  tier_7: "Tier 7",
  tier_8: "Tier 8",
  tier_9: "Tier 9",
  tier_10: "Tier 10",
  unranked: "Unranked",
};

export function UniversityRankChip({ universityId }: { universityId: string | null | undefined }) {
  const [info, setInfo] = useState<RankInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!universityId) {
      setInfo(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("universities_master")
        .select("global_rank, rank_band, rank_score")
        .eq("id", universityId)
        .maybeSingle();
      if (cancelled) return;
      setInfo((data as RankInfo) ?? null);
    })();
    return () => { cancelled = true; };
  }, [universityId]);

  if (!info) return null;
  const { global_rank, rank_band, rank_score } = info;
  // Hide when no rank data at all.
  if (global_rank == null && !rank_band && rank_score == null) return null;

  const parts: string[] = [];
  if (global_rank != null) parts.push(`Rank #${global_rank}`);
  if (rank_band) parts.push(BAND_LABEL[rank_band] ?? rank_band);
  if (rank_score != null) parts.push(`Score ${rank_score}`);

  return (
    <Badge
      variant="outline"
      className="mt-1 text-[10px] font-medium border-primary/30 bg-primary/5 text-primary"
      title="University ranking from master data"
    >
      {parts.join(" · ")}
    </Badge>
  );
}
