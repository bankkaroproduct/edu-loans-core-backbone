CREATE TABLE IF NOT EXISTS public._tmp_uni_rank_import (
  id uuid PRIMARY KEY,
  global_rank integer,
  rank_band text,
  rank_score integer
);
ALTER TABLE public._tmp_uni_rank_import ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all" ON public._tmp_uni_rank_import FOR ALL USING (true) WITH CHECK (true);
TRUNCATE public._tmp_uni_rank_import;