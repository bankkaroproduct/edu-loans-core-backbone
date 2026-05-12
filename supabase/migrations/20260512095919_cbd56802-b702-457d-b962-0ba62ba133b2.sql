-- Phase 1: University ranking columns on universities_master.
-- Strictly additive and nullable. No existing column is altered. No data is touched.

ALTER TABLE public.universities_master
  ADD COLUMN IF NOT EXISTS global_rank      integer,
  ADD COLUMN IF NOT EXISTS rank_band        text,
  ADD COLUMN IF NOT EXISTS rank_score       integer,
  ADD COLUMN IF NOT EXISTS rank_source      text,
  ADD COLUMN IF NOT EXISTS rank_imported_at timestamptz,
  ADD COLUMN IF NOT EXISTS rank_notes       text;

COMMENT ON COLUMN public.universities_master.global_rank      IS 'Exact world ranking (Phase 1). Null = no rank assigned.';
COMMENT ON COLUMN public.universities_master.rank_band        IS '11-tier band: premium | tier_1..tier_10 | unranked. Derived from global_rank.';
COMMENT ON COLUMN public.universities_master.rank_score       IS 'BRE score 0-100 derived from rank_band (cached for fast filter/display).';
COMMENT ON COLUMN public.universities_master.rank_source      IS 'Provenance tag, e.g. eduloans_master_v1_2026_05.';
COMMENT ON COLUMN public.universities_master.rank_imported_at IS 'When the ranking row was last imported/refreshed.';
COMMENT ON COLUMN public.universities_master.rank_notes       IS 'Optional free-text note from the import (e.g. range/cleaning).';

-- Sanity constraints (non-blocking for nulls).
ALTER TABLE public.universities_master
  DROP CONSTRAINT IF EXISTS universities_master_rank_band_check;
ALTER TABLE public.universities_master
  ADD CONSTRAINT universities_master_rank_band_check
  CHECK (rank_band IS NULL OR rank_band IN (
    'premium','tier_1','tier_2','tier_3','tier_4','tier_5','tier_6','tier_7','tier_8','tier_9','tier_10','unranked'
  ));

ALTER TABLE public.universities_master
  DROP CONSTRAINT IF EXISTS universities_master_rank_score_check;
ALTER TABLE public.universities_master
  ADD CONSTRAINT universities_master_rank_score_check
  CHECK (rank_score IS NULL OR (rank_score BETWEEN 0 AND 100));

ALTER TABLE public.universities_master
  DROP CONSTRAINT IF EXISTS universities_master_global_rank_check;
ALTER TABLE public.universities_master
  ADD CONSTRAINT universities_master_global_rank_check
  CHECK (global_rank IS NULL OR global_rank >= 1);

CREATE INDEX IF NOT EXISTS idx_universities_master_global_rank ON public.universities_master(global_rank);
CREATE INDEX IF NOT EXISTS idx_universities_master_rank_band   ON public.universities_master(rank_band);