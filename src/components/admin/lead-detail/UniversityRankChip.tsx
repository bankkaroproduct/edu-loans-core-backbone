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

// Approved cutoffs — must mirror globalRankToBand() in src/lib/bre/leadProfile.ts.
function deriveBandFromRank(rank: number): string {
  if (rank <= 10) return "premium";
  if (rank <= 50) return "tier_1";
  if (rank <= 100) return "tier_2";
  if (rank <= 200) return "tier_3";
  if (rank <= 300) return "tier_4";
  if (rank <= 500) return "tier_5";
  if (rank <= 750) return "tier_6";
  if (rank <= 1000) return "tier_7";
  if (rank <= 1200) return "tier_8";
  if (rank <= 1400) return "tier_9";
  return "tier_10";
}

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
  const { global_rank, rank_band } = info;
  if (global_rank == null && !rank_band) return null;

  // Global Rank is source of truth — derive tier from it when present.
  const effectiveBand = global_rank != null ? deriveBandFromRank(global_rank) : rank_band;

  const parts: string[] = [];
  if (global_rank != null) parts.push(`Rank #${global_rank}`);
  if (effectiveBand) parts.push(BAND_LABEL[effectiveBand] ?? effectiveBand);

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
